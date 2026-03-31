#!/usr/bin/env python3
"""
Script para configurar a chave SSH Ed25519 na VPS e desabilitar autenticação por senha
"""
import paramiko
import sys
import os

# Ler senha da VPS do .env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
vps_password = None

with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('VPS_PASSWORD='):
            vps_password = line.split('=', 1)[1].strip()
            break

if not vps_password:
    print('❌ VPS_PASSWORD não encontrado no .env')
    sys.exit(1)

# Ler a chave pública gerada
ssh_key_pub_path = os.path.expanduser('~/.ssh/gueclaw_vps.pub')
if not os.path.exists(ssh_key_pub_path):
    print(f'❌ Chave pública não encontrada em: {ssh_key_pub_path}')
    sys.exit(1)

with open(ssh_key_pub_path, 'r') as f:
    public_key = f.read().strip()

print(f'🔑 Chave pública: {public_key[:50]}...')
print('🔌 Conectando à VPS com senha (última vez)...')

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('147.93.69.211', port=22, username='root', password=vps_password, timeout=15)
    print('✅ Conectado à VPS')
    
    # Criar diretório .ssh se não existir e configurar permissões
    commands = [
        'mkdir -p ~/.ssh',
        'chmod 700 ~/.ssh',
        f'echo "{public_key}" >> ~/.ssh/authorized_keys',
        'chmod 600 ~/.ssh/authorized_keys',
        'cat ~/.ssh/authorized_keys | tail -n 1'  # Mostrar a chave adicionada
    ]
    
    for cmd in commands:
        print(f'📝 Executando: {cmd[:60]}...')
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()
        
        if error and 'mkdir' not in cmd:  # mkdir pode dar erro se já existir, ok
            print(f'⚠️  Stderr: {error}')
        
        if output and 'cat' in cmd:
            print(f'✅ Chave adicionada: {output[:60]}...')
    
    print('')
    print('🎉 Chave SSH configurada com sucesso na VPS!')
    print('')
    print('🧪 Testando conexão com a nova chave...')
    client.close()
    
    # Testar conexão com chave SSH
    ssh_key_path = os.path.expanduser('~/.ssh/gueclaw_vps')
    test_client = paramiko.SSHClient()
    test_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        key = paramiko.Ed25519Key.from_private_key_file(ssh_key_path)
        test_client.connect('147.93.69.211', port=22, username='root', pkey=key, timeout=10)
        print('✅ Conexão SSH com chave funcionando!')
        
        # Executar comando de teste
        stdin, stdout, stderr = test_client.exec_command('whoami', timeout=5)
        result = stdout.read().decode().strip()
        print(f'✅ Comando de teste executado: whoami = {result}')
        
        test_client.close()
        
        print('')
        print('⚠️  IMPORTANTE: A autenticação por senha AINDA ESTÁ ATIVA')
        print('   Para desabilitá-la (recomendado), execute:')
        print('   python scripts/disable-ssh-password.py')
        print('')
        print('✅ Você pode atualizar o .env agora:')
        print('   VPS_SSH_KEY_PATH=C:\\Users\\kyriu\\.ssh\\gueclaw_vps')
        print('   # VPS_PASSWORD=...  (comente ou remova)')
        
    except Exception as e:
        print(f'❌ Falha ao testar conexão com chave: {e}')
        print('   A chave foi adicionada, mas pode haver um problema.')
        sys.exit(1)
    
except Exception as e:
    print(f'❌ Erro ao conectar à VPS: {e}')
    sys.exit(1)
