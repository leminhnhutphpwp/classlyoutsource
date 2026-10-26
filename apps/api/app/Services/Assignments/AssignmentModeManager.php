<?php

namespace App\Services\Assignments;

use App\Models\Assignment;
use App\Services\Assignments\Contracts\AssignmentMode;
use Illuminate\Http\Request;
use InvalidArgumentException;

class AssignmentModeManager
{
    /**
     * @var array<string, AssignmentMode>
     */
    private array $resolvedModes = [];

    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? config('assignments', []);
    }

    public function resolve(?string $mode): AssignmentMode
    {
        $mode = $mode ?: $this->defaultMode();

        if (! isset($this->resolvedModes[$mode])) {
            $class = $this->config['modes'][$mode] ?? null;
            if (! $class) {
                throw new InvalidArgumentException("Assignment mode [{$mode}] chưa được cấu hình.");
            }

            $this->resolvedModes[$mode] = app($class);
        }

        return $this->resolvedModes[$mode];
    }

    public function modeFromRequest(Request $request, ?Assignment $assignment = null): AssignmentMode
    {
        $mode = $request->input('mode') ?: $assignment?->mode;

        return $this->resolve($mode);
    }

    public function modeFromAssignment(Assignment $assignment): AssignmentMode
    {
        return $this->resolve($assignment->mode);
    }

    public function defaultMode(): string
    {
        return $this->config['default_mode'] ?? 'standard';
    }
}
