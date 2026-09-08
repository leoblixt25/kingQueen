Write-Host "Updating GitHub repository..." -ForegroundColor Green
Write-Host ""

# Add all changes
git add .

# Check if there are any changes to commit
$gitStatus = git diff-index --quiet HEAD; $gitStatusExitCode = $LASTEXITCODE

if ($gitStatusExitCode -eq 1) {
    # There are changes to commit
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-update: $timestamp"
    
    # Push to GitHub
    Write-Host "Pushing changes to GitHub..." -ForegroundColor Yellow
    git push origin main
    
    Write-Host ""
    Write-Host "GitHub repository updated successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "No changes to commit. Repository is up to date." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Green