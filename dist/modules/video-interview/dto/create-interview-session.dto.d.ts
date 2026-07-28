export declare class InterviewQuestionDto {
    id: string;
    text: string;
    durationSec: number;
}
export declare class CreateInterviewSessionDto {
    applicationId: string;
    questions: InterviewQuestionDto[];
    scheduledAt?: string;
    expiresAt?: string;
    locale?: string;
}
