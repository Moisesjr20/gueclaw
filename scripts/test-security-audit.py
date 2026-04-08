#!/usr/bin/env python3
"""
🧪 Teste Rápido - Security Audit
Verifica se o script de auditoria está funcionando corretamente
"""

import os
import sys
from pathlib import Path

# Adiciona o diretório do projeto ao path
sys.path.insert(0, str(Path(__file__).parent))

try:
    # Tenta importar dependências
    import paramiko
    import requests
    print("✅ Dependências instaladas: paramiko, requests")
except ImportError as e:
    print(f"❌ Dependência faltando: {e}")
    print("\n📦 Instale com: pip3 install paramiko requests")
    sys.exit(1)

# Verifica variáveis de ambiente
required_vars = {
    'VPS_HOST': os.getenv('VPS_HOST'),
    'VPS_USER': os.getenv('VPS_USER'),
    'VPS_SSH_KEY_PATH': os.getenv('VPS_SSH_KEY_PATH'),
    'TELEGRAM_BOT_TOKEN': os.getenv('TELEGRAM_BOT_TOKEN'),
    'TELEGRAM_ALLOWED_USER_IDS': os.getenv('TELEGRAM_ALLOWED_USER_IDS')
}

print("\n🔍 Verificando variáveis de ambiente:")
all_ok = True
for var, value in required_vars.items():
    if value:
        # Oculta tokens sensíveis
        if 'TOKEN' in var or 'KEY' in var:
            display = f"{value[:10]}..." if len(value) > 10 else "***"
        else:
            display = value
        print(f"   ✅ {var}: {display}")
    else:
        print(f"   ❌ {var}: NÃO CONFIGURADO")
        all_ok = False

# Verifica se a chave SSH existe
ssh_key_path = required_vars['VPS_SSH_KEY_PATH']
if ssh_key_path and Path(ssh_key_path).exists():
    print(f"   ✅ Chave SSH encontrada: {ssh_key_path}")
else:
    print(f"   ❌ Chave SSH não encontrada: {ssh_key_path}")
    all_ok = False

print()

if all_ok:
    print("🎉 Tudo configurado corretamente!")
    print("\n📋 Próximos passos:")
    print("   1. Instalar na VPS: .\\scripts\\install-security-audit.ps1 -TestNow")
    print("   2. Ou testar localmente: python3 scripts/security-audit-vps.py")
    sys.exit(0)
else:
    print("⚠️ Configurações incompletas. Configure as variáveis faltando no .env")
    sys.exit(1)
