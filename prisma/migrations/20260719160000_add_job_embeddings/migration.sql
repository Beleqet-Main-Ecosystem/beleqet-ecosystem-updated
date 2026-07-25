-- AlterTable: add embedding column to jobs table
ALTER TABLE "jobs" ADD COLUMN "embedding" vector(1536);

-- HNSW index on jobs table (cosine distance)
-- m=16: default max connections per layer
-- ef_construction=200: high-quality graph construction
CREATE INDEX "idx_jobs_embedding" ON "jobs"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);
