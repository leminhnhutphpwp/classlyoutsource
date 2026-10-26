<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ExistsHashId implements ValidationRule
{
    protected string $modelClass;

    protected ?string $column;

    /**
     * Create a new rule instance.
     *
     * @param  string  $modelClass  The fully qualified model class name
     * @param  string|null  $column  The column to check (defaults to 'id')
     */
    public function __construct(string $modelClass, ?string $column = 'id')
    {
        $this->modelClass = $modelClass;
        $this->column = $column ?? 'id';
    }

    /**
     * Run the validation rule.
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) {
            return;
        }

        // Check if the model uses HasHashId trait
        $model = new $this->modelClass;

        if (! method_exists($model, 'findByHashId')) {
            $fail("The model {$this->modelClass} does not support HashID.");

            return;
        }

        // Try to find the model by HashID
        $found = $this->modelClass::findByHashId($value);

        if (! $found) {
            $fail("Trường {$attribute} không hợp lệ.");
        }
    }
}
