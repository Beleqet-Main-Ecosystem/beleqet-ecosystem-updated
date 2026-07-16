import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export interface SalaryEstimateResponse {
  salary: number;
  currency: string;
}

@Injectable()
export class AppService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'GEMINI_API_KEY environment variable is missing.'
        );
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  /**
   * Fetches the estimated salary and its associated currency using structured JSON output.
   */
  async getSimpleEstimate(
    jobTitle: string,
    country: string,
    yearsOfExperience: number,
  ): Promise<SalaryEstimateResponse> {
    const prompt = `${jobTitle} average salary in ${country} with ${yearsOfExperience} years experience. Provide the salary figure and identify the standard local currency code.`;

    try {
      const aiInstance = this.getAI();
      const response = await aiInstance.models.generateContent({
        // Using 'gemini-1.5-flash' to avoid the zero-quota limit on newer models
        model: 'gemini-3.5-flash', 
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              salary: { type: 'NUMBER', description: 'The average annual salary figure as a raw number' },
              currency: { type: 'STRING', description: 'The standard 3-letter currency code (e.g., JPY, USD, EUR)' },
            },
            required: ['salary', 'currency'],
          },
        },
      });

      const textResult = response.text?.trim();
      if (!textResult) {
        throw new Error('No response returned from Gemini.');
      }

      // Safe JSON parsing guaranteed by responseSchema
      const parsedData = JSON.parse(textResult) as SalaryEstimateResponse;

      if (isNaN(parsedData.salary)) {
        throw new Error('Parsed salary is not a valid number.');
      }

      return parsedData;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error generating raw salary: ${error.message}`,
      );
    }
  }
}