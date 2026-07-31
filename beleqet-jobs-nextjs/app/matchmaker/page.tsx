'use client';

import React, { useState, useMemo } from 'react';

interface MatchCandidate {
  id: string;
  candidateId: string;
  jobId: string;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  totalScore: number;
  algorithmVersion: string;
  metadata?: {
    matchedSkills: string[];
    missingSkills: string[];
    candidateExperienceHeadline?: string;
    jobExperienceRequired?: string;
    matchedLocation?: string;
    isRemote?: boolean;
  };
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    headline?: string;
    skills: string[];
    location?: string;
  };
}

const MOCK_JOBS = [
  { id: 'job-101', title: 'Senior NestJS & Full Stack Lead', company: 'Beleqet Engineering', totalMatches: 24 },
  { id: 'job-102', title: 'Senior React / Next.js Engineer', company: 'Maraki Tech', totalMatches: 18 },
  { id: 'job-103', title: 'DevOps & Cloud Architect', company: 'EthioTelecom Digital', totalMatches: 12 },
];

const MOCK_CANDIDATES: MatchCandidate[] = [
  {
    id: 'm-1',
    candidateId: 'user-1',
    jobId: 'job-101',
    skillScore: 95,
    experienceScore: 90,
    educationScore: 100,
    locationScore: 100,
    totalScore: 94,
    algorithmVersion: 'v1',
    metadata: {
      matchedSkills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Docker', 'Redis', 'Jest'],
      missingSkills: ['Kubernetes'],
      candidateExperienceHeadline: 'Senior Full-Stack & Technical Lead',
      jobExperienceRequired: 'SENIOR',
      matchedLocation: 'Addis Ababa (On-site / Hybrid)',
      isRemote: false,
    },
    candidate: {
      id: 'user-1',
      firstName: 'Abebe',
      lastName: 'Bikila',
      email: 'abebe.b@beleqet.et',
      headline: 'Senior Full Stack & AI Engineer',
      skills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Docker', 'Redis', 'Jest', 'GraphQL'],
      location: 'Addis Ababa, Ethiopia',
    },
  },
  {
    id: 'm-2',
    candidateId: 'user-2',
    jobId: 'job-101',
    skillScore: 80,
    experienceScore: 85,
    educationScore: 90,
    locationScore: 100,
    totalScore: 84,
    algorithmVersion: 'v1',
    metadata: {
      matchedSkills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis'],
      missingSkills: ['Docker', 'Jest', 'Kubernetes'],
      candidateExperienceHeadline: 'Backend Software Developer (4+ yrs)',
      jobExperienceRequired: 'SENIOR',
      matchedLocation: 'Remote',
      isRemote: true,
    },
    candidate: {
      id: 'user-2',
      firstName: 'Tigist',
      lastName: 'Haile',
      email: 'tigist.h@example.com',
      headline: 'Backend Developer',
      skills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Python'],
      location: 'Hawassa, Ethiopia',
    },
  },
  {
    id: 'm-3',
    candidateId: 'user-3',
    jobId: 'job-101',
    skillScore: 60,
    experienceScore: 70,
    educationScore: 75,
    locationScore: 100,
    totalScore: 68,
    algorithmVersion: 'v1',
    metadata: {
      matchedSkills: ['TypeScript', 'PostgreSQL'],
      missingSkills: ['NestJS', 'Docker', 'Redis', 'Jest'],
      candidateExperienceHeadline: 'Junior Full Stack Developer',
      jobExperienceRequired: 'SENIOR',
      matchedLocation: 'Addis Ababa',
      isRemote: false,
    },
    candidate: {
      id: 'user-3',
      firstName: 'Yared',
      lastName: 'Tadesse',
      email: 'yared.t@example.com',
      headline: 'Junior Developer',
      skills: ['JavaScript', 'TypeScript', 'React', 'PostgreSQL'],
      location: 'Addis Ababa, Ethiopia',
    },
  },
];

