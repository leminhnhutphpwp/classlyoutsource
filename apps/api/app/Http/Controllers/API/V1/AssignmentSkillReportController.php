<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Assignment;
use App\Models\Student;
use App\Services\AssignmentQuizService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Per-skill progress dashboard for tutors: for a quiz assignment, aggregate every student's
 * earned/max points per section_type (listening/reading/writing/speaking/general) in ONE query
 * on assignment_question_submissions, so the FE gets a ready-made heatmap without N+1 requests.
 */
class AssignmentSkillReportController extends BaseController
{
    public function __invoke(Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $assignment->loadMissing(['class', 'sections']);
        // Staff-only dashboard: canManageResource alone would let enrolled students through.
        if ($user->isStudent() || ! $this->canManageResource($assignment->class)) {
            // 404 (not 403) so a cross-tenant probe cannot confirm the assignment exists.
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        // One grouped aggregate over the answer rows of each student's LATEST attempt; joins
        // resolve section_type per question. LEFT JOIN so graded but section-less questions
        // (flat quiz) still count under "general".
        $rows = DB::table('assignment_question_submissions as aqs')
            ->join('submissions as s', 's.id', '=', 'aqs.submission_id')
            ->join('assignment_questions as q', 'q.id', '=', 'aqs.question_id')
            ->leftJoin('assignment_sections as sec', 'sec.id', '=', 'q.section_id')
            ->join('students as st', 'st.id', '=', 's.student_id')
            ->join('users as u', 'u.id', '=', 'st.user_id')
            ->where('s.assignment_id', $assignment->id)
            ->whereIn('s.id', function ($query) use ($assignment) {
                // Latest attempt per student — older retakes must not double-count.
                $query->selectRaw('MAX(id)')
                    ->from('submissions')
                    ->where('assignment_id', $assignment->id)
                    ->groupBy('student_id');
            })
            ->groupBy('s.student_id', 'u.name', 'skill')
            ->selectRaw("
                s.student_id,
                u.name as student_name,
                COALESCE(sec.section_type, 'general') as skill,
                SUM(aqs.score) as earned,
                SUM(COALESCE(aqs.meta->>'$.max_points', 0)) as possible,
                COUNT(*) as answered
            ")
            ->get();

        // Manual rows are graded later (status pending): their meta has max_points but score 0.
        // We surface per-student totals too so the FE can sort and show a per-student bar.
        $students = [];
        foreach ($rows as $row) {
            $rawStudentId = (int) $row->student_id;
            $studentId = Student::encodeId($rawStudentId);
            if (! isset($students[$studentId])) {
                $students[$studentId] = [
                    'student_id' => $studentId,
                    'raw_student_id' => $rawStudentId,
                    'student_name' => $row->student_name,
                    'skills' => [],
                    'earned' => 0.0,
                    'possible' => 0.0,
                    'percent' => 0,
                    'attempt_count' => 0,
                ];
            }
            $skills = &$students[$studentId]['skills'];
            $skills[$row->skill] ??= ['earned' => 0.0, 'possible' => 0.0];
            $skills[$row->skill]['earned'] += (float) $row->earned;
            $skills[$row->skill]['possible'] += (float) $row->possible;
            $students[$studentId]['earned'] += (float) $row->earned;
            $students[$studentId]['possible'] += (float) $row->possible;
            unset($skills);
        }

        // Attempt counts from the submissions table (distinct attempts per student).
        $attemptCounts = DB::table('submissions')
            ->where('assignment_id', $assignment->id)
            ->groupBy('student_id')
            ->selectRaw('student_id, COUNT(*) as attempts')
            ->pluck('attempts', 'student_id');

        foreach ($students as &$student) {
            // skills: list of {type, earned, possible, percent} rows (FE-friendly shape).
            $skillRows = [];
            foreach ($student['skills'] as $type => $skill) {
                $skill['type'] = $type;
                $skill['percent'] = $skill['possible'] > 0
                    ? (int) round($skill['earned'] / $skill['possible'] * 100)
                    : 0;
                $skillRows[] = $skill;
            }
            usort($skillRows, fn ($a, $b) => $a['type'] <=> $b['type']);
            $student['skills'] = $skillRows;

            $student['percent'] = $student['possible'] > 0
                ? (int) round($student['earned'] / $student['possible'] * 100)
                : 0;
            $student['attempt_count'] = (int) ($attemptCounts[$student['raw_student_id']] ?? 0);
            unset($student['raw_student_id']);
        }
        unset($student);

        // Best attempt per student: keep the row set of the HIGHEST total (thi thử: lần đạt nhất).
        $students = array_values($students);
        usort($students, fn ($a, $b) => $b['percent'] <=> $a['percent']);

        return $this->successResponse([
            'assignment_id' => Assignment::encodeId($assignment->id),
            'students' => $students,
            'skills_present' => $assignment->sections->count() > 0
                ? $assignment->sections->pluck('section_type')->unique()->values()->all()
                : ['general'],
            'section_count' => $assignment->sections->count(),
        ]);
    }
}
