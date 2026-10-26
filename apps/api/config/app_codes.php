<?php

return [
    'student' => [
        /*
        |--------------------------------------------------------------------------
        | Student Code Configuration
        |--------------------------------------------------------------------------
        |
        | Prefix: HV (Ex: HV...)
        | Separator: Character between parts (Default: empty)
        | Suffix Length: Number of random digits (Default: 6)
        |
        | Result format: {PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{RANDOM}
        | Example default: HV2024123456
        |
        */
        'prefix' => env('STUDENT_CODE_PREFIX', 'HV'),
        'separator' => env('STUDENT_CODE_SEPARATOR', ''),
        'suffix_length' => env('STUDENT_CODE_SUFFIX_LENGTH', 6),
    ],

    'class' => [
        /*
        |--------------------------------------------------------------------------
        | Class Code Configuration
        |--------------------------------------------------------------------------
        |
        | Prefix: CLS (Ex: CLS...)
        | Separator: Character between parts (Default: -)
        | Suffix Length: Number of random digits (Default: 4)
        |
        | Result format: {PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{RANDOM}
        | Example default: CLS-2024-1234
        |
        */
        'prefix' => env('CLASS_CODE_PREFIX', 'CLS'),
        'separator' => env('CLASS_CODE_SEPARATOR', '-'),
        'suffix_length' => env('CLASS_CODE_SUFFIX_LENGTH', 4),
    ],
];
