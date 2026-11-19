-- Funding escrow after hiring used to set a project back to FUNDED, which counts as open: it showed
-- in search and took new bids. A project with a contract is in progress.
UPDATE "freelance_jobs" AS j
SET "status" = 'IN_PROGRESS', "updatedAt" = NOW()
WHERE j."status" = 'FUNDED'
  AND EXISTS (SELECT 1 FROM "contracts" AS c WHERE c."freelanceJobId" = j."id");
