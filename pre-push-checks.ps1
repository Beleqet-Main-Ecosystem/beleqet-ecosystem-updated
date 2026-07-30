$ErrorActionPreference = "Stop"

function Check-Command {
    param(
        [string]$StepName,
        [scriptblock]$Command
    )
    Write-Host "`n=== [START] $StepName ===" -ForegroundColor Cyan
    try {
        & $Command
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
        Write-Host "=== [SUCCESS] $StepName ===" -ForegroundColor Green
    } catch {
        Write-Host "=== [FAILED] $StepName ===" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "Aborting pipeline." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Starting Pre-Push Safety Checks..." -ForegroundColor Magenta

# 1. Git Synchronization Check
Check-Command "Git Fetch" { git fetch origin }
$diff = git diff --name-only HEAD...origin/main
if ($diff) {
    Write-Host "`nWARNING: Your branch differs from origin/main. Ensure there are no merge conflicts before pushing." -ForegroundColor Yellow
}

# 2. Sync dependencies using lockfile
Check-Command "NPM CI" { npm ci --ignore-scripts }

# 3. Format Check
Check-Command "Format Check" { npm run format:check }

# 4. Prisma Migration Validation
Check-Command "Prisma Migrate Deploy" { npm run prisma:migrate:deploy }

# 5. ESLint
Check-Command "Lint" { npm run lint }

# 6. Build
Check-Command "Build" { npm run build }

# 7. Unit/Integration Tests
Check-Command "Tests" { npm run test -- --forceExit }

Write-Host "`n✅ All Pre-Push Checks Passed Successfully! You are ready to push." -ForegroundColor Green
