# 🚀 Script de Deploy Automático - Autenticação por Senha

param(
    [switch]$SkipGit = $false,
    [switch]$SkipVPS = $false,
    [switch]$SkipVercel = $false,
    [switch]$TestOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 GueClaw - Deploy de Autenticação por Senha" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Configurações
$VPS_HOST = "147.93.69.211"
$VPS_USER = "root"
$SSH_KEY = "$env:USERPROFILE\.ssh\gueclaw_vps"
$PASSWORD_HASH = "R3VlQ2xhdzIwMjZAU2VjdXJl"

# ============================================
# PASSO 1: Git Commit e Push
# ============================================

if (!$SkipGit) {
    Write-Host "📦 PASSO 1: Git Commit e Push" -ForegroundColor Yellow
    Write-Host "-----------------------------" -ForegroundColor Yellow
    
    # Verificar se há mudanças
    $status = git status --porcelain
    
    if ($status) {
        Write-Host "📝 Mudanças detectadas. Fazendo commit..." -ForegroundColor White
        
        # Add all
        git add .
        
        # Commit
        $commitMessage = @"
feat(security): Migrar autenticação de IP whitelist para senha global

- Remove restrição de IP (problemas com IP dinâmico e CGNAT)
- Implementa autenticação por senha em base64
- Adiciona página de login moderna
- Implementa APIs de login/logout
- Adiciona botão de logout na Sidebar
- Cria gerador de hash de senha
- Atualiza documentação de segurança
- Mantém varredura de segurança diária VPS

BREAKING CHANGE: ALLOWED_IPS removido, usar DASHBOARD_PASSWORD_HASH
Senha padrão: GueClaw2026@Secure
"@
        
        git commit -m $commitMessage
        
        # Push
        Write-Host "⬆️  Fazendo push para GitHub..." -ForegroundColor White
        git push origin main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Push realizado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Erro ao fazer push" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "   ℹ️  Nenhuma mudança detectada no Git" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# ============================================
# PASSO 2: Atualizar VPS
# ============================================

if (!$SkipVPS) {
    Write-Host "🖥️  PASSO 2: Atualizar VPS" -ForegroundColor Yellow
    Write-Host "-------------------------" -ForegroundColor Yellow
    
    # Verificar se chave SSH existe
    if (!(Test-Path $SSH_KEY)) {
        Write-Host "   ❌ Chave SSH não encontrada: $SSH_KEY" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "📡 Conectando à VPS..." -ForegroundColor White
    
    # Script para executar na VPS
    $vpsScript = @"
#!/bin/bash
set -e

echo "📂 Navegando para /opt/gueclaw-agent..."
cd /opt/gueclaw-agent

echo "⬇️  Fazendo pull do GitHub..."
git pull origin main

echo "📦 Instalando dependências..."
npm install --production

echo "🔧 Verificando se DASHBOARD_PASSWORD_HASH já existe..."
if grep -q "^DASHBOARD_PASSWORD_HASH=" .env; then
    echo "   ✅ DASHBOARD_PASSWORD_HASH já existe no .env"
else
    echo "   ➕ Adicionando DASHBOARD_PASSWORD_HASH ao .env..."
    
    # Backup
    cp .env .env.backup-`date +%Y%m%d-%H%M%S`
    
    # Adicionar configuração
    cat >> .env << 'EOF'

# ===== Dashboard Security =====
# Senha para acessar o dashboard (armazenada em base64)
# Para gerar novo hash: node -e \"console.log(Buffer.from('SUA_SENHA').toString('base64'))\"
# Senha padrão: GueClaw2026@Secure
DASHBOARD_PASSWORD_HASH=$PASSWORD_HASH
EOF
    
    echo "   ✅ DASHBOARD_PASSWORD_HASH adicionado!"
fi

echo "🔍 Verificando configuração..."
if grep -q "^DASHBOARD_PASSWORD_HASH=$PASSWORD_HASH" .env; then
    echo "   ✅ Configuração correta!"
else
    echo "   ⚠️  Aviso: Hash pode estar diferente"
    echo "   Valor encontrado:"
    grep "^DASHBOARD_PASSWORD_HASH=" .env || echo "   (não encontrado)"
fi

echo ""
echo "✅ VPS atualizada com sucesso!"
"@
    
    # Criar arquivo temporário do script
    $tempScript = "$env:TEMP\vps-update-script.sh"
    $vpsScript | Out-File -FilePath $tempScript -Encoding UTF8
    
    # Copiar script para VPS
    scp -i $SSH_KEY $tempScript "${VPS_USER}@${VPS_HOST}:/tmp/update-gueclaw.sh"
    
    # Executar script na VPS
    ssh -i $SSH_KEY "${VPS_USER}@${VPS_HOST}" "bash /tmp/update-gueclaw.sh"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ VPS atualizada com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erro ao atualizar VPS" -ForegroundColor Red
        exit 1
    }
    
    # Limpar
    Remove-Item $tempScript -ErrorAction SilentlyContinue
    
    Write-Host ""
}

# ============================================
# PASSO 3: Deploy Vercel
# ============================================

if (!$SkipVercel) {
    Write-Host "🌐 PASSO 3: Deploy no Vercel" -ForegroundColor Yellow
    Write-Host "----------------------------" -ForegroundColor Yellow
    
    # Verificar se vercel CLI está instalado
    $vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
    
    if (!$vercelInstalled) {
        Write-Host "   ⚠️  Vercel CLI não instalado" -ForegroundColor Yellow
        Write-Host "   Instalando globalmente..." -ForegroundColor White
        npm install -g vercel
    }
    
    # Navegar para dashboard
    Push-Location dashboard
    
    try {
        # Verificar se variável de ambiente já existe
        Write-Host "🔍 Verificando variável de ambiente no Vercel..." -ForegroundColor White
        
        $envExists = $false
        try {
            $envList = vercel env ls production 2>&1
            if ($envList -match "DASHBOARD_PASSWORD_HASH") {
                $envExists = $true
                Write-Host "   ℹ️  DASHBOARD_PASSWORD_HASH já existe no Vercel" -ForegroundColor Gray
            }
        } catch {
            # Ignorar erro se não conseguir listar
        }
        
        if (!$envExists) {
            Write-Host "   ➕ Adicionando DASHBOARD_PASSWORD_HASH ao Vercel..." -ForegroundColor White
            
            # Adicionar variável de ambiente
            echo $PASSWORD_HASH | vercel env add DASHBOARD_PASSWORD_HASH production
            
            Write-Host "   ✅ Variável adicionada!" -ForegroundColor Green
        }
        
        # Deploy
        if (!$TestOnly) {
            Write-Host "🚀 Fazendo deploy no Vercel..." -ForegroundColor White
            vercel --prod
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deploy realizado com sucesso!" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Erro no deploy" -ForegroundColor Red
                Pop-Location
                exit 1
            }
        } else {
            Write-Host "   ⏭️  Deploy pulado (modo teste)" -ForegroundColor Gray
        }
        
    } finally {
        Pop-Location
    }
    
    Write-Host ""
}

# ============================================
# RESUMO FINAL
# ============================================

Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

if (!$SkipGit) {
    Write-Host "✅ Git: Push realizado" -ForegroundColor Green
}

if (!$SkipVPS) {
    Write-Host "✅ VPS: Código atualizado e .env configurado" -ForegroundColor Green
}

if (!$SkipVercel -and !$TestOnly) {
    Write-Host "✅ Vercel: Dashboard deployado" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Próximos Passos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Acesse seu dashboard e teste o login" -ForegroundColor White
Write-Host "   Senha padrão: GueClaw2026@Secure" -ForegroundColor Gray
Write-Host ""
Write-Host "2. IMPORTANTE: Troque a senha padrão!" -ForegroundColor Yellow
Write-Host "   npm run password:generate \"SuaSenhaForte@123\"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Monitore a varredura de segurança (6h da manhã)" -ForegroundColor White
Write-Host "   npm run security:audit (testar manualmente)" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Documentação: docs/security/AUTH-QUICKSTART.md" -ForegroundColor Cyan
Write-Host ""
