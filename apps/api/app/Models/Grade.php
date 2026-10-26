<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Grade extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    /**
     * Weighted average percentage over a set of grades, weighted by each grade's GradeType.weight
     * (defaulting to 1 when the grade has no type / a null weight). Returns a 0-100 percentage, rounded
     * to 2 decimals; 0 when there are no scorable grades. DB-agnostic (works on SQLite + MySQL).
     *
     *   weighted % = SUM( (score/max_score)*100 * COALESCE(weight,1) ) / SUM( COALESCE(weight,1) )
     */
    public static function weightedAveragePercentage(Builder $query): float
    {
        $row = (clone $query)
            ->leftJoin('grade_types', 'grades.grade_type_id', '=', 'grade_types.id')
            ->whereNotNull('grades.score')
            ->whereNotNull('grades.max_score')
            ->where('grades.max_score', '>', 0)
            // `score * 100.0` forces real division — SQLite would do integer division on `score/max_score`.
            ->selectRaw(
                'SUM((grades.score * 100.0 / grades.max_score) * COALESCE(grade_types.weight, 1)) as weighted_sum, '
                .'SUM(COALESCE(grade_types.weight, 1)) as weight_total'
            )
            ->first();

        $weightTotal = (float) ($row->weight_total ?? 0);
        if ($weightTotal <= 0) {
            return 0.0;
        }

        return round((float) $row->weighted_sum / $weightTotal, 2);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'class_id',
        'assignment_id',
        'submission_id',
        'grade_type_id',
        'tutor_id',
        'title',
        'score',
        'max_score',
        'comments',
        'grade_date',
        'semester',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'max_score' => 'integer',
            'grade_date' => 'date',
        ];
    }

    /**
     * Get the student that owns the grade.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get the class that the grade belongs to.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the assignment related to this grade (if any).
     */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    /**
     * Get the submission this grade was derived from (if any). Set when a tutor grades a
     * submission, so the gradebook entry stays linked and idempotent on re-grade.
     */
    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    /**
     * Get the tutor who gave this grade.
     */
    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * Get the grade type.
     */
    public function gradeType(): BelongsTo
    {
        return $this->belongsTo(GradeType::class, 'grade_type_id');
    }

    /**
     * Get grade percentage.
     */
    public function getPercentage(): float
    {
        if ($this->max_score == 0) {
            return 0;
        }

        return round(($this->score / $this->max_score) * 100, 2);
    }

    /**
     * Thang điểm của đầu điểm này, suy ra từ max_score.
     *
     * Trung tâm luyện thi chứng chỉ chấm theo thang riêng, KHÔNG phải thang trường học 0–10/0–100:
     * IELTS 0–9 (bước 0.5), TOEIC 0–990. Nếu quy đổi thẳng sang phần trăm rồi áp ngưỡng
     * 90/80/70/60 thì band 6.0 (đạt mục tiêu đầu ra đại học) ra 66.7% → xếp loại "D — Trung bình",
     * band 5.0 ra 55.6% → "F — Yếu". Cả lớp đang tiến bộ tốt lại bị dashboard báo là yếu kém.
     */
    public const SCALE_IELTS = 'ielts';

    public const SCALE_TOEIC = 'toeic';

    public const SCALE_STANDARD = 'standard';

    public function gradingScale(): string
    {
        return match ((int) $this->max_score) {
            9 => self::SCALE_IELTS,
            990 => self::SCALE_TOEIC,
            default => self::SCALE_STANDARD,
        };
    }

    /**
     * Ngưỡng xếp loại theo từng thang: [điểm sàn => [chữ, nhãn tiếng Việt]], xếp giảm dần.
     *
     * @return array<int, array{0: float, 1: string, 2: string}>
     */
    private function gradeBands(): array
    {
        return match ($this->gradingScale()) {
            // Mốc band IELTS theo cách trung tâm VN vẫn phân loại đầu ra.
            self::SCALE_IELTS => [
                [8.0, 'A', 'Xuất sắc'],
                [7.0, 'B', 'Giỏi'],
                [6.0, 'C', 'Khá'],
                [5.0, 'D', 'Trung bình'],
                [0.0, 'F', 'Cần cải thiện'],
            ],
            // Mốc TOEIC theo chuẩn đầu ra phổ biến (450/550/700/850).
            self::SCALE_TOEIC => [
                [850, 'A', 'Xuất sắc'],
                [700, 'B', 'Giỏi'],
                [550, 'C', 'Khá'],
                [400, 'D', 'Trung bình'],
                [0, 'F', 'Cần cải thiện'],
            ],
            // Thang trường học: giữ nguyên ngưỡng phần trăm cũ.
            default => [
                [90, 'A', 'Xuất sắc'],
                [80, 'B', 'Giỏi'],
                [70, 'C', 'Khá'],
                [60, 'D', 'Trung bình'],
                [0, 'F', 'Yếu'],
            ],
        };
    }

    /**
     * Giá trị đem so với ngưỡng: thang chứng chỉ so ĐIỂM THÔ (band / điểm TOEIC),
     * thang trường học so PHẦN TRĂM như trước.
     */
    private function gradingValue(): float
    {
        return $this->gradingScale() === self::SCALE_STANDARD
            ? $this->getPercentage()
            : (float) $this->score;
    }

    /**
     * Get grade letter (A, B, C, D, F) — theo đúng thang điểm của đầu điểm.
     */
    public function getGradeLetter(): string
    {
        $value = $this->gradingValue();

        foreach ($this->gradeBands() as [$floor, $letter, $label]) {
            if ($value >= $floor) {
                return $letter;
            }
        }

        return 'F';
    }

    /**
     * Nhãn xếp loại tiếng Việt, dùng cho biểu đồ phân bố điểm và sổ học bạ.
     */
    public function getGradeLabel(): string
    {
        $value = $this->gradingValue();

        foreach ($this->gradeBands() as [$floor, $letter, $label]) {
            if ($value >= $floor) {
                return $label;
            }
        }

        return 'Cần cải thiện';
    }

    /**
     * Check if grade is passing.
     */
    public function isPassing(): bool
    {
        // "Đạt" = từ mức Trung bình trở lên, theo đúng thang của đầu điểm (band IELTS ≥ 5.0,
        // TOEIC ≥ 400, thang trường học ≥ 60%). Trước đây luôn so 60% nên band 5.5 (đạt) bị coi là trượt.
        return ! in_array($this->getGradeLetter(), ['F'], true);
    }

    /**
     * Scope a query to only include grades for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to only include grades for a specific class.
     */
    public function scopeForClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Scope a query to only include grades of a specific type (by grade_type_id).
     */
    public function scopeOfType($query, $gradeTypeId)
    {
        return $query->where('grade_type_id', $gradeTypeId);
    }

    /**
     * Scope a query to only include grades for a specific semester.
     */
    public function scopeForSemester($query, $semester)
    {
        return $query->where('semester', $semester);
    }
}
