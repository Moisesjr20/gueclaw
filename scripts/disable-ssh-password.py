#!/usr/bin/env python3
"""
Script para desabilitar autenticação SSH por senha na VPS (usar apenas chave)
ATENÇÃO: Execute apenas APÓS confirmar que a autenticação por chave funciona!
"""
import paramiko
import sys
import os

print('⚠️  ATENÇÃO: Este script vai DESABILITAR autenticação SSH por senha')
print('   Apenas chaves SSH serão aceitas após esta alteração.')
print('')
print('   Certifique-se que a chave SSH está funcionando antes de continuar!')
print('')

# Conectar usando a chave SSH (não mais a senha!)
ssh_key_path = os.path.expanduser('~/.ssh/gueclaw_vps')

if not os.path.exists(ssh_key_path):
    print(f'❌ Chave SSH não encontrada em: {ssh_key_path}')
    print('   Execute primeiro: python scripts/setup-ssh-key-vps.py')
    sys.exit(1)

print('🔌 Conectando à VPS usando chave SSH...')

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    # Conectar com chave Ed25519
    key = paramiko.Ed25519Key.from_private_key_file(ssh_key_path)
    client.connect('147.93.69.211', port=22, username='root', pkey=key, timeout=15)
    print('✅ Conectado à VPS com chave SSH')
    
    # Backup do arquivo de configuração SSH
    backup_cmd = 'cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup_$(date +%Y%m%d_%H%M%S)'
    stdin, stdout, stderr = client.exec_command(backup_cmd, timeout=10)
    stdout.read()
    print('✅ Backup do sshd_config criado')
    
    # Desabilitar autenticação por senha
    disable_password_cmds = [
        "sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config",
        "sed -i 's/^#*ChallengeResponseAuthentication .*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config",
        "sed -i 's/^#*UsePAM .*/UsePAM no/' /etc/ssh/sshd_config",
        "grep 'PasswordAuthentication' /etc/ssh/sshd_config | grep -v '^#'",  # Verificar
    ]
    
    for cmd in disable_password_cmds:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()
        
        if 'grep' in cmd and output:
            print(f'📝 Configuração atual: {output}')
    
    # Testar configuração antes de reiniciar
    print('🧪 Testando configuração do SSH...')
    stdin, stdout, stderr = client.exec_command('sshd -t', timeout=10)
    test_error = stderr.read().decode().strip()
    
    if test_error and 'error' in test_error.lower():
        print(f'❌ Erro na configuração do SSH: {test_error}')
        print('   Revertendo mudanças...')
        client.exec_command('cp /etc/ssh/sshd_config.backup_* /etc/ssh/sshd_config', timeout=10)
        client.close()
        sys.exit(1)
    
    print('✅ Configuração do SSH válida')
    
    # Reiniciar serviço SSH
    print('🔄 Reiniciando serviço SSH...')
    stdin, stdout, stderr = client.exec_command('systemctl restart sshd', timeout=15)
    stdout.read()
    
    # Verificar se o serviço está rodando
    stdin, stdout, stderr = client.exec_command('systemctl is-active sshd', timeout=10)
    status = stdout.read().decode().strip()
    
    if status == 'active':
        print('✅ Serviço SSH reiniciado com sucesso')
        print('')
        print('🎉 SUCESSO! Autenticação por senha foi desabilitada')
        print('   Apenas chaves SSH são aceitas agora.')
        print('')
        print('📝 Próximos passos:')
        print('   1. Atualizar .env: comente VPS_PASSWORD e use VPS_SSH_KEY_PATH')
        print('   2. Testar conexão SSH em outro terminal para garantir que funciona')
        print('   3. NÃO feche este terminal até testar!')
    else:
        print(f'⚠️  Status do SSH: {status}')
        print('   Verifique manualmente se o SSH está funcionando')
    
    client.close()
    
except Exception as e:
    print(f'❌ Erro: {e}')
    sys.exit(1)
