<?php

namespace App\Http\Controllers\API\V1;

use App\Models\EmailTemplate;
use App\Services\DataJobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class EmailTemplateController extends BaseController
{
    /**
     * Export email templates.
     *
     * GET /api/v1/email-templates/export
     */
    public function export(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only super admin can export templates
        if (! $user->isSuperAdmin()) {
            return $this->errorResponse('Không có quyền export email templates', null, 'UNAUTHORIZED', 403);
        }

        $format = $request->get('format', 'json'); // json or csv

        $job = DataJobService::start('export', 'email-templates', $user, [
            'format' => $format,
            'meta' => [
                'path' => $request->path(),
            ],
        ]);

        try {
            $templates = EmailTemplate::orderBy('category')->orderBy('name')->get();

            $data = $templates->map(function ($template) {
                return [
                    'slug' => $template->slug,
                    'name' => $template->name,
                    'subject' => $template->subject,
                    'body_html' => $template->body_html,
                    'body_text' => $template->body_text,
                    'variables' => $template->variables,
                    'description' => $template->description,
                    'category' => $template->category,
                    'is_active' => $template->is_active,
                ];
            })->toArray();

            if ($format === 'csv') {
                // For CSV, we'll return a simplified version
                $csvData = [];
                $csvData[] = ['slug', 'name', 'subject', 'category', 'is_active', 'description'];
                foreach ($data as $template) {
                    $csvData[] = [
                        $template['slug'],
                        $template['name'],
                        $template['subject'],
                        $template['category'],
                        $template['is_active'] ? '1' : '0',
                        $template['description'] ?? '',
                    ];
                }

                $response = response()->json([
                    'success' => true,
                    'data' => $csvData,
                    'format' => 'csv',
                    'note' => 'CSV format chỉ chứa thông tin cơ bản. Sử dụng format=json để export đầy đủ.',
                ]);

                DataJobService::finishSuccess($job, [
                    'total_rows' => count($csvData) - 1, // exclude header
                ]);

                return $response;
            }

            $response = $this->successResponse([
                'templates' => $data,
                'total' => count($data),
                'format' => 'json',
            ], 'Export email templates thành công');

            DataJobService::finishSuccess($job, [
                'total_rows' => count($data),
            ]);

            return $response;
        } catch (\Exception $e) {
            Log::channel('media')->error('Export email templates error', [
                'error' => $e->getMessage(),
            ]);

            DataJobService::finishFailed($job, $e->getMessage());

            return $this->errorResponse('Lỗi khi export email templates: '.$e->getMessage(), null, 'EXPORT_ERROR', 500);
        }
    }

    /**
     * Import email templates.
     *
     * POST /api/v1/email-templates/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only super admin can import templates
        if (! $user->isSuperAdmin()) {
            return $this->errorResponse('Không có quyền import email templates', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'templates' => 'required|array|min:1',
            'templates.*.slug' => 'required|string|max:255',
            'templates.*.name' => 'required|string|max:255',
            'templates.*.subject' => 'required|string',
            'templates.*.body_html' => 'nullable|string',
            'templates.*.body_text' => 'nullable|string',
            'templates.*.variables' => 'nullable|array',
            'templates.*.description' => 'nullable|string',
            'templates.*.category' => 'nullable|string|max:255',
            'templates.*.is_active' => 'nullable|boolean',
            'overwrite' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $templates = $request->input('templates');
        $overwrite = $request->boolean('overwrite', false);

        $job = DataJobService::start('import', 'email-templates', $user, [
            'format' => 'json',
            'meta' => [
                'path' => $request->path(),
                'overwrite' => $overwrite,
            ],
        ]);

        DB::beginTransaction();

        try {
            $success = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];

            foreach ($templates as $index => $templateData) {
                try {
                    $slug = $templateData['slug'];
                    $existing = EmailTemplate::where('slug', $slug)->first();

                    if ($existing) {
                        if (! $overwrite) {
                            $skipped++;
                            $errors[] = [
                                'index' => $index,
                                'slug' => $slug,
                                'error' => 'Template đã tồn tại. Sử dụng overwrite=true để ghi đè.',
                            ];

                            continue;
                        }

                        // Update existing
                        $existing->update([
                            'name' => $templateData['name'],
                            'subject' => $templateData['subject'],
                            'body_html' => $templateData['body_html'] ?? $existing->body_html,
                            'body_text' => $templateData['body_text'] ?? $existing->body_text,
                            'variables' => $templateData['variables'] ?? $existing->variables,
                            'description' => $templateData['description'] ?? null,
                            'category' => $templateData['category'] ?? null,
                            'is_active' => $templateData['is_active'] ?? $existing->is_active,
                        ]);

                        $updated++;
                    } else {
                        // Create new
                        EmailTemplate::create([
                            'slug' => $slug,
                            'name' => $templateData['name'],
                            'subject' => $templateData['subject'],
                            'body_html' => $templateData['body_html'] ?? '',
                            'body_text' => $templateData['body_text'] ?? '',
                            'variables' => $templateData['variables'] ?? [],
                            'description' => $templateData['description'] ?? null,
                            'category' => $templateData['category'] ?? null,
                            'is_active' => $templateData['is_active'] ?? true,
                        ]);

                        $success++;
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'index' => $index,
                        'slug' => $templateData['slug'] ?? 'unknown',
                        'error' => $e->getMessage(),
                    ];
                    Log::channel('media')->error('Import email template error', [
                        'index' => $index,
                        'data' => $templateData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('media')->info('Email templates imported', [
                'user_id' => $user->id,
                'success' => $success,
                'updated' => $updated,
                'skipped' => $skipped,
            ]);

            $total = count($templates);
            $metrics = [
                'total_rows' => $total,
                'success_count' => $success + $updated,
                'failed_count' => 0,
                'skipped_count' => $skipped,
            ];

            if (! empty($errors)) {
                DataJobService::finishPartial($job, $metrics, ['errors' => $errors]);
            } else {
                DataJobService::finishSuccess($job, $metrics);
            }

            return $this->successResponse([
                'total' => $total,
                'created' => $success,
                'updated' => $updated,
                'skipped' => $skipped,
                'errors' => $errors,
            ], 'Import email templates hoàn tất');
        } catch (\Exception $e) {
            DB::rollBack();

            Log::channel('media')->error('Import email templates transaction failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            DataJobService::finishFailed($job, $e->getMessage());

            return $this->errorResponse('Lỗi khi import email templates: '.$e->getMessage(), null, 'IMPORT_ERROR', 500);
        }
    }
}
