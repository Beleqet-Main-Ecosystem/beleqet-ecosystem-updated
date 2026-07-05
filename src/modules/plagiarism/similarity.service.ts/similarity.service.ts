import { Injectable } from '@nestjs/common';
import { JaccardStrategy } from './jaccard.strategy';
import { SimilarityResult } from './similarity.interface';

/**
 * Facade for similarity algorithms used by the plagiarism module.
 */
@Injectable()
export class SimilarityService {
  constructor(private readonly jaccardStrategy: JaccardStrategy) {}

  /**
   * Compares two documents using the default Jaccard strategy.
   */
  compare(textA: string, textB: string): SimilarityResult {
    return this.jaccardStrategy.compare(textA, textB);
  }
}
