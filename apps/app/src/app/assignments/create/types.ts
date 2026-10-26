import type { SubmissionType } from "@/components/FormElements/SubmissionTypesSelector";
import type { QuizQuestion, QuizSettings } from "@/lib/api-config";

export type AssignmentFormData = {
  class_id: string;
  assignment_type_id: string;
  title: string;
  description: string;
  instructions: string;
  assigned_date: string;
  due_date: string;
  deadline: string;
  max_score: string;
  allow_late_submission: boolean;
  max_attempts: string;
  status: "draft" | "published" | "closed";
  learning_resources: (number | string)[];
  allowed_submission_types: SubmissionType[];
};

export type QuizDraftState = {
  formData: AssignmentFormData;
  mode: "standard" | "quiz";
  quizSettings: QuizSettings;
  quizQuestions: QuizQuestion[];
};

export type WizardStepId = "general" | "quiz-config" | "questions";

export type WizardStep = {
  id: WizardStepId;
  title: string;
  description: string;
};