export default function AiMatchmakerDashboardPage() {
  const [selectedJobId, setSelectedJobId] = useState('job-101');
  const [minScore, setMinScore] = useState<number>(70);
  const [isCalculating, setIsCalculating] = useState(false);

  const selectedJob = MOCK_JOBS.find((j) => j.id === selectedJobId) || MOCK_JOBS[0];

  const filteredCandidates = useMemo(() => {
    return MOCK_CANDIDATES.filter((c) => c.totalScore >= minScore);
  }, [minScore]);

  const handleTriggerMatch = () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-indigo-500/10 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-500/20">
              BMAIN-AI-LOGIC-001
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/20">
              v1 Matching Engine
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
            AI Matchmaker Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Precision Candidate & Job Matching Engine • Multi-Vector Weighted Scoring & GDPR Compliant
          </p>
        </div>

        <button
          onClick={handleTriggerMatch}
          disabled={isCalculating}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {isCalculating ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Computing Matches...</span>
            </>
          ) : (
            <>
              <span>⚡ Trigger Batch Matching</span>
            </>
          )}
        </button>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {/* KPI Overview Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Matches Evaluated</p>
            <p className="text-3xl font-extrabold text-white mt-2">54</p>
            <p className="text-xs text-emerald-400 mt-1">✓ Indexed in PostgreSQL</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">High Quality Matches (≥75%)</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">2</p>
            <p className="text-xs text-slate-400 mt-1">Ready for Interview Shortlist</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Average Platform Score</p>
            <p className="text-3xl font-extrabold text-indigo-400 mt-2">82%</p>
            <p className="text-xs text-slate-400 mt-1">Weighted Multi-Vector Index</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">GDPR Opt-Out Filter</p>
            <p className="text-3xl font-extrabold text-slate-200 mt-2">100%</p>
            <p className="text-xs text-emerald-400 mt-1">Strict Consent Guard Active</p>
          </div>
        </section>

        {/* Controls & Filter Bar */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Active Job Posting
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium"
            >
              {MOCK_JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company} ({j.totalMatches} matches)
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Minimum Score Threshold Filter
              </label>
              <span className="text-sm font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg">
                {minScore}% Match
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </section>

        {/* Candidate Ranking List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Matched Candidates for &ldquo;{selectedJob.title}&rdquo;
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredCandidates.length} candidate(s) above {minScore}% threshold
            </span>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-slate-400 text-base">No candidates match the selected threshold score ({minScore}%).</p>

              <button
                onClick={() => setMinScore(50)}
                className="mt-4 text-xs text-indigo-400 underline hover:text-indigo-300"
              >
                Reset score threshold to 50%
              </button>
            </div>
          ) : (
            filteredCandidates.map((match) => (
              <div
                key={match.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-4">
                    {/* Radial Score Badge */}
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-slate-950 border-2 border-indigo-500/50 text-white font-extrabold text-lg shadow-inner">
                      <span>{match.totalScore}%</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{match.candidate.firstName} {match.candidate.lastName}</h3>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold px-2 py-0.5 rounded">
                          GDPR Verified
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{match.candidate.headline}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📍 {match.candidate.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-500/20">
                      Shortlist Candidate
                    </button>
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all">
                      View Profile
                    </button>
                  </div>
                </div>

                {/* Sub-score Progress Bars */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>Skill Overlap (40%)</span>
                      <span className="text-emerald-400">{match.skillScore}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${match.skillScore}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>Experience (30%)</span>
                      <span className="text-indigo-400">{match.experienceScore}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${match.experienceScore}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>Education (15%)</span>
                      <span className="text-purple-400">{match.educationScore}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: `${match.educationScore}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>Location (15%)</span>
                      <span className="text-amber-400">{match.locationScore}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${match.locationScore}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Skill Match Breakdown */}
                {match.metadata && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-xs font-semibold text-slate-400 mr-2">Matched Skills:</span>
                    {match.metadata.matchedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-lg font-medium"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                    {match.metadata.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="bg-slate-800 text-slate-400 border border-slate-700 text-xs px-2.5 py-0.5 rounded-lg font-medium"
                      >
                        ✗ {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
