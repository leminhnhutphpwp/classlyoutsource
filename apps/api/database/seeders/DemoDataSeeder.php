<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\AssignmentType;
use App\Models\Attendance;
use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\GradeType;
use App\Models\LearningResource;
use App\Models\LessonNote;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationBankAccount;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use App\Models\UserBankAccount;
use App\Support\ReferenceCode;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Dữ liệu demo chân thực cho một trung tâm gia sư (base core single-tenant).
 *
 * Tạo ra một trung tâm hoàn chỉnh để showcase: 1 chủ trung tâm + 1 quản lý + 1 kế toán + 3 gia sư,
 * ~20 học viên + 20 phụ huynh, 8 lớp học với lịch + buổi học + điểm danh + điểm + bài tập + bài nộp,
 * học phí + đợt thu + chi phí trung tâm, bảng lương 3 kỳ + hồ sơ lương + điều chỉnh, thông báo,
 * tài liệu học tập, ghi chú buổi học và nhật ký đăng nhập.
 *
 * Idempotent: nếu trung tâm demo đã tồn tại thì bỏ qua.
 */
class DemoDataSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'Classly@2024';

    private const DAY_MAP = [
        'monday' => Carbon::MONDAY,
        'tuesday' => Carbon::TUESDAY,
        'wednesday' => Carbon::WEDNESDAY,
        'thursday' => Carbon::THURSDAY,
        'friday' => Carbon::FRIDAY,
        'saturday' => Carbon::SATURDAY,
        'sunday' => Carbon::SUNDAY,
    ];

    private Organization $org;

    private User $owner;

    private User $manager;

    private User $accountant;

    /** @var array<string, User> keyed by role-ish label */
    private array $tutors = [];

    /** @var array<int, Student> */
    private array $students = [];

    /** @var array<int, User> */
    private array $parents = [];

    /** @var array<string, int> subject code => id */
    private array $subjectIds = [];

    /** @var array<string, int> grade level code => id */
    private array $gradeLevelIds = [];

    /** @var array<string, int> assignment type code => id */
    private array $assignmentTypeIds = [];

    /** @var array<string, int> grade type code => id */
    private array $gradeTypeIds = [];

    public function run(): void
    {
        if (Organization::where('slug', 'trung-tam-gia-su-tri-tue')->exists()) {
            $this->command->info('ℹ️ Dữ liệu demo đã tồn tại, bỏ qua.');

            return;
        }

        $this->command->info('🎬 Bắt đầu tạo dữ liệu demo trung tâm gia sư...');

        $this->loadMasterData();
        $this->seedOrganizationAndMembers();
        $this->seedStudentsAndParents();
        $this->seedClassesAndEnrollments();
        $this->seedSchedulesAndSessions();
        $this->seedAttendance();
        $this->seedGrades();
        $this->seedAssignmentsAndSubmissions();
        $this->seedPaymentsAndRequests();
        $this->seedExpenses();
        $this->seedPayroll();
        $this->seedNotifications();
        $this->seedLearningResources();
        $this->seedLessonNotes();
        $this->seedLoginActivity();

        $this->command->info('');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('  ✅ Dữ liệu demo đã sẵn sàng. Thông tin đăng nhập:');
        $this->command->info('     Chủ trung tâm : nguyen.minh.tuan@example.edu.vn');
        $this->command->info('     Quản lý       : thu.ha@example.edu.vn');
        $this->command->info('     Kế toán       : nam.le@example.edu.vn');
        $this->command->info('     Gia sư        : quoc.huy@example.edu.vn');
        $this->command->info('     Phụ huynh     : an.nguyen.ph@example.vn');
        $this->command->info('     Học viên      : an.nguyen@example.vn');
        $this->command->info('     Mật khẩu chung: '.self::DEMO_PASSWORD);
        $this->command->info('═══════════════════════════════════════════════════════════');
    }

    private function loadMasterData(): void
    {
        $this->subjectIds = Subject::pluck('id', 'code')->all();
        $this->gradeLevelIds = GradeLevel::pluck('id', 'code')->all();
        $this->assignmentTypeIds = AssignmentType::pluck('id', 'code')->all();
        $this->gradeTypeIds = GradeType::pluck('id', 'code')->all();
    }

    private function makeUser(string $name, string $email, string $role, ?string $phone = null): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => Hash::make(self::DEMO_PASSWORD),
            'role' => $role,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function seedOrganizationAndMembers(): void
    {
        // Chủ trung tâm (gia sư, org_role=owner)
        $this->owner = $this->makeUser('Nguyễn Minh Tuấn', 'nguyen.minh.tuan@example.edu.vn', 'tutor', '0901234567');
        $this->owner->assignRole('tutor');

        $this->org = Organization::create([
            'owner_id' => $this->owner->id,
            'name' => 'Trung tâm Gia sư Trí Tuệ',
            'slug' => 'trung-tam-gia-su-tri-tue',
            'description' => 'Trung tâm gia sư uy tín tại TP. Hồ Chí Minh, chuyên luyện thi vào 10, thi THPT Quốc gia và chứng chỉ IELTS.',
            'status' => 'active',
            'settings' => [
                'currency' => 'VND',
                'timezone' => 'Asia/Ho_Chi_Minh',
            ],
        ]);

        $members = [
            [$this->owner, 'owner', now()->subMonths(14)],
            [$this->manager = $this->makeUser('Trần Thị Thu Hà', 'thu.ha@example.edu.vn', 'tutor', '0901234568'), 'manager', now()->subMonths(12)],
            [$this->accountant = $this->makeUser('Lê Văn Nam', 'nam.le@example.edu.vn', 'tutor', '0901234569'), 'accountant', now()->subMonths(10)],
            [$this->tutors['huy'] = $this->makeUser('Phạm Quốc Huy', 'quoc.huy@example.edu.vn', 'tutor', '0901234570'), 'tutor', now()->subMonths(9)],
            [$this->tutors['lan'] = $this->makeUser('Đỗ Thị Lan', 'thi.lan@example.edu.vn', 'tutor', '0901234571'), 'tutor', now()->subMonths(8)],
            [$this->tutors['son'] = $this->makeUser('Vũ Hoàng Sơn', 'hoang.son@example.edu.vn', 'tutor', '0901234572'), 'tutor', now()->subMonths(6)],
        ];

        foreach ($members as [$user, $role, $joinedAt]) {
            $user->assignRole('tutor');
            OrganizationMember::create([
                'organization_id' => $this->org->id,
                'user_id' => $user->id,
                'org_role' => $role,
                'status' => 'active',
                'invited_by' => $this->owner->id,
                'joined_at' => $joinedAt,
            ]);
        }

        // Tài khoản ngân hàng nhận học phí của TRUNG TÂM — dữ liệu DEMO ẢO (số tài khoản giả,
        // không phải số thật). Seed nhiều tài khoản để demo tính năng: một trung tâm có thể có
        // nhiều tài khoản ngân hàng, một tài khoản được đánh dấu mặc định (is_default=true)
        // để hiển thị cho học viên khi chuyển khoản.
        OrganizationBankAccount::create([
            'organization_id' => $this->org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '000123456789',
            'account_name' => 'TRUNG TAM GIA SU TRI TUE',
            'branch' => 'Chi nhánh TP. Hồ Chí Minh',
            // Placeholder [Mã đơn hàng] → mỗi khoản học phí mang mã tham chiếu riêng,
            // trung tâm phân biệt được ai đã đóng và SePay tự đối chiếu được.
            'memo' => 'HOCPHI-TRITUE [Mã đơn hàng]',
            'is_default' => true,
        ]);
        OrganizationBankAccount::create([
            'organization_id' => $this->org->id,
            'bank_name' => 'Vietcombank',
            'account_number' => '000987654321',
            'account_name' => 'TRUNG TAM GIA SU TRI TUE',
            'branch' => 'Chi nhánh Hà Nội',
            'memo' => 'HOCPHI-HN [Mã đơn hàng]',
            'is_default' => false,
        ]);
        OrganizationBankAccount::create([
            'organization_id' => $this->org->id,
            'bank_name' => 'MBBank',
            'account_number' => '000555000777',
            'account_name' => 'TRUNG TAM GIA SU TRI TUE',
            'branch' => 'Chi nhánh Đà Nẵng',
            'is_default' => false,
        ]);
    }

    private function seedStudentsAndParents(): void
    {
        // [name, parent_name, gender, birth_year, phone, guardian-name, guardian-relationship]
        $roster = [
            ['Nguyễn Văn An', 'Nguyễn Văn Hùng', 'male', 2009, '0911110001', 'Nguyễn Văn Hùng', 'father'],
            ['Trần Thị Bích', 'Trần Thị Hồng', 'female', 2008, '0911110002', 'Trần Thị Hồng', 'mother'],
            ['Lê Minh Châu', 'Lê Văn Thành', 'female', 2007, '0911110003', 'Lê Văn Thành', 'father'],
            ['Phạm Quốc Dũng', 'Phạm Thị Kim', 'male', 2006, '0911110004', 'Phạm Thị Kim', 'mother'],
            ['Hoàng Thu Hương', 'Hoàng Văn Long', 'female', 2009, '0911110005', 'Hoàng Văn Long', 'father'],
            ['Vũ Đức Kiên', 'Vũ Thị Hạnh', 'male', 2010, '0911110006', 'Vũ Thị Hạnh', 'mother'],
            ['Đặng Ngọc Lan', 'Đặng Quốc Bảo', 'female', 2007, '0911110007', 'Đặng Quốc Bảo', 'father'],
            ['Bùi Thanh Mai', 'Bùi Văn Sơn', 'female', 2008, '0911110008', 'Bùi Văn Sơn', 'father'],
            ['Đỗ Hữu Nghĩa', 'Đỗ Thị Loan', 'male', 2006, '0911110009', 'Đỗ Thị Loan', 'mother'],
            ['Ngô Phương Oanh', 'Ngô Văn Đạt', 'female', 2009, '0911110010', 'Ngô Văn Đạt', 'father'],
            ['Dương Thế Phong', 'Dương Minh Tâm', 'male', 2007, '0911110011', 'Dương Minh Tâm', 'father'],
            ['Lý Gia Bảo', 'Lý Thanh Hà', 'male', 2010, '0911110012', 'Lý Thanh Hà', 'mother'],
            ['Trịnh Thảo Vy', 'Trịnh Công Vinh', 'female', 2008, '0911110013', 'Trịnh Công Vinh', 'father'],
            ['Phan Tuấn Kiệt', 'Phan Văn Cường', 'male', 2006, '0911110014', 'Phan Văn Cường', 'father'],
            ['Đinh Hồng Nhung', 'Đinh Thị Mai', 'female', 2007, '0911110015', 'Đinh Thị Mai', 'mother'],
            ['Lâm Quang Huy', 'Lâm Văn Hải', 'male', 2009, '0911110016', 'Lâm Văn Hải', 'father'],
            ['Tô Mỹ Linh', 'Tô Quốc Anh', 'female', 2010, '0911110017', 'Tô Quốc Anh', 'father'],
            ['Hà Đức Thịnh', 'Hà Văn Dũng', 'male', 2008, '0911110018', 'Hà Văn Dũng', 'father'],
            ['Vương Tuyết Nhi', 'Vương Thị Ngọc', 'female', 2007, '0911110019', 'Vương Thị Ngọc', 'mother'],
            ['Mai Xuân Trường', 'Mai Văn Lộc', 'male', 2006, '0911110020', 'Mai Văn Lộc', 'father'],
        ];

        $emails = [
            'an.nguyen', 'bich.tran', 'chau.le', 'dung.pham', 'huong.hoang', 'kien.vu',
            'lan.dang', 'mai.bui', 'nghia.do', 'oanh.ngo', 'phong.duong', 'bao.ly',
            'vy.trinh', 'kiet.phan', 'nhung.dinh', 'huy.lam', 'linh.to', 'thinh.ha',
            'nhi.vuong', 'truong.mai',
        ];

        foreach ($roster as $i => $r) {
            // Tài khoản học viên để đăng nhập app xem điểm/lịch
            $studentUser = $this->makeUser($r[0], $emails[$i].'@example.vn', 'student', $r[4]);
            $studentUser->assignRole('student');

            $student = Student::create([
                'user_id' => $studentUser->id,
                'created_by' => $this->owner->id,
                'name' => $r[0],
                'parent_name' => $r[1],
                'phone' => $r[4],
                'email' => $emails[$i].'@example.vn',
                'birth_date' => Carbon::createFromDate($r[3], rand(1, 12), rand(1, 28)),
                'gender' => $r[2],
                'address' => 'Quận '.rand(1, 12).', TP. Hồ Chí Minh',
                'status' => 'active',
                'notes' => null,
            ]);

            $this->students[] = $student;

            // Tài khoản phụ huynh (mỗi phụ huynh quản 1 học viên trong demo)
            $parentUser = $this->makeUser($r[5], str_replace('@example.vn', '', $emails[$i]).'.ph@example.vn', 'parent', $r[4]);
            $parentUser->assignRole('parent');
            $this->parents[$student->id] = $parentUser;

            $student->guardians()->attach($parentUser->id, [
                'relationship' => $r[6],
                'is_primary' => true,
                'status' => 'active',
            ]);
        }
    }

    /**
     * Mỗi lớp: [tên, subject_code, grade_level_code, tutor_key, tuition_fee, days, time, room]
     */
    private function classPlan(): array
    {
        return [
            ['Toán 10A', 'MATH', 'G10', 'huy', 1200000, ['monday', 'thursday'], '18:00', 'P201'],
            ['Toán 11A', 'MATH', 'G11', 'huy', 1300000, ['tuesday', 'friday'], '18:00', 'P202'],
            ['Toán 9 - Ôn thi vào 10', 'MATH', 'G9', 'huy', 1500000, ['wednesday', 'saturday'], '19:00', 'P203'],
            ['Vật Lý 10', 'PHYS', 'G10', 'son', 1000000, ['monday', 'wednesday'], '19:30', 'P301'],
            ['Hóa Học 12', 'CHEM', 'G12', 'son', 1400000, ['tuesday', 'thursday'], '19:30', 'P302'],
            ['Tiếng Anh 9', 'ENG', 'G9', 'lan', 1100000, ['wednesday', 'friday'], '17:30', 'P101'],
            ['IELTS 6.5', 'IELTS', 'ADULT', 'lan', 2500000, ['saturday', 'sunday'], '08:00', 'P102'],
            ['Ngữ Văn 12', 'LIT', 'G12', 'lan', 1200000, ['monday', 'thursday'], '18:30', 'P303'],
        ];
    }

    private function seedClassesAndEnrollments(): void
    {
        // Phân bổ học viên vào lớp (class index => student indexes). Mỗi học viên 1-2 lớp.
        $enrollMap = [
            0 => [0, 1, 4, 5, 11, 16],        // Toán 10A
            1 => [2, 3, 7, 12, 19],            // Toán 11A
            2 => [4, 8, 10, 14, 16, 17],       // Toán 9 ôn thi
            3 => [0, 5, 6, 9, 13, 15],         // Vật Lý 10
            4 => [1, 2, 3, 7, 12, 18, 19],     // Hóa 12
            5 => [4, 6, 8, 10, 11, 14, 17],    // Tiếng Anh 9
            6 => [3, 9, 13, 15, 18],           // IELTS
            7 => [2, 5, 12, 18, 19],           // Văn 12
        ];

        foreach ($this->classPlan() as $i => [$name, $subjectCode, $gradeLevelCode, $tutorKey, $tuition, $days, $time, $room]) {
            $start = Carbon::today()->subWeeks(9)->startOfWeek();
            $class = ClassRoom::create([
                'tutor_id' => $this->tutors[$tutorKey]->id,
                'organization_id' => $this->org->id,
                'subject_id' => $this->subjectIds[$subjectCode] ?? null,
                'name' => $name,
                'subject' => Subject::where('code', $subjectCode)->value('name'),
                'start_date' => $start,
                'end_date' => Carbon::today()->addMonths(4),
                'schedule' => [
                    'days' => array_map(fn ($d) => substr($d, 0, 3), $days),
                    'time' => $time.'-'.Carbon::parse($time)->addMinutes(120)->format('H:i'),
                ],
                'tuition_fee' => $tuition,
                'max_students' => 15,
                'description' => $this->classDescription($name),
                'status' => 'active',
            ]);

            // Gán học viên vào lớp (pivot class_student)
            foreach ($enrollMap[$i] as $studentIndex) {
                $student = $this->students[$studentIndex];
                $enrolledAt = $start->copy()->addDays(rand(0, 5));
                $class->students()->attach($student->id, [
                    'enrolled_at' => $enrolledAt,
                    'status' => 'active',
                    'is_paused' => false,
                    'notes' => null,
                ]);
                // Cập nhật primary class_id (legacy) cho học viên nếu chưa có
                if (! $student->class_id) {
                    $student->update(['class_id' => $class->id]);
                }
            }
        }
    }

    private function classDescription(string $name): string
    {
        return match (true) {
            str_contains($name, 'Ôn thi') => 'Lớp ôn thi trọng tâm, bám sát cấu trúc đề, luyện đề hằng tuần và chữa bài chi tiết.',
            str_contains($name, 'IELTS') => 'Luyện 4 kỹ năng theo khung chấm điểm IDP/British Council, cam kết đầu ra.',
            default => 'Lớp học bám sát chương trình, kết hợp bài tập vận dụng và kiểm tra định kỳ.',
        };
    }

    private function seedSchedulesAndSessions(): void
    {
        $dayMap = self::DAY_MAP;
        $cursor = Carbon::today()->subWeeks(9)->startOfDay();
        $end = Carbon::today()->addWeeks(2)->endOfDay();
        $classPlans = $this->classPlan();

        // Map class name => ClassRoom (unique by name within this demo run)
        $classes = ClassRoom::whereIn('name', array_column($classPlans, 0))->get()->keyBy('name');

        // Tạo Schedule (lịch mẫu) cho mỗi lớp
        foreach ($classPlans as [$name, , , $tutorKey, , $days, $time, $room]) {
            $class = $classes[$name];
            foreach ($days as $day) {
                $start = Carbon::parse($time);
                Schedule::create([
                    'class_id' => $class->id,
                    'day_of_week' => $day,
                    'start_time' => $start->format('H:i:s'),
                    'end_time' => $start->copy()->addMinutes(120)->format('H:i:s'),
                    'room' => $room,
                    'location' => 'Tòa nhà Trí Tuệ, 12 Nguyễn Văn Bảo, P.4, Gò Vấp',
                    'is_active' => true,
                    'recurring_type' => 'weekly',
                    'recurring_days' => [self::DAY_MAP[$day]],
                    'start_date' => $class->start_date,
                    'end_date' => $class->end_date,
                    'default_mode' => 'offline',
                ]);
            }
        }

        // Sinh buổi học (ScheduleSession) theo lịch
        $schedules = Schedule::whereIn('class_id', $classes->pluck('id'))->get()->groupBy('class_id');
        $weekBase = Carbon::today()->subWeeks(9);

        while ($cursor->lte($end)) {
            foreach ($schedules as $classId => $classSchedules) {
                foreach ($classSchedules as $sched) {
                    if ($cursor->dayOfWeek !== $dayMap[$sched->day_of_week]) {
                        continue;
                    }
                    $isPast = $cursor->lt(Carbon::today());
                    $startTime = Carbon::parse($sched->start_time);
                    ScheduleSession::create([
                        'schedule_id' => $sched->id,
                        'class_id' => $classId,
                        'session_date' => $cursor->copy()->toDateString(),
                        'start_time' => $startTime->format('H:i:s'),
                        'end_time' => $startTime->copy()->addMinutes(120)->format('H:i:s'),
                        'mode' => 'offline',
                        'room' => $sched->room,
                        'location' => $sched->location,
                        'status' => $isPast ? 'completed' : 'scheduled',
                        'completed_at' => $isPast ? $cursor->copy()->setTimeFrom($startTime)->addMinutes(120) : null,
                        'completed_by' => $isPast ? $sched->class->tutor_id : null,
                        'week_number' => $weekBase->diffInWeeks($cursor) + 1,
                    ]);
                }
            }
            $cursor->addDay();
        }
    }

    private function seedAttendance(): void
    {
        $sessions = ScheduleSession::where('status', 'completed')->with('class')->get();

        foreach ($sessions as $session) {
            $class = $session->class;
            $tutorId = $class->tutor_id;
            $students = $class->students()->wherePivot('status', 'active')->get();

            foreach ($students as $student) {
                $roll = rand(1, 100);
                $status = match (true) {
                    $roll <= 75 => 'present',
                    $roll <= 88 => 'late',
                    default => 'absent',
                };

                $startTime = Carbon::parse($session->start_time);
                $checkIn = $status === 'absent'
                    ? null
                    : $startTime->copy()->addMinutes($status === 'late' ? rand(8, 20) : rand(-5, 5))->format('H:i:s');
                $checkOut = $status === 'absent'
                    ? null
                    : Carbon::parse($session->end_time)->copy()->addMinutes(rand(-5, 3))->format('H:i:s');

                Attendance::create([
                    'class_id' => $class->id,
                    'student_id' => $student->id,
                    'tutor_id' => $tutorId,
                    'date' => $session->session_date,
                    'schedule_session_id' => $session->id,
                    'check_in_time' => $checkIn,
                    'check_out_time' => $checkOut,
                    'status' => $status,
                    'checked_in_via' => 'manual',
                    'note' => $status === 'absent' ? 'Nghỉ có báo trước' : null,
                ]);
            }
        }
    }

    private function seedGrades(): void
    {
        $gradeTypes = ['ORAL', '15MIN', '45MIN', 'MID', 'FINAL'];
        $semester = 'Học kỳ '.(now()->month <= 6 ? '2' : '1');

        foreach ($this->students as $student) {
            foreach ($student->classes()->wherePivot('status', 'active')->get() as $class) {
                foreach ($gradeTypes as $type) {
                    $score = match ($type) {
                        'FINAL' => round(rand(60, 95) / 10, 1),
                        'MID' => round(rand(55, 95) / 10, 1),
                        default => round(rand(50, 100) / 10, 1),
                    };
                    Grade::create([
                        'student_id' => $student->id,
                        'class_id' => $class->id,
                        'tutor_id' => $class->tutor_id,
                        'grade_type_id' => $this->gradeTypeIds[$type] ?? null,
                        'title' => GradeType::where('code', $type)->value('name'),
                        'score' => $score,
                        'max_score' => 10,
                        'comments' => $score >= 8 ? 'Làm bài tốt, tiếp tục phát huy.' : null,
                        'grade_date' => Carbon::today()->subDays(rand(5, 60)),
                        'semester' => $semester,
                    ]);
                }
            }
        }
    }

    private function seedAssignmentsAndSubmissions(): void
    {
        // Mỗi lớp tạo 3 bài tập: [type_code, title_suffix, max_score]
        $plans = [
            ['HOMEWORK', 'Bài tập về nhà chương', 10],
            ['TEST_15', 'Kiểm tra 15 phút', 10],
            ['PRACTICE', 'Bài thực hành tổng hợp', 20],
        ];

        foreach (ClassRoom::all() as $class) {
            foreach ($plans as $p) {
                $assigned = Carbon::today()->subDays(rand(10, 25));
                $due = $assigned->copy()->addDays(rand(4, 7));
                $assignment = Assignment::create([
                    'class_id' => $class->id,
                    'tutor_id' => $class->tutor_id,
                    'assignment_type_id' => $this->assignmentTypeIds[$p[0]] ?? null,
                    'mode' => 'standard',
                    'title' => $p[1].' '.rand(1, 9).' - '.$class->name,
                    'description' => 'Bài tập bám sát nội dung đã học, yêu cầu làm bài cẩn thận và nộp đúng hạn.',
                    'instructions' => "1. Làm bài vào vở.\n2. Chụp ảnh/scan nộp qua hệ thống.\n3. Nộp trước ".$due->format('d/m/Y').' 23:59.',
                    'max_score' => $p[2],
                    'assigned_date' => $assigned,
                    'due_date' => $due,
                    'deadline' => $due->copy()->setTime(23, 59, 0),
                    'allow_late_submission' => $p[0] !== 'TEST_15',
                    'allowed_submission_types' => ['file', 'image', 'text'],
                    'status' => $due->isPast() ? 'closed' : 'published',
                ]);

                $this->seedSubmissionsFor($assignment, $class);
            }
        }
    }

    private function seedSubmissionsFor(Assignment $assignment, ClassRoom $class): void
    {
        foreach ($class->students()->wherePivot('status', 'active')->get() as $student) {
            $submitted = rand(1, 100) <= 85;
            if (! $submitted) {
                continue;
            }

            $isLate = rand(1, 100) <= 15;
            $submittedAt = $assignment->due_date->copy()->subDays(rand(0, 2))->setTime(rand(19, 22), rand(0, 59), 0);
            if ($isLate) {
                $submittedAt = $assignment->due_date->copy()->addHours(rand(2, 24));
            }

            $graded = rand(1, 100) <= 80;
            $score = $graded ? round($assignment->max_score * (rand(50, 98) / 100), 1) : null;

            Submission::create([
                'assignment_id' => $assignment->id,
                'student_id' => $student->id,
                'content' => "Em đã hoàn thành bài tập. Đính kèm bài làm của em.\n\n- Đã xem lại lý thuyết chương liên quan.\n- Đã làm đầy đủ các câu hỏi.",
                'submitted_at' => $submittedAt,
                'is_late' => $isLate,
                'score' => $score,
                'feedback' => $graded ? ($score >= $assignment->max_score * 0.8 ? 'Bài làm tốt, trình bày rõ ràng.' : 'Cần xem lại một số phần đã đánh dấu.') : null,
                'graded_by' => $graded ? $assignment->tutor_id : null,
                'graded_at' => $graded ? $submittedAt->copy()->addDays(rand(1, 3)) : null,
                'status' => $graded ? 'graded' : 'submitted',
                'submission_type' => 'file',
                'attempt_number' => 1,
            ]);
        }
    }

    private function seedPaymentsAndRequests(): void
    {
        $months = [];
        for ($i = 2; $i >= 0; $i--) {
            $months[] = Carbon::today()->subMonths($i);
        }

        foreach (ClassRoom::all() as $class) {
            $students = $class->students()->wherePivot('status', 'active')->get();

            foreach ($months as $idx => $month) {
                $periodMonth = $month->format('Y-m');
                $request = PaymentRequest::create([
                    'class_id' => $class->id,
                    'created_by' => $this->accountant->id,
                    'period_name' => 'Học phí tháng '.$month->format('m/Y'),
                    'period_month' => $periodMonth,
                    'amount_per_student' => $class->tuition_fee,
                    'due_date' => $month->copy()->startOfMonth()->addDays(9),
                    'description' => 'Thu học phí tháng '.$month->format('m/Y').' cho lớp '.$class->name,
                    'status' => 'active',
                    'metadata' => ['class_name' => $class->name],
                ]);

                foreach ($students as $student) {
                    $this->createPayment($student->id, $class, $request, $periodMonth, $month, $idx);
                }
            }
        }
    }

    private function createPayment(int $studentId, ClassRoom $class, PaymentRequest $request, string $month, Carbon $period, int $monthIdx): void
    {
        // Tháng hiện tại: đa số đã đóng, một số pending, vài failed. Tháng trước: gần như đã đóng.
        $roll = rand(1, 100);
        $status = match (true) {
            $monthIdx < 2 && $roll <= 92 => 'paid',
            $monthIdx < 2 && $roll <= 95 => 'pending',
            $monthIdx === 2 && $roll <= 70 => 'paid',
            $monthIdx === 2 && $roll <= 95 => 'pending',
            default => 'failed',
        };

        $paymentDate = $status === 'paid'
            ? $period->copy()->startOfMonth()->addDays(rand(1, 15))
            : null;

        $payment = new Payment([
            'student_id' => $studentId,
            'class_id' => $class->id,
            'payment_request_id' => $request->id,
            'amount' => $class->tuition_fee,
            // Payment pending/đang chờ luôn là chuyển khoản (kênh thu chính của trung tâm — QR hiển thị
            // tài khoản mặc định của trung tâm cho học viên/phụ huynh). Payment đã đóng giữ đa dạng
            // cash/bank để demo thống kê.
            'payment_method' => $status === 'paid' ? (rand(1, 100) <= 40 ? 'cash' : 'bank') : 'bank',
            'transaction_id' => $status === 'paid' && rand(1, 100) <= 60 ? 'FT'.rand(100000000, 999999999) : null,
            'month' => $month,
            'payment_date' => $paymentDate,
            'due_date' => $request->due_date,
            'status' => $status,
            'note' => $status === 'failed' ? 'Giao dịch không thành công' : null,
        ]);
        $payment->collected_by = $this->accountant->id;
        $payment->save();
    }

    private function seedExpenses(): void
    {
        $expensePlan = [
            ['rent', 'Thuê mặt bằng trung tâm', 15000000],
            ['utilities', 'Tiền điện + nước', 2200000],
            ['marketing', 'Quảng cáo Facebook + Zalo', 3500000],
            ['equipment', 'Mua máy chiếu + bảng mới', 6800000],
            ['software', 'Chi phí phần mềm quản lý', 1200000],
            ['other', 'Văn phòng phẩm + chi phí lặt vặt', 900000],
        ];

        foreach (range(2, 0) as $i) {
            $month = Carbon::today()->subMonths($i);
            foreach ($expensePlan as [$category, $desc, $amount]) {
                // Thiết bị chỉ mua 1 lần (tháng trước tháng hiện tại)
                if ($category === 'equipment' && $i !== 1) {
                    continue;
                }
                CenterExpense::create([
                    'organization_id' => $this->org->id,
                    'category' => $category,
                    'amount' => $amount + ($category === 'utilities' ? rand(0, 400000) : 0),
                    'expense_date' => $month->copy()->startOfMonth()->addDays(rand(1, 25))->toDateString(),
                    'description' => $desc,
                    'payment_method' => 'bank',
                    'created_by' => $this->accountant->id,
                ]);
            }
        }
    }

    private function seedPayroll(): void
    {
        // Hồ sơ lương: chủ + quản lý + kế toán lương cứng; gia sư theo buổi/doanh thu.
        $profiles = [
            [$this->owner, 'fixed_monthly', 20000000, null, null],
            [$this->manager, 'fixed_monthly', 15000000, null, null],
            [$this->accountant, 'fixed_monthly', 12000000, null, null],
            [$this->tutors['huy'], 'per_session', null, 180000, null],
            [$this->tutors['lan'], 'per_session', null, 160000, null],
            [$this->tutors['son'], 'revenue_share', null, null, 45],
        ];

        $profileIds = [];
        foreach ($profiles as [$user, $model, $base, $perSession, $sharePct]) {
            $profile = TutorCompensationProfile::create([
                'organization_id' => $this->org->id,
                'user_id' => $user->id,
                'pay_model' => $model,
                'base_salary' => $base,
                'rate_per_session' => $perSession,
                'revenue_share_pct' => $sharePct,
                'session_basis' => 'completed_session',
                'currency' => 'VND',
                'effective_from' => Carbon::today()->startOfYear(),
                'status' => 'active',
            ]);
            $profileIds[$user->id] = $profile->id;
        }

        // 3 kỳ lương: 2 tháng trước (đã chi), tháng trước (đã duyệt), tháng này (nháp)
        $periodDefs = [
            ['label' => 'Kỳ lương tháng '.Carbon::today()->subMonths(2)->format('m/Y'), 'months_ago' => 2, 'status' => 'paid'],
            ['label' => 'Kỳ lương tháng '.Carbon::today()->subMonths(1)->format('m/Y'), 'months_ago' => 1, 'status' => 'approved'],
            ['label' => 'Kỳ lương tháng '.Carbon::today()->format('m/Y'), 'months_ago' => 0, 'status' => 'draft'],
        ];

        foreach ($periodDefs as $def) {
            $start = Carbon::today()->subMonths($def['months_ago'])->startOfMonth();
            $end = Carbon::today()->subMonths($def['months_ago'])->endOfMonth();

            $period = PayrollPeriod::create([
                'organization_id' => $this->org->id,
                'reference_code' => ReferenceCode::generate(PayrollPeriod::class, 'PR'),
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'label' => $def['label'],
                'status' => $def['status'],
                'approved_by' => $def['status'] !== 'draft' ? $this->owner->id : null,
                'approved_at' => $def['status'] !== 'draft' ? $end->copy()->addDays(2) : null,
                'paid_by' => $def['status'] === 'paid' ? $this->owner->id : null,
                'paid_at' => $def['status'] === 'paid' ? $end->copy()->addDays(3) : null,
                'total_amount' => 0,
            ]);

            $total = 0;
            foreach ($profiles as [$user, $model, $base, $perSession, $sharePct]) {
                $gross = match ($model) {
                    'fixed_monthly' => $base,
                    'per_session' => $perSession * rand(14, 24),
                    'revenue_share' => (int) round(rand(18, 30) * 1000000 * ($sharePct / 100)),
                    default => 0,
                };

                $item = PayrollItem::create([
                    'organization_id' => $this->org->id,
                    'payroll_period_id' => $period->id,
                    'user_id' => $user->id,
                    'compensation_profile_id' => $profileIds[$user->id],
                    'pay_model' => $model,
                    'base_amount' => $model === 'fixed_monthly' ? $base : 0,
                    'sessions_count' => $model === 'per_session' ? (int) round($gross / $perSession) : 0,
                    'sessions_amount' => $model === 'per_session' ? $gross : 0,
                    'students_count' => 0,
                    'students_amount' => 0,
                    'revenue_base' => $model === 'revenue_share' ? (int) round($gross / ($sharePct / 100)) : 0,
                    'revenue_amount' => $model === 'revenue_share' ? $gross : 0,
                    'adjustments_total' => 0,
                    'gross_amount' => $gross,
                    'computation_breakdown' => ['pay_model' => $model],
                    'status' => $def['status'] === 'draft' ? 'draft' : ($def['status'] === 'paid' ? 'paid' : 'approved'),
                ]);
                $total += $gross;

                // Điều chỉnh lương (thưởng/khấu trừ) cho các kỳ đã chốt
                if ($def['status'] !== 'draft' && rand(1, 100) <= 40) {
                    $type = rand(1, 100) <= 70 ? 'bonus' : 'deduction';
                    $adjAmount = $type === 'bonus' ? rand(300000, 1500000) : rand(200000, 800000);
                    PayrollAdjustment::create([
                        'organization_id' => $this->org->id,
                        'payroll_item_id' => $item->id,
                        'type' => $type,
                        'amount' => $adjAmount,
                        'reason' => $type === 'bonus' ? 'Thưởng hiệu quả giảng dạy' : 'Khấu trừ đi muộn',
                        'created_by' => $this->owner->id,
                    ]);
                }
            }

            $period->update(['total_amount' => $total]);
        }
    }

    private function seedNotifications(): void
    {
        $notifications = [
            [
                'title' => 'Thông báo nghỉ lễ',
                'message' => 'Trung tâm thông báo nghỉ lễ Quốc khánh 2/9. Toàn bộ lớp học sẽ được dời lịch bù. Quý phụ huynh vui lòng theo dõi lịch học mới.',
                'type' => 'announcement',
                'target' => 'all',
                'recipient_type' => 'all',
                'status' => 'sent',
            ],
            [
                'title' => 'Nhắc học phí tháng này',
                'message' => 'Kính gửi Quý phụ huynh, học phí tháng này đã đến hạn đóng. Vui lòng hoàn tất thanh toán trước ngày 10 để không gián đoạn việc học.',
                'type' => 'payment',
                'target' => 'parent',
                'recipient_type' => 'all',
                'status' => 'sent',
            ],
            [
                'title' => 'Điểm kiểm tra giữa kỳ đã cập nhật',
                'message' => 'Điểm kiểm tra giữa kỳ đã được cập nhật trên hệ thống. Phụ huynh có thể xem chi tiết trong mục Bảng điểm.',
                'type' => 'grade',
                'target' => 'parent',
                'recipient_type' => 'all',
                'status' => 'sent',
            ],
            [
                'title' => 'Nhắc lịch học ngày mai',
                'message' => 'Trung tâm nhắc nhở học viên có lịch học vào ngày mai. Vui lòng đến đúng giờ để điểm danh.',
                'type' => 'reminder',
                'target' => 'student',
                'recipient_type' => 'all',
                'status' => 'scheduled',
                'scheduled_at' => Carbon::today()->addDay()->setTime(7, 0, 0),
            ],
            [
                'title' => 'Học viên vắng mặt buổi học',
                'message' => 'Học viên của Quý phụ huynh đã vắng mặt buổi học gần nhất. Vui lòng xác nhận lý do với giáo viên.',
                'type' => 'attendance',
                'target' => 'parent',
                'recipient_type' => 'all',
                'status' => 'sent',
            ],
        ];

        foreach ($notifications as $n) {
            Notification::create([
                'created_by' => $this->owner->id,
                'title' => $n['title'],
                'message' => $n['message'],
                'type' => $n['type'],
                'target' => $n['target'],
                'recipient_type' => $n['recipient_type'],
                'recipient_classes' => null,
                'recipient_students' => null,
                'recipient_ids' => null,
                'channel' => 'in_app',
                'status' => $n['status'],
                'scheduled_at' => $n['scheduled_at'] ?? null,
                'sent_at' => $n['status'] === 'sent' ? Carbon::today()->subDays(rand(1, 7)) : null,
                'sent_count' => $n['status'] === 'sent' ? count($this->students) : 0,
                'failed_count' => 0,
            ]);
        }
    }

    private function seedLearningResources(): void
    {
        $resources = [
            ['Tổng hợp công thức Toán 10', 'MATH', 'G10', 'document', 'Tài liệu tổng hợp toàn bộ công thức đại số và hình học lớp 10.'],
            ['Đề cương ôn thi vào 10 môn Toán', 'MATH', 'G9', 'document', 'Bộ đề cương trọng tâm bám sát cấu trúc đề thi tuyển sinh vào 10.'],
            ['Video bài giảng: Định luật Newton', 'PHYS', 'G10', 'video', 'Video hướng dẫn chi tiết ba định luật Newton kèm bài tập minh họa.'],
            ['Sơ đồ tư duy Hóa Học 12', 'CHEM', 'G12', 'image', 'Sơ đồ tư duy tổng hợp kiến thức hóa hữu cơ lớp 12.'],
            ['Bài nghe IELTS Listening Part 2', 'IELTS', 'ADULT', 'audio', 'Audio luyện nghe IELTS Listening kèm transcript.'],
            ['Ngữ pháp tiếng Anh: Thì hiện tại hoàn thành', 'ENG', 'G9', 'document', 'Lý thuyết và bài tập về thì hiện tại hoàn thành.'],
            ['Link khóa học online: Ngữ Văn 12', 'LIT', 'G12', 'link', 'Khóa học online ôn tập Ngữ Văn 12 miễn phí.'],
            ['Bộ đề luyện IELTS Reading', 'IELTS', 'ADULT', 'document', '15 đề reading kèm đáp án chi tiết.'],
            ['Bài tập vận dụng Hóa Học', 'CHEM', 'G12', 'document', 'Bài tập vận dụng cao chương este - lipit.'],
            ['Infographic công thức Vật Lý 10', 'PHYS', 'G10', 'image', 'Infographic tổng hợp công thức cơ học.'],
        ];

        $tutors = [$this->tutors['huy'], $this->tutors['lan'], $this->tutors['son']];

        foreach ($resources as $i => [$title, $subjectCode, $gradeCode, $type, $desc]) {
            LearningResource::create([
                'tutor_id' => $tutors[$i % 3]->id,
                'title' => $title,
                'description' => $desc,
                'type' => $type,
                'subject_id' => $this->subjectIds[$subjectCode] ?? null,
                'subject' => Subject::where('code', $subjectCode)->value('name'),
                'topic' => $title,
                'grade_level_id' => $this->gradeLevelIds[$gradeCode] ?? null,
                'grade_level' => GradeLevel::where('code', $gradeCode)->value('name'),
                'tags' => ['ôn tập', 'tài liệu'],
                'external_url' => $type === 'link' ? 'https://example.vn/khoa-hoc/ngu-van-12' : null,
                'downloads' => rand(5, 120),
                'views' => rand(20, 400),
                'is_public' => true,
                'status' => 'active',
            ]);
        }
    }

    private function seedLessonNotes(): void
    {
        $topics = [
            'Ôn tập phương trình bậc hai', 'Luyện đề thi vào 10', 'Giới thiệu thì hiện tại hoàn thành',
            'Reading comprehension: Unit 4', 'Định luật II Newton', 'Este - Lipit',
            'Writing Task 2: Opinion essay', 'Phân tích tác phẩm Vợ chồng A Phủ',
        ];

        $sessions = ScheduleSession::where('status', 'completed')
            ->whereIn('class_id', ClassRoom::pluck('id'))
            ->orderBy('session_date', 'desc')
            ->limit(10)
            ->get();

        foreach ($sessions as $session) {
            $class = $session->class;
            $students = $class->students()->wherePivot('status', 'active')->get();
            $studentNotes = $students->map(fn ($s) => [
                'student_id' => $s->id,
                'note' => rand(1, 100) <= 70 ? 'Tiếp thu tốt, hoàn thành bài tập trên lớp.' : 'Cần rèn thêm bài tập ở nhà.',
                'behavior' => ['excellent', 'good', 'average'][rand(0, 2)],
            ])->all();

            LessonNote::create([
                'class_id' => $class->id,
                'tutor_id' => $class->tutor_id,
                'lesson_date' => $session->session_date,
                'topic' => $topics[array_rand($topics)],
                'content' => "Nội dung buổi học:\n- Kiểm tra bài cũ (15 phút).\n- Giảng bài mới.\n- Làm bài tập vận dụng tại lớp.\n- Giao bài tập về nhà.",
                'homework' => 'Hoàn thành bài tập chương vừa học, nộp trước buổi học kế tiếp.',
                'observations' => 'Lớp học sôi nổi, đa số học viên tích cực phát biểu.',
                'student_notes' => $studentNotes,
                'rating' => rand(4, 5),
                'attachments' => ['Giáo trình chương '.rand(1, 9)],
            ]);
        }
    }

    private function seedLoginActivity(): void
    {
        $users = [
            $this->owner, $this->manager, $this->accountant,
            $this->tutors['huy'], $this->tutors['lan'], $this->tutors['son'],
        ];
        // Thêm vài phụ huynh + học viên
        foreach (array_slice($this->parents, 0, 3) as $parent) {
            $users[] = $parent;
        }
        foreach (array_slice($this->students, 0, 4) as $student) {
            if ($student->user_id) {
                $users[] = User::find($student->user_id);
            }
        }

        foreach ($users as $user) {
            foreach (range(1, rand(2, 4)) as $_) {
                $success = rand(1, 100) <= 95;
                LoginActivity::create([
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'is_success' => $success,
                    'status' => $success ? 'success' : 'failed',
                    'ip_address' => '203.162.'.rand(1, 255).'.'.rand(1, 255),
                    'device_name' => ['Chrome trên Windows', 'Safari trên iPhone', 'Chrome trên Android', 'Edge trên Windows'][rand(0, 3)],
                    'location' => 'TP. Hồ Chí Minh, Việt Nam',
                    'user_agent' => 'Mozilla/5.0 (demo)',
                    'message' => $success ? 'Đăng nhập thành công' : 'Sai mật khẩu',
                    'context' => ['ip' => '203.162.1.1'],
                    'logged_in_at' => Carbon::today()->subHours(rand(1, 120)),
                ]);
            }
        }
    }
}
