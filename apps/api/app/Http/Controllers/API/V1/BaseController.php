<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Organization;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\Schedule;
use App\Models\Student;
use App\Models\Submission;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use App\Support\ReferenceCode;
use App\Support\ValidationMessageTranslator;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\MessageBag;

class BaseController extends Controller
{
    /**
     * Request-scoped caches. These MUST be instance properties, never method-local `static`:
     * a controller is resolved fresh per request, but a `static` var persists for the whole PHP
     * process (Octane / a test run), which would leak one user's identity into another's request.
     */
    private array $currentStudentCache = [];

    private array $studentClassIdsCache = [];

    private array $enrollmentCache = [];

    private ?array $guardianStudentIdsCache = null;

    /** Request-scoped cache of active member user-ids per organization id (Phase 2 org isolation). */
    private array $orgTutorIdsCache = [];

    /**
     * Generate a unique reference code.
     */
    protected function generateReferenceCode(string $type = 'payment'): string
    {
        return ReferenceCode::forPayment();
    }

    /**
     * Success response.
     */
    protected function successResponse($data, string $message = 'Thành công', int $code = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    /**
     * Error response.
     */
    protected function errorResponse(string $message, $errors = null, ?string $errorCode = null, int $code = 400): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors) {
            // Format validation errors to Vietnamese messages
            if ($errors instanceof MessageBag) {
                $response['errors'] = ValidationMessageTranslator::translate($errors);
            } elseif ($errors instanceof Validator) {
                $response['errors'] = ValidationMessageTranslator::translate($errors->errors(), $errors);
            } else {
                $response['errors'] = $errors;
            }
        }

        if ($errorCode) {
            $response['code'] = $errorCode;
        }

