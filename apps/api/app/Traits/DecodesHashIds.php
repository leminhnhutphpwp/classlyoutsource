<?php

namespace App\Traits;

use Illuminate\Http\Request;

trait DecodesHashIds
{
    /**
     * Decode a single HashID field to integer ID
     *
     * @param  array|Request  &$data  Reference to data array or Request object
     * @param  string  $field  Field name containing HashID
     * @param  string  $modelClass  Fully qualified model class name
     */
    protected function decodeHashId(&$data, string $field, string $modelClass): void
    {
        if ($data instanceof Request) {
            if ($data->has($field)) {
                $model = $modelClass::findByHashId($data->input($field));
                if ($model) {
                    $data->merge([$field => $model->id]);
                }
            }
        } elseif (is_array($data) && ! empty($data[$field])) {
            $model = $modelClass::findByHashId($data[$field]);
            $data[$field] = $model ? $model->id : null;
        }
    }

    /**
     * Decode multiple HashID fields to integer IDs
     *
     * @param  array|Request  &$data  Reference to data array or Request object
     * @param  array  $fields  Array of field names containing HashIDs
     * @param  string  $modelClass  Fully qualified model class name
     */
    protected function decodeHashIds(&$data, array $fields, string $modelClass): void
    {
        foreach ($fields as $field) {
            $this->decodeHashId($data, $field, $modelClass);
        }
    }

    /**
     * Decode an array of HashIDs to integer IDs
     *
     * @param  array|Request  &$data  Reference to data array or Request object
     * @param  string  $field  Field name containing array of HashIDs
     * @param  string  $modelClass  Fully qualified model class name
     */
    protected function decodeHashIdArray(&$data, string $field, string $modelClass): void
    {
        if ($data instanceof Request) {
            if ($data->has($field) && is_array($data->input($field))) {
                $decoded = collect($data->input($field))
                    ->map(fn ($hashId) => $modelClass::findByHashId($hashId)?->id)
                    ->filter() // Remove nulls
                    ->values()
                    ->toArray();
                $data->merge([$field => $decoded]);
            }
        } elseif (is_array($data) && ! empty($data[$field]) && is_array($data[$field])) {
            $data[$field] = collect($data[$field])
                ->map(fn ($hashId) => $modelClass::findByHashId($hashId)?->id)
                ->filter()
                ->values()
                ->toArray();
        }
    }

    /**
     * Decode HashIDs in nested array items
     *
     * @param  array|Request  &$data  Reference to data array or Request object
     * @param  string  $arrayField  Field name containing array of items
     * @param  string  $idField  Field name within each item containing HashID
     * @param  string  $modelClass  Fully qualified model class name
     */
    protected function decodeNestedHashIds(&$data, string $arrayField, string $idField, string $modelClass): void
    {
        // Implementation for Request object would require getting array, modifying, and merging back
        if ($data instanceof Request) {
            if ($data->has($arrayField) && is_array($data->input($arrayField))) {
                $items = $data->input($arrayField);
                foreach ($items as &$item) {
                    if (! empty($item[$idField])) {
                        $model = $modelClass::findByHashId($item[$idField]);
                        $item[$idField] = $model ? $model->id : null;
                    }
                }
                $data->merge([$arrayField => $items]);
            }
        } elseif (is_array($data) && ! empty($data[$arrayField]) && is_array($data[$arrayField])) {
            foreach ($data[$arrayField] as &$item) {
                if (! empty($item[$idField])) {
                    $model = $modelClass::findByHashId($item[$idField]);
                    $item[$idField] = $model ? $model->id : null;
                }
            }
        }
    }

    /**
     * Safely decode a single HashID field (skips if already numeric)
     */
    protected function safeDecodeHashId(&$data, string $field, string $modelClass): void
    {
        if ($data instanceof Request) {
            $value = $data->input($field);
            if ($value && ! is_numeric($value)) {
                $this->decodeHashId($data, $field, $modelClass);
            }
        } else {
            $value = $data[$field] ?? null;
            if ($value && ! is_numeric($value)) {
                $this->decodeHashId($data, $field, $modelClass);
            }
        }
    }

    /**
     * Safely decode an array of HashID fields (skips elements that are already numeric)
     */
    protected function safeDecodeHashIdArray(&$data, string $field, string $modelClass): void
    {
        if ($data instanceof Request) {
            $values = $data->input($field);
            if (is_array($values)) {
                $decoded = collect($values)
                    ->map(function ($val) use ($modelClass) {
                        if (is_numeric($val)) {
                            return (int) $val;
                        }

                        return $modelClass::findByHashId($val)?->id;
                    })
                    ->filter()
                    ->values()
                    ->toArray();
                $data->merge([$field => $decoded]);
            }
        } elseif (is_array($data) && ! empty($data[$field]) && is_array($data[$field])) {
            $data[$field] = collect($data[$field])
                ->map(function ($val) use ($modelClass) {
                    if (is_numeric($val)) {
                        return (int) $val;
                    }

                    return $modelClass::findByHashId($val)?->id;
                })
                ->filter()
                ->values()
                ->toArray();
        }
    }
}
