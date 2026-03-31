#!/usr/bin/env python3
"""
Configure UFW firewall on VPS with secure defaults
"""
import paramiko
import sys
import os

# Conectar usando chave SSH
ssh_key_path = os.path.expanduser('~/.ssh/gueclaw_vps')

if not os.path.exists(ssh_key_path):
    print(f'❌ SSH key not found: {ssh_key_path}')
    sys.exit(1)

print('🔥 Configurando Firewall UFW na VPS...')
print('')

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    key = paramiko.Ed25519Key.from_private_key_file(ssh_key_path)
    client.connect('147.93.69.211', port=22, username='root', pkey=key, timeout=15)
    print('✅ Conectado à VPS')
    
    # Comandos UFW
    firewall_commands = [
        ('ufw --version', 'Verificando UFW'),
        ('ufw --force reset', 'Resetando regras anteriores'),
        ('ufw default deny incoming', 'Bloqueando tráfego de entrada por padrão'),
        ('ufw default allow outgoing', 'Permitindo tráfego de saída por padrão'),
        ('ufw allow 22/tcp comment "SSH"', 'Permitindo SSH (porta 22)'),
        ('ufw allow 80/tcp comment "HTTP"', 'Permitindo HTTP (porta 80)'),
        ('ufw allow 443/tcp comment "HTTPS"', 'Permitindo HTTPS (porta 443)'),
        ('ufw logging on', 'Habilitando logs do firewall'),
        ('ufw --force enable', 'Ativando firewall'),
        ('ufw status verbose', 'Status final'),
    ]
    
    print('')
    for cmd, description in firewall_commands:
        print(f'📝 {description}...')
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()
        
        if 'status' in cmd.lower():
            print('━━━━━━━━━━━━━━━━━━━━━━━')
            print(output)
            print('━━━━━━━━━━━━━━━━━━━━━━━')
        elif error and 'Skipping' not in error:
            print(f'   ⚠️  {error[:100]}')
        elif output and 'Rule added' in output:
            print(f'   ✅ Regra adicionada')
        elif output:
            print(f'   ✅ {output[:80]}')
    
    print('')
    print('🎉 Firewall UFW configurado com sucesso!')
    print('')
    print('📋 Portas abertas:')
    print('   • 22 (SSH) - Acesso remoto')
    print('   • 80 (HTTP) - Servidor web')
    print('   • 443 (HTTPS) - Servidor web seguro')
    print('')
    print('🔒 Todas as outras portas estão bloqueadas por padrão.')
    print('')
    
    client.close()
    
except Exception as e:
    print(f'❌ Erro: {e}')
    sys.exit(1)
