# Script para configurar variáveis de ambiente no Vercel
# Execute: .\vercel-env-setup.ps1

Write-Host "🔐 Configurando DASHBOARD_PASSWORD_HASH no Vercel..." -ForegroundColor Cyan
Write-Host ""

$hash = "R3VlQ2xhdzIwMjZAU2VjdXJl"

# Production
Write-Host "📦 Adicionando em Production..." -ForegroundColor Yellow
echo $hash | vercel env add DASHBOARD_PASSWORD_HASH production

# Preview
Write-Host "📦 Adicionando em Preview..." -ForegroundColor Yellow
echo $hash | vercel env add DASHBOARD_PASSWORD_HASH preview

# Development
Write-Host "📦 Adicionando em Development..." -ForegroundColor Yellow
echo $hash | vercel env add DASHBOARD_PASSWORD_HASH development

Write-Host ""
Write-Host "✅ Variáveis configuradas!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Fazendo deploy em produção..." -ForegroundColor Cyan
vercel --prod

Write-Host ""
Write-Host "✅ Deploy completo!" -ForegroundColor Green
Write-Host "   Senha: GueClaw2026@Secure" -ForegroundColor Gray
