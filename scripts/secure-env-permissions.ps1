#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Restringe permissões do arquivo .env para aumentar segurança
.DESCRIPTION
    Remove herança e garante que apenas o usuário atual e SISTEMA tenham acesso ao .env
    DEVE SER EXECUTADO COMO ADMINISTRADOR
#>

param(
    [string]$EnvPath = "$PSScriptRoot\..\.env"
)

Write-Host "🔒 Configurando permissões de segurança para .env..." -ForegroundColor Cyan

if (-not (Test-Path $EnvPath)) {
    Write-Host "❌ Arquivo .env não encontrado em: $EnvPath" -ForegroundColor Red
    exit 1
}

try {
    # Obter ACL atual
    $acl = Get-Acl $EnvPath
    
    # Desabilitar herança e remover permissões herdadas
    Write-Host "📋 Removendo herança de permissões..." -ForegroundColor Yellow
    $acl.SetAccessRuleProtection($true, $false)
    
    # Remover todas as regras de acesso existentes
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
    
    # Adicionar permissão para SISTEMA (necessário para o sistema operacional)
    $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        "NT AUTHORITY\SYSTEM",
        "FullControl",
        "Allow"
    )
    $acl.SetAccessRule($systemRule)
    Write-Host "✅ Permissão concedida: NT AUTHORITY\SYSTEM (FullControl)" -ForegroundColor Green
    
    # Adicionar permissão para o usuário atual
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $userRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $currentUser,
        "FullControl",
        "Allow"
    )
    $acl.SetAccessRule($userRule)
    Write-Host "✅ Permissão concedida: $currentUser (FullControl)" -ForegroundColor Green
    
    # Aplicar as novas permissões
    Set-Acl -Path $EnvPath -AclObject $acl
    
    Write-Host ""
    Write-Host "🎉 Permissões de segurança aplicadas com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Permissões atuais do .env:" -ForegroundColor Cyan
    (Get-Acl $EnvPath).Access | Select-Object IdentityReference, FileSystemRights, AccessControlType | Format-Table -AutoSize
    
    Write-Host "⚠️  IMPORTANTE: Agora apenas você e o SISTEMA podem ler o .env" -ForegroundColor Yellow
    Write-Host "    Outros usuários do Windows não terão mais acesso." -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Erro ao configurar permissões: $_" -ForegroundColor Red
    exit 1
}
