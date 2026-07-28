export declare class AnswerSubmissionDto {
    questionId: string;
    selectedOption: string;
}
export declare class SubmitAnswersDto {
    sessionId: string;
    answers: AnswerSubmissionDto[];
}
