-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable: add embedding column to users table
ALTER TABLE "users" ADD COLUMN "embedding" vector(1536);

-- AlterTable: add embedding column to freelance_jobs table
ALTER TABLE "freelance_jobs" ADD COLUMN "embedding" vector(1536);

-- Production-grade HNSW index on users table (cosine distance)
-- m=16: default max connections per layer (balanced recall vs. build time)
-- ef_construction=200: high-quality graph construction (higher = better recall)
CREATE INDEX "idx_users_embedding" ON "users"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- Production-grade HNSW index on freelance_jobs table (cosine distance)
CREATE INDEX "idx_freelance_jobs_embedding" ON "freelance_jobs"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);
