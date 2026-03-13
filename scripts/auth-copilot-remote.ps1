# GitHub Copilot OAuth Authentication - Remote VPS
# This script connects to the VPS and runs the authentication

$VPS_HOST = "147.93.69.211"
$VPS_USER = "root"
$VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+"

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   GitHub Copilot OAuth - Remote Authentication  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📡 Connecting to VPS: $VPS_HOST" -ForegroundColor Yellow
Write-Host ""

# Try using plink if available (PuTTY)
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue

if ($plinkPath) {
    Write-Host "✅ Using plink for SSH connection" -ForegroundColor Green
    echo y | plink -pw $VPS_PASSWORD $VPS_USER@$VPS_HOST "cd /opt/gueclaw-agent && npm run copilot:auth"
} else {
    Write-Host "⚠️  plink not found. Please install PuTTY or run manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   ssh root@$VPS_HOST" -ForegroundColor White
    Write-Host "   Password: $VPS_PASSWORD" -ForegroundColor White
    Write-Host "   cd /opt/gueclaw-agent" -ForegroundColor White
    Write-Host "   npm run copilot:auth" -ForegroundColor White
    Write-Host ""
    
    # Try direct SSH anyway
    Write-Host "Attempting direct SSH connection..." -ForegroundColor Yellow
    ssh $VPS_USER@$VPS_HOST "cd /opt/gueclaw-agent && npm run copilot:auth"
}
