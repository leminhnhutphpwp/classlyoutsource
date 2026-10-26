<?php

namespace App\Services\Reports;

use App\Models\AssignmentQuestionSubmission;
use App\Models\AssignmentSection;
use App\Models\Submission;
use Illuminate\Support\Collection;

/**
 * Per-attempt skill breakdown for ONE submission, grouped by exam section_type
 * (listening / reading / writing / speaking; legacy flat quizzes fall into "general").
 * This is the student-facing aggregate that powers the result screen — it never
 * leaks answer keys or AI internals; correctness booleans stay with the review payload.
 */
class SkillReportBuilder
{
    /**
     * @return array{overall: array, skills: array<int, array>, strengths: array, improvements: array}
     */
    public function build(Submission $submission): array
    {
        $submission->loadMissing(['questionResponses.question.section']);

        $grouped = $this->groupBySkill($submission->questionResponses);

        $skills = $grouped
            ->map(fn (array $row) => $this->skillRow($row))
            ->values()
            ->all();

        $overallEarned = (float) $grouped->sum('earned');
        $overallPossible = (float) $grouped->sum('possible');

        $overall = [
            'earned' => $this->num($overallEarned),
            'possible' => $this->num($overallPossible),
            'percent' => $this->percent($overallEarned, $overallPossible),
            'label' => $this->label($overallEarned, $overallPossible),
        ];

        [$strengths, $improvements] = $this->rank($skills);

        return [
            'overall' => $overall,
            'skills' => $skills,
            'strengths' => $strengths,
            'improvements' => $improvements,
        ];
    }

    /**
     * Group the per-question responses by section_type (fallback "general" for flat quizzes).
     *
     * @return Collection<string, array{earned: float, possible: float}>
     */
    private function groupBySkill(Collection $responses): Collection
    {
        return $responses
            ->groupBy(function (AssignmentQuestionSubmission $row) {
                $section = $row->question?->section;

                return $section instanceof AssignmentSection && filled($section->section_type)
                    ? $section->section_type
                    : 'general';
            })
            ->map(function (Collection $rows, string $type) {
                return [
                    'type' => $type,
                    'earned' => (float) $rows->sum('score'),
                    'possible' => (float) $rows->sum(fn (AssignmentQuestionSubmission $row) => (float) ($row->meta['max_points'] ?? $row->question?->points ?? 0)),
                ];
            })
            ->sortByDesc('earned')
            ->sortByDesc(fn (array $row) => $this->percent($row['earned'], $row['possible']));
    }

    private function skillRow(array $row): array
    {
        $earned = (float) $row['earned'];
        $possible = (float) $row['possible'];

        return [
            'type' => $row['type'],
            'earned' => $this->num($earned),
            'possible' => $this->num($possible),
            'percent' => $this->percent($earned, $possible),
            'label' => $this->label($earned, $possible),
        ];
    }

    /**
     * Top skills (strengths) and bottom skills (improvements) by percentage, never empty.
     *
     * @return array{0: array, 1: array}
     */
    private function rank(array $skills): array
    {
        if (empty($skills)) {
            return [[], []];
        }

        $sorted = collect($skills)->sortByDesc('percent')->values();

        // Everything below the "Đạt" bar (or everything above it): split cleanly so each
        // column stays non-empty and no skill appears in both.
        if ($sorted->every(fn (array $s) => $s['percent'] < 60)) {
            return [[$sorted->first()], $sorted->slice(1)->values()->all()];
        }
        if ($sorted->every(fn (array $s) => $s['percent'] >= 60)) {
            return [$sorted->values()->all(), []];
        }

        $strengths = $sorted->filter(fn (array $s) => $s['percent'] >= 60)->values()->all();
        $improvements = $sorted->filter(fn (array $s) => $s['percent'] < 60)->values()->all();

        return [$strengths, $improvements];
    }

    private function percent(float $earned, float $possible): int
    {
        if ($possible <= 0) {
            return 0;
        }

        return (int) round(($earned / $possible) * 100);
    }

    private function label(float $earned, float $possible): string
    {
        $percent = $this->percent($earned, $possible);

        return match (true) {
            $percent >= 80 => 'Đạt tốt',
            $percent >= 60 => 'Đạt',
            $percent >= 40 => 'Cần cải thiện',
            default => 'Chưa đạt',
        };
    }

    /** Round floats to 2dp but keep whole numbers integral (matches grade() response style). */
    private function num(float $value): float|int
    {
        $rounded = round($value, 2);

        return abs($rounded - round($rounded)) < 0.005 ? (int) round($rounded) : $rounded;
    }
}
