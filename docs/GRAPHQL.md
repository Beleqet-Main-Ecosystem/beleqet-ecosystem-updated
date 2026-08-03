# GraphQL Turbo Module

## Overview

This module provides a high-performance GraphQL layer for the Beleqet Ecosystem,
designed to reduce over-fetching and eliminate the N+1 query problem that plagues
naive REST-to-GraphQL migrations.

The implementation is built on top of the existing NestJS + Prisma backend and
lives alongside the REST API — both layers share the same authentication, rate
limiting, and database connection pool.

---

## Endpoint

| Method | Path                | Environment |
|--------|---------------------|-------------|
| POST   | `/api/v1/graphql`   | All         |
| GET    | `/api/v1/graphql`   | Dev only (Playground UI) |

---

## Performance — "Turbo" Mode (DataLoader Batching)

### The N+1 Problem (Before)

A naive GraphQL resolver that fetches a job's company individually produces
**O(N+1)** SQL queries — one query for the job list, plus one per job:

```sql
SELECT * FROM "jobs" LIMIT 10;              -- 1 query
SELECT * FROM "companies" WHERE id = 'a1'; -- N queries (one per job)
SELECT * FROM "companies" WHERE id = 'b2';
-- ...
```

### The DataLoader Solution (After — "Turbo")

`DataLoaderService` (registered per-request in `GraphQL context`) batches all
company lookups that occur within a single tick into a **single IN-clause query**:

```sql
SELECT * FROM "jobs" LIMIT 10;                             -- 1 query
SELECT * FROM "companies" WHERE id IN ('a1', 'b2', ...);   -- 1 batched query
```

This reduces **N+1 queries to exactly 2**, regardless of how many jobs are
returned.

### How It Works

```
Request → JobResolver.jobs()
              ↓
          Fetches jobs list (1 SQL query)
              ↓
          For each job, calls: dataLoader.companyLoader.load(job.companyId)
              ↓
          DataLoader collects all IDs in the same tick, then calls:
          CompanyLoader.batchFn(['a1', 'b2', ...])
              ↓
          prisma.company.findMany({ where: { id: { in: [...] } } })  ← 1 SQL query
```

---

## Security

### Rate Limiting (`GqlThrottlerGuard`)

The standard NestJS `ThrottlerGuard` only understands HTTP context. A custom
`GqlThrottlerGuard` (`src/graphql/guards/gql-throttler.guard.ts`) extends it to
extract `req`/`res` from the GraphQL execution context, enabling identical
rate-limit protection on the GraphQL endpoint as on REST routes.

```typescript
// Applied globally in AppModule — no per-resolver annotation needed
APP_GUARD → GqlThrottlerGuard
```

### Query Depth Limiting

Malicious clients can craft deeply nested queries to exhaust server resources:

```graphql
{ jobs { items { company { jobs { items { company { ... } } } } } } }
```

`graphql-depth-limit` (configured in `GraphqlConfigModule`) rejects any query
exceeding **depth 5** before execution begins, with zero performance cost.

### Schema File (Production)

In production/staging Docker images the `src/` directory is absent (only `dist/`
is shipped). `autoSchemaFile` is set to `/tmp/schema.gql` for
`NODE_ENV=production|staging` to prevent an `ENOENT` crash on boot.

---

## Sample Queries

### Paginated Job Listings

```graphql
query GetJobs {
  jobs(page: 1, limit: 10) {
    items {
      id
      title
      location
      company {
        name
      }
    }
    total
    page
    limit
    totalPages
  }
}
```

### Single Job with Full Detail

```graphql
query GetJob($id: String!) {
  job(id: $id) {
    id
    title
    description
    location
    company {
      name
    }
  }
}
```

---

## Architecture

```
src/graphql/
├── graphql.module.ts          # ApolloDriver config, depth-limit, context setup
├── schema.gql                 # Auto-generated (dev only; /tmp in production)
├── guards/
│   └── gql-throttler.guard.ts # GQL-aware rate limiter
└── plugins/
    └── complexity.plugin.ts   # Query complexity scoring (future use)

src/modules/jobs/
├── jobs.resolver.ts           # @Query resolvers (jobs, job)
├── jobs.module.ts             # Wires DataLoaderService into GraphQL context
├── dataloader.service.ts      # Per-request DataLoader factory
└── types/
    └── paginated-jobs.type.ts # PaginatedJobsType GQL object
```

---

## Local Development

```bash
# Start DB + Redis
docker compose up -d db redis

# Start the backend in watch mode
npm run start:dev

# Open the GraphQL Playground
open http://localhost:4000/api/v1/graphql
```

Watch the terminal logs when running a `jobs` query — you will see exactly
**2 SQL statements** regardless of how many jobs are returned, proving the
DataLoader batching is working correctly.

---

## CI Verification

The following automated checks validate this module on every pull request:

| Check | What it covers |
|-------|---------------|
| Backend lint, format, types, build | TypeScript compilation of all resolvers/types |
| Backend unit tests & coverage | DataLoader batching logic, resolver isolation |
| Backend integration & E2E | Full HTTP + GraphQL query flow against a real DB |
| Docker build, stack smoke test & scan | End-to-end container boot + Trivy CRITICAL scan |
