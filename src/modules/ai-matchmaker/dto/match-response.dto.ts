export interface MatchBreakdownMetadata {
  matchedSkills: string[];
  missingSkills: string[];
  candidateExperienceHeadline?: string;
  jobExperienceRequired?: string;
  matchedLocation?: string;
  isRemote?: boolean;
}

export interface MatchScoreResponse {
  id: string;
  candidateId: string;
  jobId: string;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  totalScore: number;
  algorithmVersion: string;
  metadata?: MatchBreakdownMetadata;
  createdAt: Date;
  updatedAt: Date;
  candidate?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    headline?: string;
    skills: string[];
    location?: string;
  };
  job?: {
    id: string;
    title: string;
    location?: string;
    tags: string[];
    experienceLevel?: string;
    company?: {
      name: string;
    };
  };
}

export interface MatchAnalyticsResponse {
  totalEvaluatedMatches: number;
  highQualityMatchesCount: number; // totalScore >= 75
  averageTotalScore: number;
  averageSkillScore: number;
  averageExperienceScore: number;
  topSkillsDistribution: Array<{ skill: string; count: number }>;
}
