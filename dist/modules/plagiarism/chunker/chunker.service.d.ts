import { TextChunk } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
export declare class ChunkerService {
    private readonly config;
    constructor(config: PlagiarismConfig);
    chunk(text: string): TextChunk[];
}