        return response()->json($response, $code);
    }

    /**
     * Map row data based on provided mappings.
     *
     * @param  array  $rowData  Raw row data from CSV/Excel
     * @param  array  $mappings  Array of [key => [aliases...]]
     * @return array Mapped data
     */
    protected function mapImportRow(array $rowData, array $mappings): array
    {
        $mapped = [];
        foreach ($mappings as $key => $possibleNames) {
            foreach ($possibleNames as $possibleName) {
                foreach ($rowData as $rowKey => $value) {
                    if (strcasecmp(trim($rowKey), trim($possibleName)) === 0) {
                        $mapped[$key] = $value;
                        break 2;
                    }
                }
            }
        }

        return $mapped;
    }

    /**
     * Apply data isolation to query based on user role.
     *
     * @param  string  $resource  Resource type (classes, students, attendances, etc.)
     */
    protected function applyDataIsolation(Builder $query, string $resource = 'classes'): Builder
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $query->whereRaw('1 = 0'); // Return empty result
        }

        // Super Admin sees everything
        if ($user->hasRole('super_admin')) {
            return $query;
        }

        // Organization owner/manager: see the WHOLE org (all member tutors' data).
        // MUST be checked BEFORE isTutor() — owner/manager still have User.role = tutor, so
        // falling through to applyTutorIsolation would wrongly narrow them to only their own data.
        // orgId is derived from the caller's active membership, NEVER from request input.
        if ($user->isOrgViewerAll()) {
            return $this->applyOrgIsolation($query, $resource, $user->currentOrganization());
        }

        // Organization ACCOUNTANT (kế toán): FINANCE-ONLY, least-privilege third branch (design §2.1,
        // §6 risk 2). MUST sit AFTER isOrgViewerAll() (accountant is never a viewer-all) and BEFORE
        // isTutor() — an accountant also has User.role = tutor, so falling through would (a) mis-scope
        // them to a tutor_id they never own and (b) skip the fail-closed teaching arms. Sees org
        // payments / payment_requests / student billing; fail-closed (1=0) on ALL teaching data.
        if ($user->isOrgAccountant()) {
            return $this->applyOrgFinanceIsolation($query, $resource, $user->currentOrganization());
        }

        // Tutor: chỉ thấy dữ liệu của chính họ (tutor_id = user->id)
        if ($user->isTutor()) {
            return $this->applyTutorIsolation($query, $resource);
        }

        // Student: chỉ thấy dữ liệu của chính họ
        if ($user->isStudent()) {
            return $this->applyStudentIsolation($query, $resource);
        }

        // Parent: thấy dữ liệu của các con họ giám hộ (nhiều học viên)
        if ($user->isParent()) {
            return $this->applyGuardianIsolation($query, $resource);
        }

        // Default: no access
        return $query->whereRaw('1 = 0');
    }

    /**
     * Apply Guardian (parent) isolation — the multi-student analogue of applyStudentIsolation.
     * A parent sees data for the union of their guarded children (whereIn instead of `=`).
     */
    private function applyGuardianIsolation(Builder $query, string $resource): Builder
    {
        $studentIds = $this->getGuardianStudentIds();
        if (empty($studentIds)) {
            return $query->whereRaw('1 = 0');
        }

        // Class ids of all guarded children (for class-scoped resources).
        $classIds = Enrollment::whereIn('student_id', $studentIds)
            ->pluck('class_id')->unique()->all();

        return match ($resource) {
            'classes' => empty($classIds) ? $query->whereRaw('1 = 0') : $query->whereIn('id', $classIds),
            'assignments' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('class_id', $classIds)->whereIn('status', ['published', 'closed']),
            'schedules', 'lesson_notes' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('class_id', $classIds),
            'grades', 'attendances', 'payments' => $query->whereIn('student_id', $studentIds),
            'submissions' => $query->whereIn('student_id', $studentIds),
            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Apply ORGANIZATION isolation — the owner/manager view over the WHOLE org.
     *
     * Every predicate anchors to `classes.organization_id = $org->id` (child rows have no org_id
     * column — single source of truth, see design §2.3), or to the set of active member user-ids
     * (`$orgTutorIds`) for tutor-anchored resources (learning_resources, notifications).
     *
     * Fail CLOSED: a null org (should be impossible once isOrgViewerAll() is true) or an unknown
     * resource returns an empty result. Solo classes (organization_id = NULL) can never match a
     * concrete `= $orgId`, so they stay invisible to every org (design R2/R6).
     */
    private function applyOrgIsolation(Builder $query, string $resource, ?Organization $org): Builder
    {
        if (! $org) {
            return $query->whereRaw('1 = 0'); // fail-closed: no org context
        }

        $orgId = $org->id;
        $orgTutorIds = $this->orgTutorIds($org);

        return match ($resource) {
            'classes' => $query->where('organization_id', $orgId),

            // DELIBERATE org-column exception (design §2.5, like R2/R6): center_expenses is the one
            // finance table that carries its OWN organization_id (an expense has no class), so it is
            // isolated DIRECTLY here. This arm is EXPLICIT on purpose — falling into the default deny
            // (whereRaw 1=0) would zero every expense. A solo/cross-org expense can't match $orgId.
            'center_expenses' => $query->where('organization_id', $orgId),

            // PAYROLL (Wave 3) — money that is MEMBER-anchored, not class-anchored (design §2.4, §6
            // risk 1). ALL four tables carry their OWN organization_id (pattern b), so the owner/manager
            // whole-org view isolates DIRECTLY here. These arms are EXPLICIT on purpose — the default
            // deny would zero the entire payroll module. A solo/cross-org row can't match a concrete
            // $orgId, so it stays invisible to every org.
            'tutor_compensation_profiles', 'payroll_periods', 'payroll_items', 'payroll_adjustments' => $query->where('organization_id', $orgId),

            'attendances', 'assignments', 'grades', 'lesson_notes', 'schedules', 'payments' => $query->whereHas('class', function ($q) use ($orgId) {
                $q->where('organization_id', $orgId);
            }),

            'submissions' => $query->whereHas('assignment.class', function ($q) use ($orgId) {
                $q->where('organization_id', $orgId);
            }),

            'students' => $query->where(function ($q) use ($orgId, $orgTutorIds) {
                $q->whereIn('created_by', $orgTutorIds)
                    ->orWhereHas('classes', function ($c) use ($orgId) {
                        $c->where('organization_id', $orgId);
                    });
            }),

            // Tutor-anchored resources: scope by the org's active member set.
            'learning_resources' => $query->whereIn('tutor_id', $orgTutorIds),

            // MVP scope (design R4): owner/manager see notifications CREATED by anyone in the org.
            // A full recipient-union view across every member is intentionally out of MVP.
            'notifications' => $query->whereIn('created_by', $orgTutorIds),

            default => $query->whereRaw('1 = 0'), // fail-closed
        };
    }

    /**
     * Apply FINANCE-ONLY isolation — the accountant (kế toán) view over the org (design §2.1, §5 QĐ 3,
     * §6 risk 2). An accountant is least-privilege: they may READ money + student billing across the
     * WHOLE org, but are FAIL-CLOSED on every teaching resource. This is a deliberately SEPARATE branch
     * from applyOrgIsolation() — putting the accountant into isOrgViewerAll() instead would expose
     * classes/attendance/grades, which is exactly what this role must never see.
     *
     * Finance arms scope to the org (same anchor as the owner/manager view):
     *  - payments          → whereHas('class', organization_id = org)
     *  - payment_requests  → whereHas('class', organization_id = org)  (org-scoped read path; the
     *                         class-scoped controller endpoints allow the accountant via a finance guard)
     *  - students          → org students (created by a member OR enrolled in an org class); the
     *                         StudentResource is trimmed of teaching-derived fields for this viewer.
     *
     * EVERY teaching resource (classes/attendances/assignments/grades/submissions/lesson_notes/
     * schedules/learning_resources/notifications) AND anything unknown → whereRaw('1=0'). Listing them
     * explicitly (rather than relying on the default) documents the fail-closed contract and stops a
     * future arm added to applyOrgIsolation from silently leaking into the accountant's view.
     */
    private function applyOrgFinanceIsolation(Builder $query, string $resource, ?Organization $org): Builder
    {
        if (! $org) {
            return $query->whereRaw('1 = 0'); // fail-closed: no org context
        }

        $orgId = $org->id;
        $orgTutorIds = $this->orgTutorIds($org);

        return match ($resource) {
            // --- Finance / billing: the ONLY things an accountant may read. ---
            'payments', 'payment_requests' => $query->whereHas('class', function ($q) use ($orgId) {
                $q->where('organization_id', $orgId);
            }),

            // center_expenses is FINANCE — the accountant sees the org's expenses too (design §2.5,
            // §5 QĐ3: finance write is even allowed). EXPLICIT org-column arm (never default deny,
            // which would hide all expenses from the very role meant to manage them).
            'center_expenses' => $query->where('organization_id', $orgId),

            // PAYROLL READ (Wave 3): the accountant is the FINANCE person, so they may READ the org's pay
            // runs and payslips (org-column anchor, pattern b) to reconcile cost — but NOT set pay rules.
            // EXPLICIT org arm (never default deny, which would hide payroll from the finance role).
            'payroll_periods', 'payroll_items' => $query->where('organization_id', $orgId),

            'students' => $query->where(function ($q) use ($orgId, $orgTutorIds) {
                $q->whereIn('created_by', $orgTutorIds)
                    ->orWhereHas('classes', function ($c) use ($orgId) {
                        $c->where('organization_id', $orgId);
                    });
            }),

            // --- Teaching data: explicitly FAIL-CLOSED for the accountant. ---
            // tutor_compensation_profiles (rate rules) + payroll_adjustments are OWNER/MANAGER-only in v1
            // (owner/manager SET pay; the accountant reconciles, design §2.4) → fail-closed here too.
            'classes', 'attendances', 'assignments', 'grades', 'submissions',
            'lesson_notes', 'schedules', 'learning_resources', 'notifications',
            'tutor_compensation_profiles', 'payroll_adjustments' => $query->whereRaw('1 = 0'),

            default => $query->whereRaw('1 = 0'), // fail-closed
        };
    }

    /**
     * IDs of users who are ACTIVE members of $org (owner + managers + tutors). Request-scoped cache.
     * Mirrors getGuardianStudentIds(). Used as the tutor-set for org isolation.
     *
     * @return array<int>
     */
    protected function orgTutorIds(?Organization $org = null): array
    {
        $org = $org ?? $this->getAuthUser()?->currentOrganization();
        if (! $org) {
            return [];
        }

        if (! array_key_exists($org->id, $this->orgTutorIdsCache)) {
            $this->orgTutorIdsCache[$org->id] = array_map('intval', $org->activeMemberUserIds());
        }

        return $this->orgTutorIdsCache[$org->id];
    }

    /**
     * Whether the CURRENT caller is an org viewer (owner/manager) AND $student belongs to their org
     * (created by a member OR enrolled in a class of the org). Fail-closed helper for the inline
     * *ByStudent ownership checks that don't route through guardStudentAccess.
     */
    protected function orgOwnsStudent(?Student $student): bool
    {
        $user = $this->getAuthUser();
        if (! $user || ! $student || ! $user->isOrgViewerAll()) {
            return false;
        }

        return $this->studentBelongsToCurrentOrg($student);
    }

    /**
     * FINANCE-ONLY variant of orgOwnsStudent: does the caller's org own $student AND is the caller an
     * ACCOUNTANT? Kept SEPARATE from orgOwnsStudent on purpose — the teaching per-student access checks
     * (GradeController / AttendanceController) call orgOwnsStudent, which stays gated on isOrgViewerAll()
     * so an accountant can NEVER pull grades/attendance through them. This one only fronts the billing
     * student read in StudentController.
     */
    protected function orgFinanceOwnsStudent(?Student $student): bool
    {
        $user = $this->getAuthUser();
        if (! $user || ! $student || ! $user->isOrgAccountant()) {
            return false;
        }

        return $this->studentBelongsToCurrentOrg($student);
    }

    /**
     * Core org-membership test for a student, shared by orgOwnsStudent / orgFinanceOwnsStudent:
     * created by an active member OR enrolled in a class of the caller's current org.
     */
    private function studentBelongsToCurrentOrg(Student $student): bool
    {
        $org = $this->getAuthUser()?->currentOrganization();
        if (! $org) {
            return false;
        }

        if (in_array((int) $student->created_by, $this->orgTutorIds($org), true)) {
            return true;
        }

        return $student->classes()->where('organization_id', $org->id)->exists();
    }

    /**
     * Whether the caller is an org ACCOUNTANT AND $class belongs to their org — the finance-read gate
     * for billing endpoints that are class-scoped (payment-requests). Kept separate from
     * guardClassAccess (a TEACHING guard that fails accountants closed): an accountant may read a
     * class's billing without gaining any teaching access. Fail-closed for a solo/cross-org class.
     */
    protected function callerIsOrgFinanceForClass(?ClassRoom $class): bool
    {
        $user = $this->getAuthUser();
        if (! $user || ! $class || ! $user->isOrgAccountant()) {
            return false;
        }

        $org = $user->currentOrganization();

        return $org
            && $class->organization_id !== null
            && (int) $class->organization_id === (int) $org->id;
    }

    /**
     * Require the caller to hold one of the given org_roles in their CURRENT organization.
     * Returns a 403 error response otherwise (building block for org endpoints). Never trusts input.
     */
    protected function requireOrgRole(array $roles): ?JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user || ! $user->belongsToOrganization() || ! in_array($user->orgRole(), $roles, true)) {
            return $this->errorResponse('Bạn không có quyền thực hiện hành động này', null, 'FORBIDDEN', 403);
        }

        return null;
    }

    /**
     * Apply Tutor isolation rules.
     * Tutor: chỉ thấy dữ liệu của chính họ (tutor_id = user->id).
     */
    private function applyTutorIsolation(Builder $query, string $resource): Builder
    {
        $user = $this->getAuthUser();

        switch ($resource) {
            case 'classes':
                $query->where('tutor_id', $user->id);
                break;
            case 'attendances':
            case 'assignments':
            case 'grades':
            case 'lesson_notes':
            case 'schedules':
            case 'payments':
                $query->whereHas('class', function ($q) use ($user) {
                    $q->where('tutor_id', $user->id);
                });
                break;
            case 'submissions':
                $query->whereHas('assignment', function ($q) use ($user) {
                    $q->whereHas('class', function ($subQ) use ($user) {
                        $subQ->where('tutor_id', $user->id);
                    });
                });
                break;
            case 'learning_resources':
                $query->where('tutor_id', $user->id);
                break;
            case 'payroll_items':
                // A member-tutor sees ONLY their OWN payslips (design §2.4, §5 QĐ 8). The my-payslips
                // controller narrows this further to status=approved (draft is hidden until chosen). A
                // member-tutor is fail-closed on periods/profiles/adjustments (no case here → the switch
                // leaves the query unfiltered, so those resources are NEVER routed through this method
                // for a member-tutor; their controllers gate on owner/manager instead).
                $query->where('user_id', $user->id);
                break;
            case 'students':
                // Query students who are enrolled in tutor's classes or created by the tutor
                $query->where(function ($q) use ($user) {
                    $q->where('created_by', $user->id)
                        ->orWhereHas('classes', function ($subQ) use ($user) {
                            $subQ->where('tutor_id', $user->id);
                        });
                });
                break;
            case 'notifications':
                $query->where(function ($q) use ($user) {
                    // Mỗi tutor chỉ thấy thông báo do họ tạo hoặc gửi tới lớp/học viên của họ
                    $q->where('created_by', $user->id);

                    $classIds = ClassRoom::where('tutor_id', $user->id)
                        ->pluck('id')
                        ->toArray();

                    if (! empty($classIds)) {
                        $q->orWhere(function ($subQuery) use ($classIds) {
                            $subQuery->where('recipient_type', 'classes')
                                ->whereNotNull('recipient_classes')
                                ->where(function ($classQuery) use ($classIds) {
                                    foreach ($classIds as $classId) {
                                        $classQuery->orWhereJsonContains('recipient_classes', $classId);
                                    }
                                });
                        });
                    }

                    $students = Student::whereHas('classes', function ($studentQuery) use ($user) {
                        $studentQuery->where('tutor_id', $user->id);
                    })
                        ->get(['id', 'user_id']);

                    $studentIds = $students->pluck('id')->toArray();
                    $studentUserIds = $students->pluck('user_id')
                        ->filter()
                        ->toArray();

                    if (! empty($studentIds)) {
                        $q->orWhere(function ($subQuery) use ($studentIds) {
                            $subQuery->where('recipient_type', 'students')
                                ->whereNotNull('recipient_students')
                                ->where(function ($studentIdQuery) use ($studentIds) {
                                    foreach ($studentIds as $studentId) {
                                        $studentIdQuery->orWhereJsonContains('recipient_students', $studentId);
                                    }
                                });
                        });
                    }

                    if (! empty($studentUserIds)) {
                        $q->orWhere(function ($subQuery) use ($studentUserIds) {
                            $subQuery->whereNotNull('recipient_ids')
                                ->where(function ($recipientQuery) use ($studentUserIds) {
                                    foreach ($studentUserIds as $studentUserId) {
                                        $recipientQuery->orWhereJsonContains('recipient_ids', $studentUserId);
                                    }
                                });
                        });
                    }
                });
                break;
        }

        return $query;
    }

    /**
     * Apply Student isolation rules.
     * Student: chỉ thấy dữ liệu của chính họ (từ các lớp họ tham gia).
     */
    private function applyStudentIsolation(Builder $query, string $resource): Builder
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        // Lấy student profile của user (cached)
        $student = $this->getCurrentStudent();

        if (! $student) {
            // Nếu không tìm thấy student profile, có thể do:
            // 1. Student record chưa được liên kết với user account
            // 2. Hoặc student chưa có profile
            // Với payments và reports, vẫn cần student_id, nên return empty
            return $query->whereRaw('1 = 0'); // No student profile = no access
        }

        // Lấy các lớp học mà student tham gia (cached)
        $classIds = $this->getStudentClassIds($student);

        return match ($resource) {
            // Classes: chỉ các lớp họ tham gia (nếu có)
            'classes' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('id', $classIds),

            // Assignments: từ các lớp họ tham gia (nếu có) VÀ chỉ assignments đã published hoặc closed (không cho xem draft)
            'assignments' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('class_id', $classIds)
                    ->whereIn('status', ['published', 'closed']),

            // Grades: chỉ điểm của chính họ
            'grades' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->where('student_id', $student->id)
                    ->whereIn('class_id', $classIds),

            // Submissions: chỉ bài nộp của chính họ
            'submissions' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->where('student_id', $student->id)
                    ->whereHas('assignment', function ($q) use ($classIds) {
                        $q->whereIn('class_id', $classIds);
                    }),

            // Schedules: từ các lớp họ tham gia (nếu có)
            'schedules' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('class_id', $classIds),

            // Attendances: chỉ điểm danh của chính họ
            'attendances' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->where('student_id', $student->id)
                    ->whereIn('class_id', $classIds),

            // Lesson Notes: từ các lớp họ tham gia (nếu có)
            'lesson_notes' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereIn('class_id', $classIds),

            // Learning Resources: từ các lớp họ tham gia (nếu có liên kết)
            'learning_resources' => empty($classIds)
                ? $query->whereRaw('1 = 0')
                : $query->whereHas('classes', function ($q) use ($classIds) {
                    $q->whereIn('classes.id', $classIds);
                })->orWhereHas('assignments', function ($q) use ($classIds) {
                    $q->whereIn('class_id', $classIds);
                }),

            // Notifications: chỉ notifications có target là 'student' hoặc 'all'
            // và phải match với recipient_students, recipient_classes, hoặc recipient_ids
            'notifications' => $query->whereIn('target', ['student', 'all'])
                ->where(function ($q) use ($student, $classIds) {
                    $q->where(function ($q2) {
                        // recipient_type = 'all' hoặc null → cho phép tất cả
                        $q2->where('recipient_type', 'all')
                            ->orWhereNull('recipient_type');
                    })
                        ->orWhere(function ($q2) use ($student) {
                            // recipient_type = 'students' và recipient_students chứa student ID
                            $q2->where('recipient_type', 'students')
                                ->whereNotNull('recipient_students')
                                ->whereJsonContains('recipient_students', $student->id);
                        })
                        ->orWhere(function ($q2) use ($classIds) {
                            // recipient_type = 'classes' và recipient_classes chứa class ID mà student tham gia
                            if (! empty($classIds)) {
                                $q2->where('recipient_type', 'classes')
                                    ->whereNotNull('recipient_classes')
                                    ->where(function ($q3) use ($classIds) {
                                        foreach ($classIds as $classId) {
                                            $q3->orWhereJsonContains('recipient_classes', $classId);
                                        }
                                    });
                            } else {
                                $q2->whereRaw('1 = 0'); // Không có class nào → không có quyền
                            }
                        })
                        ->orWhere(function ($q2) use ($student) {
                            // recipient_ids chứa user_id của student
                            $q2->whereNotNull('recipient_ids')
                                ->whereJsonContains('recipient_ids', $student->user_id);
                        });
                }),

            // Payments: chỉ payments của chính họ (KHÔNG cần classIds)
            'payments' => $query->where('student_id', $student->id),

            // Students: chỉ thông tin của chính họ
            'students' => $query->where('id', $student->id),

            default => $query->whereRaw('1 = 0'), // No access to other resources
        };
    }

    /**
     * Check if user can manage resource.
     */
    protected function canManageResource($resource): bool
    {
        $user = $this->getAuthUser();

        if (! $resource || ! $user) {
            return false;
        }

        // Super Admin can manage everything
        if ($user->hasRole('super_admin')) {
            return true;
        }

        // Organization owner/manager: may manage any resource that belongs to their org.
        // MUST be BEFORE isTutor() (owner/manager have role=tutor) — otherwise they'd be locked to
        // their own tutor_id and couldn't manage member tutors' classes (design R1).
        if ($user->isOrgViewerAll()) {
            return $this->orgCanManageResource($resource);
        }

        // Accountant: FINANCE-ONLY, read-only in Wave 1 — MANAGES NOTHING (least-privilege; even
        // finance mutations like refunds stay owner/manager, design §5 QĐ 3). MUST be before isTutor()
        // (shared User.role=tutor) so they can't fall through and manage a resource they authored.
        if ($user->isOrgAccountant()) {
            return false;
        }

        // Tutor: chỉ có thể quản lý resources do họ tạo (tutor_id = user->id)
        if ($user->isTutor()) {
            $tutorId = $resource->tutor_id ?? null;

            // Tutor CHỈ có thể quản lý resources có tutor_id = user->id
            if (! is_null($tutorId) && (int) $tutorId === (int) $user->id) {
                return true;
            }

            // For resources without tutor_id, check created_by or other ownership
            if (isset($resource->created_by) && (int) $resource->created_by === (int) $user->id) {
                return true;
            }

            // Check if it's a student and if the tutor teaches that student
            if ($resource instanceof Student) {
                return $resource->classes()->where('tutor_id', $user->id)->exists();
            }

            // Check if it's a class and if the tutor teaches that class
            if ($resource instanceof ClassRoom) {
                return $resource->tutor_id === $user->id;
            }
        }

        // Student: chỉ có thể XEM (không quản lý) dữ liệu của chính họ
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();

            if (! $student) {
                return false;
            }

            // Lấy các lớp học mà student tham gia (cached)
            $classIds = $this->getStudentClassIds($student);

            if (empty($classIds)) {
                return false;
            }

            // Student có thể XEM:
            // - Classes: các lớp họ tham gia
            if ($resource instanceof ClassRoom) {
                return in_array($resource->id, $classIds);
            }

            // - Assignments, Schedules: từ các lớp họ tham gia
            if ($resource instanceof Assignment || $resource instanceof Schedule) {
                return in_array($resource->class_id ?? null, $classIds);
            }

            // - Grades, Submissions, Attendances: chỉ của chính họ
            if ($resource instanceof Grade ||
                $resource instanceof Submission ||
                $resource instanceof Attendance) {
                return ($resource->student_id ?? null) === $student->id
                    && in_array($resource->class_id ?? null, $classIds);
            }
        }

        return false;
    }

    /**
     * Org owner/manager management check: may the caller manage $resource because it belongs to
     * their organization? Fail CLOSED for anything outside the org (cross-org → false → 404 upstream).
     */
    private function orgCanManageResource($resource): bool
    {
        $user = $this->getAuthUser();
        $org = $user?->currentOrganization();
        if (! $org) {
            return false;
        }

        $orgId = (int) $org->id;

        // A center expense of the org (org-column anchor, design §2.5). Checked EARLY — before the
        // generic created_by fallback — so owner/manager/accountant write rules stay strictly
        // org-bounded (its created_by would otherwise match any member). Fail-closed cross-org.
        if ($resource instanceof CenterExpense) {
            return (int) $resource->organization_id === $orgId;
        }

        // PAYROLL (Wave 3) — money that is MEMBER-anchored (design §2.4, §6 risk 1). All four payroll
        // models carry their own organization_id, so manage-ability is a STRICT org-column match checked
        // EARLY (before any created_by / tutor_id fallback that would otherwise match a member and leak a
        // cross-org payslip). Fail-closed for a solo/cross-org row.
        if ($resource instanceof TutorCompensationProfile
            || $resource instanceof PayrollPeriod
            || $resource instanceof PayrollItem
            || $resource instanceof PayrollAdjustment) {
            return (int) $resource->organization_id === $orgId;
        }

        // A class of the org.
        if ($resource instanceof ClassRoom) {
            return (int) $resource->organization_id === $orgId;
        }

        // A student of the org (created by a member OR enrolled in an org class).
        if ($resource instanceof Student) {
            return $this->orgOwnsStudent($resource);
        }

        // Class-scoped children (grade/attendance/assignment/schedule/lesson_note/payment): follow the class.
        if (isset($resource->class_id) && $resource->class_id) {
            $class = $resource->class ?? ClassRoom::find($resource->class_id);

            return $class && (int) $class->organization_id === $orgId;
        }

        // Tutor-anchored resources (learning_resources, notifications): owned by a member.
        if (isset($resource->tutor_id) && $resource->tutor_id) {
            return in_array((int) $resource->tutor_id, $this->orgTutorIds($org), true);
        }

        if (isset($resource->created_by) && $resource->created_by) {
            return in_array((int) $resource->created_by, $this->orgTutorIds($org), true);
        }

        return false;
    }

    /**
     * Check limits before creating a resource.
     *
     * Single-tenant outsource build: authorization is role-based, so no per-account limit gate is
     * applied here — always allows.
     */
    protected function checkSubscriptionLimits(string $resourceType): ?JsonResponse
    {
        return null;
    }

    /**
     * Check if the current user is allowed for a capability key.
     *
     * Single-tenant outsource build: capability keys resolve to role-based permissions, so no
     * package gating is applied here — always allows.
     */
    protected function requirePlanCapability(string $capabilityKey): ?JsonResponse
    {
        return null;
    }

    /**
     * Monthly AI-call quota gate. Single-tenant outsource build: no per-account AI cap is applied
     * here — always allows; the global throttle middleware on AI routes (see api_v1.php) still
     * bounds request volume.
     */
    protected function requireAiQuota(User $user, ?string $feature = null): ?JsonResponse
    {
        return null;
    }

    /**
     * Check if user has a specific permission.
     * Works with any guard by checking directly in permissions and roles.
     *
     * @param  string  $permission  Permission name (e.g., 'create_assignment::type')
     */
    protected function hasPermission(User $user, string $permission): bool
    {
        // Check directly in user's permissions (works with any guard)
        $hasPermission = $user->permissions()
            ->where('name', $permission)
            ->exists();

        // Also check via roles (permissions inherited from roles)
        if (! $hasPermission) {
            $hasPermission = $user->roles()
                ->whereHas('permissions', function ($query) use ($permission) {
                    $query->where('name', $permission);
                })
                ->exists();
        }

        return $hasPermission;
    }

    /**
     * Check permission and return error response if not authorized.
     *
     * @param  string  $permission  Permission name
     * @param  string  $errorMessage  Error message to return
     * @return JsonResponse|null Returns error response if not authorized, null if OK
     */
    protected function requirePermission(User $user, string $permission, string $errorMessage = 'Bạn không có quyền thực hiện hành động này'): ?JsonResponse
    {
        if (! $this->hasPermission($user, $permission)) {
            return $this->errorResponse($errorMessage, null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Helper to ensure API user is authenticated.
     * Cached per request to avoid multiple auth() calls.
     *
     * @return array{0:User|null,1:JsonResponse|null}
     */
    protected function requireAuth(): array
    {
        // auth('api') already memoizes the resolved user for the current request.
        $user = auth('api')->user();

        if (! $user) {
            return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 401)];
        }

        return [$user, null];
    }

    /**
     * Get authenticated user (cached per request).
     *
     * @return User|null
     */
    protected function getAuthUser()
    {
        // auth('api') already memoizes the resolved user for the current request.
        return auth('api')->user();
    }

    /**
     * Ensure the caller may access data scoped to $class. Fails CLOSED for every role that
     * isn't the owning tutor, an enrolled student, or a super admin. Returns a 404 error
     * response (never leaks existence) when denied, or null when allowed.
     */
    protected function guardClassAccess(?ClassRoom $class): ?JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user || ! $class) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isSuperAdmin()) {
            return null;
        }

        // Org owner/manager: may access any class in THEIR org. MUST be before isTutor() (R1) —
        // owner/manager have role=tutor and would otherwise 404 on other members' classes.
        // Fail-closed 404 for a class of another org OR a solo class (organization_id = NULL).
        if ($user->isOrgViewerAll()) {
            return ((int) $class->organization_id === (int) $user->currentOrganization()?->id
                && $class->organization_id !== null)
                ? null
                : $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        // Accountant: FINANCE-ONLY — never teaching-class access. MUST be before isTutor() (they share
        // User.role=tutor). Fail-closed 404 for every class (billing endpoints use a finance guard).
        if ($user->isOrgAccountant()) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isTutor()) {
            return ((int) $class->tutor_id === (int) $user->id)
                ? null
                : $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student && in_array($class->id, $this->getStudentClassIds($student), true)) {
                return null;
            }
        }

        // Parent: may view a class only if one of their guarded children is enrolled in it.
        if ($user->isParent()) {
            $guardedIds = $this->getGuardianStudentIds();
            if (! empty($guardedIds)
                && $class->students()->whereIn('students.id', $guardedIds)->exists()) {
                return null;
            }
        }

        return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
    }

    /**
     * NHÂN SỰ-ONLY class access — dùng cho những endpoint trả dữ liệu của CẢ LỚP, đặc biệt là
     * danh sách học viên (roster) chứa PII: số điện thoại, email, địa chỉ nhà, tên phụ huynh và
     * ghi chú sư phạm riêng của giáo viên về từng em.
     *
     * Vì sao cần guard riêng: canManageResource() và guardClassAccess() đều CHO HỌC VIÊN ĐÃ GHI DANH
     * đi qua (đúng với "xem dữ liệu lớp của mình", sai với "xem hồ sơ mọi bạn cùng lớp"). Cùng cái bẫy
     * này đã được xử lý riêng ở GradeController::gradebook. Ở đây ta chặn học viên/phụ huynh TRƯỚC,
     * rồi ủy quyền phần còn lại cho guardClassAccess() để giữ nguyên nhánh org owner/manager —
     * nếu khoá cứng theo tutor_id như gradebook thì chủ trung tâm sẽ mất quyền xem lớp của GV thành viên.
     *
     * Fail-closed 404 (không lộ sự tồn tại của lớp).
     */
    protected function guardClassStaffAccess(?ClassRoom $class): ?JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user || ! $class) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isStudent() || $user->isParent()) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        return $this->guardClassAccess($class);
    }

    /**
     * Boolean form of guardClassAccess: may the caller VIEW data scoped to $class?
     * (owning tutor, enrolled student, or super admin). Mutations should use canManageResource() instead.
     */
    protected function callerCanViewClass(?ClassRoom $class): bool
    {
        return $this->guardClassAccess($class) === null;
    }

    /**
     * Ensure the caller may view $student's data. Tutor must teach the student; a student user
     * may only access their own record; super admin passes. 404 (no existence leak) otherwise.
     */
    protected function guardStudentAccess(?Student $student): ?JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user || ! $student) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isSuperAdmin()) {
            return null;
        }

        // Org owner/manager: may access any student in THEIR org. MUST be before isTutor() (R1).
        // Fail-closed 404 for a student outside the org.
        if ($user->isOrgViewerAll()) {
            return $this->orgOwnsStudent($student)
                ? null
                : $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        // Accountant: FINANCE-ONLY. This guard fronts TEACHING per-student endpoints (grades /
        // attendance / payments-by-student). Fail-closed 404 here so an accountant can NEVER pull a
        // student's teaching records. Billing-relevant student reads go through StudentController's own
        // finance-aware access check, not this guard. MUST be before isTutor() (shared User.role).
        if ($user->isOrgAccountant()) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isTutor()) {
            // Owner if the tutor created the student OR teaches a class the student is in
            // (matches canManageResource / applyTutorIsolation('students')).
            $owns = (int) $student->created_by === (int) $user->id
                || $student->classes()->where('tutor_id', $user->id)->exists();

            return $owns
                ? null
                : $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($user->isStudent()) {
            $own = $this->getCurrentStudent();
            if ($own && (int) $own->id === (int) $student->id) {
                return null;
            }
        }

        // Parent: may access only students they actively guard (guardian_student). Fail-closed 404.
        if ($user->isParent()) {
            if (in_array((int) $student->id, $this->getGuardianStudentIds(), true)) {
                return null;
            }
        }

        return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
    }

    /**
     * Get student profile for current user (cached per request to avoid duplicate queries).
     *
     * @return Student|null
     */
    protected function getCurrentStudent()
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return null;
        }

        $userId = $user->id;
        if (! isset($this->currentStudentCache[$userId])) {
            $this->currentStudentCache[$userId] = Student::where('user_id', $userId)->first();
        }

        return $this->currentStudentCache[$userId];
    }

    /**
     * Get class IDs that student is enrolled in (cached per request).
     */
    protected function getStudentClassIds(?Student $student = null): array
    {
        if (! $student) {
            $student = $this->getCurrentStudent();
        }

        if (! $student) {
            return [];
        }

        $studentId = $student->id;
        if (! isset($this->studentClassIdsCache[$studentId])) {
            $this->studentClassIdsCache[$studentId] = Enrollment::where('student_id', $studentId)
                ->pluck('class_id')
                ->toArray();
        }

        return $this->studentClassIdsCache[$studentId];
    }

    /**
     * IDs of students the current PARENT user guards (active links only), request-scoped cache.
     * This is the parent analogue of getStudentClassIds — the sole source of truth for parent access.
     *
     * @return array<int>
     */
    protected function getGuardianStudentIds(): array
    {
        if ($this->guardianStudentIdsCache !== null) {
            return $this->guardianStudentIdsCache;
        }

        $user = $this->getAuthUser();
        if (! $user || ! $user->isParent()) {
            return $this->guardianStudentIdsCache = [];
        }

        return $this->guardianStudentIdsCache = Student::query()
            ->whereHas('guardians', fn ($q) => $q->where('users.id', $user->id))
            ->pluck('id')
            ->all();
    }

    /**
     * Resolve which student a *ByStudent endpoint should target:
     *  - a logged-in student → their own record;
     *  - a parent → the requested ?student_id child, AFTER guardStudentAccess() (never trust the hashid);
     *  - a tutor/admin → the route-bound student passed in.
     * Returns [Student|null, JsonResponse|null] — the error is a fail-closed 404 when denied.
     */
    protected function resolveTargetStudent(?Student $routeStudent = null): array
    {
        $user = $this->getAuthUser();

        if ($user && $user->isStudent()) {
            $own = $this->getCurrentStudent();

            return $own ? [$own, null] : [null, $this->errorResponse('Không tìm thấy học viên', null, 'NOT_FOUND', 404)];
        }

        $student = $routeStudent;
        if (! $student) {
            return [null, $this->errorResponse('Không tìm thấy học viên', null, 'NOT_FOUND', 404)];
        }

        if ($denied = $this->guardStudentAccess($student)) {
            return [null, $denied];
        }

        return [$student, null];
    }

    /**
     * Check if student is enrolled in a specific class (cached per request).
     */
    protected function isStudentEnrolledInClass(?Student $student, int $classId): bool
    {
        if (! $student) {
            $student = $this->getCurrentStudent();
        }

        if (! $student) {
            return false;
        }

        $cacheKey = $student->id.'_'.$classId;
        if (! isset($this->enrollmentCache[$cacheKey])) {
            // Sử dụng method có sẵn trong Student model
            $this->enrollmentCache[$cacheKey] = $student->isEnrolledIn($classId);
        }

        return $this->enrollmentCache[$cacheKey];
    }

    /**
     * Format percentage value (0-100).
     */
    protected function formatPercentage(float|int|null $value, int $decimals = 2): string
    {
        if ($value === null) {
            return number_format(0, $decimals, '.', '');
        }

        $value = max(0, min(100, (float) $value));

        return number_format($value, $decimals, '.', '');
    }

    /**
     * Format decimal value.
     */
    protected function formatDecimal(float|int|null $value, int $decimals = 2): string
    {
        if ($value === null) {
            return number_format(0, $decimals, '.', '');
        }

        return number_format((float) $value, $decimals, '.', '');
    }

    /**
     * Format integer value.
     */
    protected function formatInteger(?int $value, bool $withCommas = false): string
    {
        if ($value === null) {
            return '0';
        }

        if ($withCommas) {
            return number_format($value, 0, ',', '.');
        }

        return (string) $value;
    }

    /**
     * Check if current user has permission from a capability key.
     *
     * Single-tenant outsource build: authorization is role-based (Spatie). Capability keys are
     * retained only as compatibility hooks; tutor-side callers are granted, students are read-only.
     *
     * @param  string  $capabilityKey  Capability key (e.g., 'classes.manage')
     */
    protected function userHasPermissionFromCapability(string $capabilityKey): bool
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        // Students are read-only (callers already gate view separately).
        return ! $user->isStudent();
    }

    /**
     * Build permissions with both can_view and can_manage.
     *
     * Logic:
     * - Học viên: can_view = true (nếu có quyền xem qua data isolation), can_manage = false
     * - Tutor: can_view = true, can_manage = based on capability
     * - Super Admin: can_view = true, can_manage = true
     *
     * @param  string  $capabilityKey  Capability key for manage permission (e.g., 'subjects.manage')
     * @param  bool  $studentsCanView  If true, students can view (read-only). Default: true
     * @return array ['can_view' => bool, 'can_manage' => bool]
     */
    protected function buildViewAndManagePermissions(string $capabilityKey, bool $studentsCanView = true): array
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return ['can_view' => false, 'can_manage' => false];
        }

        // Super Admin: full access
        if ($user->hasRole('super_admin')) {
            return ['can_view' => true, 'can_manage' => true];
        }

        // Học viên: có thể xem (read-only) nếu được phép
        if ($user->isStudent()) {
            return [
                'can_view' => $studentsCanView,
                'can_manage' => false,
            ];
        }

        // Tutor: có thể xem, manage dựa trên permission từ role capability
        $canManage = $this->userHasPermissionFromCapability($capabilityKey);

        return [
            'can_view' => true,
            'can_manage' => $canManage,
        ];
    }

    /**
     * Alias for buildViewAndManagePermissions() - shorter name for convenience.
     *
     * @param  string  $manageCapability  Capability key for manage permission
     * @param  string|null  $viewCapability  Optional capability key for view permission (if different)
     * @param  bool  $studentsCanView  If true, students can view (read-only). Default: true
     * @return array ['can_view' => bool, 'can_manage' => bool]
     */
    protected function buildViewManagePermissions(string $manageCapability, ?string $viewCapability = null, bool $studentsCanView = true): array
    {
        // If view capability is different, check both
        if ($viewCapability !== null && $viewCapability !== $manageCapability) {
            $user = $this->getAuthUser();

            if (! $user) {
                return ['can_view' => false, 'can_manage' => false];
            }

            if ($user->hasRole('super_admin')) {
                return ['can_view' => true, 'can_manage' => true];
            }

            if ($user->isStudent()) {
                return [
                    'can_view' => $studentsCanView,
                    'can_manage' => false,
                ];
            }

            return [
                'can_view' => $this->userHasPermissionFromCapability($viewCapability),
                'can_manage' => $this->userHasPermissionFromCapability($manageCapability),
            ];
        }

        // Default: use same capability for both view and manage
        return $this->buildViewAndManagePermissions($manageCapability, $studentsCanView);
    }

    /**
     * Build permissions array for multiple capabilities.
     *
     * @param  array  $capabilities  Array of ['key' => 'capability_key'] or ['key' => ['capability' => 'key', 'onlyForNonStudents' => true]]
     */
    protected function buildMultiplePermissions(array $capabilities): array
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return array_fill_keys(array_keys($capabilities), false);
        }

        $permissions = [];

        foreach ($capabilities as $key => $config) {
            if (is_string($config)) {
                // Simple format: 'key' => 'capability_key'
                $capabilityKey = $config;
                $onlyForNonStudents = true;
            } else {
                // Advanced format: 'key' => ['capability' => 'key', 'onlyForNonStudents' => true]
                $capabilityKey = $config['capability'] ?? $config;
                $onlyForNonStudents = $config['onlyForNonStudents'] ?? true;
            }

            if ($onlyForNonStudents && $user->isStudent()) {
                $permissions[$key] = false;

                continue;
            }

            if ($user->isSuperAdmin()) {
                $permissions[$key] = true;

                continue;
            }

            // Single-tenant: role-based authorization; capability key retained for compatibility.
            $permissions[$key] = $this->userHasPermissionFromCapability($capabilityKey);
        }

        return $permissions;
    }
}
