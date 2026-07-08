-- Add GIN indexes for skills array fields to optimize array search performance
-- This is critical for the advanced search functionality

-- GIN index for User.skills (freelancer skills)
CREATE INDEX IF NOT EXISTS "users_skills_gin_idx" ON "users" USING GIN ("skills");

-- GIN index for Job.tags (service tags)
CREATE INDEX IF NOT EXISTS "jobs_tags_gin_idx" ON "jobs" USING GIN ("tags");

-- GIN index for FreelanceJob.skills (project skills)
CREATE INDEX IF NOT EXISTS "freelance_jobs_skills_gin_idx" ON "freelance_jobs" USING GIN ("skills");
