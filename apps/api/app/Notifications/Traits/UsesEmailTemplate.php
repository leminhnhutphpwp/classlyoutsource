<?php

namespace App\Notifications\Traits;

use App\Models\EmailTemplate;
use Illuminate\Notifications\Messages\MailMessage;

trait UsesEmailTemplate
{
    /**
     * Build email from template or fallback to default.
     *
     * @param  string  $slug  Template slug
     * @param  array  $variables  Variables to replace
     * @param  array  $viewData  Data for blade view
     * @param  callable|null  $fallback  Fallback function if template not found
     */
    protected function buildMailFromTemplate(
        string $slug,
        array $variables,
        array $viewData = [],
        ?callable $fallback = null
    ): MailMessage {
        $template = EmailTemplate::getBySlug($slug);

        if ($template) {
            $rendered = $template->render($variables);

            return (new MailMessage)
                ->subject($rendered['subject'])
                ->view('emails.template', array_merge([
                    'body_html' => $rendered['body_html'],
                    'subject' => $rendered['subject'],
                ], $viewData));
        }

        // Fallback
        if ($fallback && is_callable($fallback)) {
            return $fallback();
        }

        return new MailMessage;
    }
}
