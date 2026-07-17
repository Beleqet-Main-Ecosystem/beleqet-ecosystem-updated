Write-Host "1. Validating Prisma schema..." -ForegroundColor Cyan
npx prisma validate
if ($LASTEXITCODE -ne 0) { Write-Host "SCHEMA INVALID - STOP HERE" -ForegroundColor Red; exit 1 }

Write-Host "2. Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "GENERATE FAILED - STOP HERE" -ForegroundColor Red; exit 1 }

Write-Host "3. Deploying migrations..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host "MIGRATE FAILED - STOP HERE" -ForegroundColor Red; exit 1 }

Write-Host "4. Building..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED - STOP HERE" -ForegroundColor Red; exit 1 }

Write-Host "5. Running tests..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { Write-Host "TESTS FAILED - STOP HERE" -ForegroundColor Red; exit 1 }

Write-Host "ALL CHECKS PASSED - SAFE TO PUSH" -ForegroundColor Green
