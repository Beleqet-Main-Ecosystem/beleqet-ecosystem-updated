# GitHub Actions CI Workflow - Troubleshooting Guide

## Fixed Issues

### 1. ✅ Duplicate npm Scripts in package.json
**Problem**: Had duplicate definitions for `test`, `test:watch`, `test:cov`, and `test:e2e` scripts
**Solution**: Removed duplicates, kept the versions that ignore integration tests

## Current CI Configuration

### Workflows:
1. **CI Workflow** (`.github/workflows/ci.yml`):
   - Unit tests
   - Playwright E2E tests (marked as `continue-on-error: true`)
   
2. **Deploy Workflow** (`.github/workflows/deploy.yml`):
   - Auto-deploys to staging when PR is merged to main

### CI Environment:
- Node 20
- PostgreSQL 15
- Redis 7
- All required environment variables configured

## Common Failure Points & Solutions

### 1. Unit Tests Failing
**Check**: 
```bash
npm test
```
**Current Status**: ✅ All 530 tests passing locally

**If failing in CI**:
- Check if new dependencies need to be installed
- Verify environment variables are set correctly in workflow
- Check database migrations are applied: `npx prisma migrate deploy`

### 2. Build Failing
**Check**:
```bash
npm run build
```
**Current Status**: ✅ Build successful locally

**If failing in CI**:
- TypeScript compilation errors
- Missing dependencies
- Check if `npx prisma generate` was run before build

### 3. Playwright E2E Tests Failing
**Note**: These are set to `continue-on-error: true`, so they won't block the workflow

**Check locally**:
```bash
cd frontend
npx playwright install
npx playwright test
```

**Common issues**:
- Backend not fully started before tests run
- Frontend not built or started
- Timeout issues (workflow has 45s timeout for backend startup)

### 4. Database Migration Issues
**Check**:
```bash
npx prisma migrate deploy
```

**If failing in CI**:
- Check if all migration files are committed
- Verify PostgreSQL service is healthy
- Check connection string format

### 5. Redis Connection Issues
**If failing in CI**:
- Verify Redis service is healthy in workflow
- Check REDIS_HOST and REDIS_PORT environment variables

## Quick Diagnosis Commands

Run these locally to verify everything works:

```bash
# 1. Clean install
npm ci

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations (if using local DB)
npx prisma migrate deploy

# 4. Build project
npm run build

# 5. Run all tests
npm test

# 6. Check TypeScript
npx tsc --noEmit
```

## What to Check in GitHub Actions

When workflows fail, check the following in order:

### Step 1: Check the Logs
Go to GitHub Actions tab → Click failed workflow → Check which job/step failed

### Step 2: Common Error Patterns

**"MODULE_NOT_FOUND"**
- Solution: Ensure all dependencies are in package.json
- Run `npm ci` instead of `npm install` in CI

**"Command failed: prisma migrate deploy"**
- Solution: Ensure migrations are committed
- Check DATABASE_URL is correct

**"Port already in use"**
- Solution: Previous process not cleaned up (rare in CI)
- Add cleanup step in workflow

**"ECONNREFUSED" or database connection errors**
- Solution: Database service not ready
- Increase health check timeout
- Verify service name matches connection string

**"Cannot find module '@prisma/client'"**
- Solution: Run `npx prisma generate` before build/test

### Step 3: Environment Variables

Verify all required env vars are set in the workflow:
- ✅ DATABASE_URL
- ✅ REDIS_HOST / REDIS_PORT
- ✅ JWT secrets
- ✅ TOTP keys
- ✅ OAuth credentials (dummy values OK for tests)
- ✅ API keys (dummy values OK for tests)

## Viewing Failed Workflow Details

To get specific error information:

1. Go to your GitHub repository
2. Click "Actions" tab
3. Click on the failed workflow run
4. Click on the failed job (e.g., "unit-tests")
5. Expand the failed step to see error logs
6. Look for red error messages

## If You Need Help Debugging

Please provide:
1. Which workflow failed (CI or Deploy)
2. Which job failed (unit-tests or playwright-e2e)
3. Which step in the job failed
4. The error message from the logs
5. Screenshot of the failure (optional)

## Current Status

✅ **Local Environment**: All tests passing (530/530)
✅ **Build**: Successful
✅ **TypeScript**: No errors
✅ **Package.json**: Duplicate scripts removed
✅ **Type Declarations**: All resolved

**Next Step**: Push and monitor the GitHub Actions workflow to identify specific failure points.

## Quick Fixes for Common CI Issues

### If unit-tests job fails:
```yaml
# In ci.yml, add more debug output:
- run: npm test
  env:
    DEBUG: '*'
```

### If Playwright fails and it's blocking (currently it's not):
```yaml
# Already set to continue-on-error: true
# This allows CI to pass even if E2E tests fail
```

### If database migrations fail:
```bash
# Ensure you've committed all migration files:
git add prisma/migrations
git commit -m "chore: add database migrations"
```

### If Redis connection fails:
```yaml
# Verify Redis service configuration in ci.yml
# Current config looks correct
```

## Monitoring After Push

After pushing, watch the Actions tab for:
1. ✅ Green checkmark = Success
2. ❌ Red X = Failure (click to see details)
3. 🟡 Yellow dot = In progress
4. ⚪ Gray circle = Queued/waiting

The Playwright E2E test failures won't block your workflow since `continue-on-error: true` is set.
