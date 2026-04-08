#!/usr/bin/env python3
"""
🔒 GueClaw Security Audit - VPS Scanner
Análise diária de segurança automática da VPS

Funcionalidades:
- Verifica portas abertas
- Analisa logs de tentativas de invasão
- Monitora containers Docker
- Verifica atualizações de segurança pendentes
- Analisa uso de recursos suspeitos
- Envia relatório via Telegram
"""

import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path
import requests
from typing import Dict, List, Tuple

# Configurações da VPS
VPS_HOST = os.getenv('VPS_HOST', '147.93.69.211')
VPS_USER = os.getenv('VPS_USER', 'root')
VPS_SSH_KEY = os.getenv('VPS_SSH_KEY_PATH', r'C:\Users\kyriu\.ssh\gueclaw_vps')

# Configurações do Telegram
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_USER_ID = os.getenv('TELEGRAM_ALLOWED_USER_IDS', '').split(',')[0]

# Detecta se está rodando localmente na VPS
IS_LOCAL = sys.platform == 'linux' and (
    os.path.exists('/opt/gueclaw-agent') or 
    Path.cwd().as_posix().startswith('/opt/gueclaw-agent')
)


class SecurityAuditor:
    """Auditor de segurança da VPS"""
    
    def __init__(self):
        self.ssh = None
        self.is_local = IS_LOCAL
        self.report = {
            'timestamp': datetime.now().isoformat(),
            'vps': VPS_HOST,
            'status': 'OK',
            'alerts': [],
            'warnings': [],
            'info': []
        }
    
    def connect_vps(self) -> bool:
        """Conecta à VPS via SSH (ou detecta execução local)"""
        
        # Se está rodando localmente na VPS, não precisa SSH
        if self.is_local:
            print(f"✅ Executando localmente na VPS (modo local)")
            return True
        
        # Conecta remotamente via SSH
        try:
            import paramiko
            print(f"🔐 Conectando à VPS {VPS_USER}@{VPS_HOST}...")
            
            self.ssh = paramiko.SSHClient()
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Carrega a chave privada
            if Path(VPS_SSH_KEY).exists():
                key = paramiko.RSAKey.from_private_key_file(VPS_SSH_KEY)
                self.ssh.connect(VPS_HOST, port=22, username=VPS_USER, pkey=key, timeout=15)
            else:
                print(f"❌ Chave SSH não encontrada: {VPS_SSH_KEY}")
                return False
            
            print("✅ Conectado à VPS com sucesso")
            return True
            
        except ImportError:
            print("⚠️ Paramiko não disponível - usando modo local")
            self.is_local = True
            return True
        except Exception as e:
            print(f"❌ Erro ao conectar: {e}")
            self.report['alerts'].append(f"Falha ao conectar à VPS: {str(e)}")
            return False
    
    def exec_command(self, command: str) -> Tuple[str, str, int]:
        """Executa comando na VPS (local ou remoto) e retorna stdout, stderr e código de saída"""
        try:
            # Execução local (diretamente na VPS)
            if self.is_local:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                return result.stdout, result.stderr, result.returncode
            
            # Execução remota via SSH
            stdin, stdout, stderr = self.ssh.exec_command(command, timeout=30)
            exit_code = stdout.channel.recv_exit_status()
            return stdout.read().decode('utf-8'), stderr.read().decode('utf-8'), exit_code
            
        except subprocess.TimeoutExpired:
            return '', 'Command timeout', 124
        except Exception as e:
            return '', str(e), 1
    
    def check_open_ports(self):
        """Verifica portas abertas e compara com portas esperadas"""
        print("\n🔍 Verificando portas abertas...")
        
        # Portas esperadas (whitelist)
        expected_ports = {
            22: 'SSH',
            80: 'HTTP (Traefik)',
            443: 'HTTPS (Traefik)',
            3742: 'GueClaw API',
            8080: 'Traefik Dashboard'
        }
        
        stdout, stderr, code = self.exec_command("ss -tuln | grep LISTEN")
        
        if code != 0:
            self.report['warnings'].append("Não foi possível verificar portas abertas")
            return
        
        open_ports = []
        for line in stdout.split('\n'):
            if 'LISTEN' in line:
                parts = line.split()
                for part in parts:
                    if ':' in part:
                        try:
                            port = int(part.split(':')[-1])
                            if port not in open_ports:
                                open_ports.append(port)
                        except:
                            pass
        
        # Verifica portas inesperadas
        unexpected = [p for p in open_ports if p not in expected_ports and p > 1024]
        
        if unexpected:
            self.report['warnings'].append(f"Portas inesperadas abertas: {', '.join(map(str, unexpected))}")
        
        self.report['info'].append(f"Portas abertas: {len(open_ports)} ({', '.join(map(str, sorted(open_ports)))})")
    
    def check_failed_logins(self):
        """Analisa tentativas de login falhadas"""
        print("🔍 Analisando tentativas de invasão...")
        
        # Verifica logs de autenticação
        stdout, stderr, code = self.exec_command(
            "grep 'Failed password' /var/log/auth.log 2>/dev/null | tail -50"
        )
        
        if stdout:
            lines = stdout.strip().split('\n')
            failed_count = len([l for l in lines if l])
            
            if failed_count > 20:
                self.report['alerts'].append(
                    f"⚠️ {failed_count} tentativas de login falhadas detectadas nas últimas 50 entradas"
                )
            elif failed_count > 5:
                self.report['warnings'].append(
                    f"Atenção: {failed_count} tentativas de login falhadas recentes"
                )
            else:
                self.report['info'].append(f"Tentativas de login falhadas: {failed_count} (normal)")
        
        # Verifica IPs banidos pelo fail2ban (se instalado)
        stdout, stderr, code = self.exec_command("fail2ban-client status sshd 2>/dev/null || echo 'fail2ban não instalado'")
        
        if 'Currently banned' in stdout:
            banned = stdout.split('Currently banned:')[-1].strip()
            if banned and banned != '0':
                self.report['info'].append(f"IPs banidos pelo fail2ban: {banned}")
    
    def check_docker_containers(self):
        """Verifica status dos containers Docker"""
        print("🐳 Verificando containers Docker...")
        
        stdout, stderr, code = self.exec_command("docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Image}}'")
        
        if code != 0:
            self.report['warnings'].append("Não foi possível verificar containers Docker")
            return
        
        containers = []
        stopped_containers = []
        
        for line in stdout.strip().split('\n'):
            if line:
                parts = line.split('\t')
                if len(parts) >= 2:
                    name = parts[0]
                    status = parts[1]
                    
                    containers.append(name)
                    
                    if 'Exited' in status or 'Dead' in status:
                        stopped_containers.append(f"{name} ({status})")
        
        if stopped_containers:
            self.report['alerts'].append(
                f"⚠️ Containers parados: {', '.join(stopped_containers)}"
            )
        
        self.report['info'].append(f"Containers ativos: {len(containers) - len(stopped_containers)}/{len(containers)}")
    
    def check_resource_usage(self):
        """Verifica uso de CPU e memória"""
        print("📊 Verificando uso de recursos...")
        
        # CPU
        stdout, stderr, code = self.exec_command(
            "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/'"
        )
        if stdout.strip():
            try:
                idle_cpu = float(stdout.strip())
                cpu_usage = 100 - idle_cpu
                
                if cpu_usage > 90:
                    self.report['alerts'].append(f"⚠️ CPU em {cpu_usage:.1f}% de uso!")
                elif cpu_usage > 70:
                    self.report['warnings'].append(f"CPU em {cpu_usage:.1f}% de uso")
                else:
                    self.report['info'].append(f"CPU: {cpu_usage:.1f}% de uso")
            except:
                pass
        
        # Memória
        stdout, stderr, code = self.exec_command("free -m | grep Mem")
        if stdout:
            parts = stdout.split()
            if len(parts) >= 3:
                total = int(parts[1])
                used = int(parts[2])
                usage_percent = (used / total) * 100
                
                if usage_percent > 90:
                    self.report['alerts'].append(f"⚠️ Memória em {usage_percent:.1f}% de uso!")
                elif usage_percent > 75:
                    self.report['warnings'].append(f"Memória em {usage_percent:.1f}% de uso")
                else:
                    self.report['info'].append(f"Memória: {usage_percent:.1f}% de uso ({used}MB/{total}MB)")
    
    def check_disk_space(self):
        """Verifica espaço em disco"""
        print("💾 Verificando espaço em disco...")
        
        stdout, stderr, code = self.exec_command("df -h / | tail -1")
        
        if stdout:
            parts = stdout.split()
            if len(parts) >= 5:
                usage = parts[4].replace('%', '')
                try:
                    usage_percent = int(usage)
                    
                    if usage_percent > 90:
                        self.report['alerts'].append(f"⚠️ Disco com {usage_percent}% de uso!")
                    elif usage_percent > 80:
                        self.report['warnings'].append(f"Disco com {usage_percent}% de uso")
                    else:
                        self.report['info'].append(f"Disco: {usage_percent}% de uso")
                except:
                    pass
    
    def check_security_updates(self):
        """Verifica atualizações de segurança pendentes"""
        print("🔄 Verificando atualizações de segurança...")
        
        # Ubuntu/Debian
        stdout, stderr, code = self.exec_command(
            "apt-get update > /dev/null 2>&1 && apt-get -s upgrade | grep -i security | wc -l"
        )
        
        if stdout.strip().isdigit():
            count = int(stdout.strip())
            if count > 0:
                self.report['warnings'].append(
                    f"{count} atualizações de segurança pendentes. Execute: apt-get upgrade"
                )
            else:
                self.report['info'].append("Sistema atualizado (sem updates de segurança pendentes)")
    
    def check_gueclaw_status(self):
        """Verifica se o GueClaw está rodando"""
        print("🤖 Verificando status do GueClaw...")
        
        # Verifica processo Node.js do GueClaw
        stdout, stderr, code = self.exec_command("pgrep -f 'node.*gueclaw' | wc -l")
        
        if stdout.strip().isdigit():
            count = int(stdout.strip())
            if count == 0:
                self.report['alerts'].append("⚠️ GueClaw não está rodando!")
            else:
                self.report['info'].append(f"GueClaw ativo ({count} processo(s))")
        
        # Testa endpoint da API
        try:
            response = requests.get(f'http://{VPS_HOST}:3742/health', timeout=5)
            if response.status_code == 200:
                self.report['info'].append("API GueClaw respondendo normalmente")
            else:
                self.report['warnings'].append(f"API respondeu com status {response.status_code}")
        except Exception as e:
            self.report['alerts'].append(f"⚠️ API não está respondendo: {str(e)}")
    
    def format_report(self) -> str:
        """Formata o relatório em texto"""
        lines = [
            "🔒 *RELATÓRIO DE SEGURANÇA VPS*",
            f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}",
            f"🖥️ VPS: {VPS_HOST}",
            ""
        ]
        
        # Alertas críticos
        if self.report['alerts']:
            lines.append("⚠️ *ALERTAS CRÍTICOS:*")
            for alert in self.report['alerts']:
                lines.append(f"  • {alert}")
            lines.append("")
        
        # Avisos
        if self.report['warnings']:
            lines.append("⚡ *AVISOS:*")
            for warning in self.report['warnings']:
                lines.append(f"  • {warning}")
            lines.append("")
        
        # Informações
        if self.report['info']:
            lines.append("ℹ️ *INFORMAÇÕES:*")
            for info in self.report['info']:
                lines.append(f"  • {info}")
            lines.append("")
        
        # Status geral
        if self.report['alerts']:
            lines.append("🔴 *Status: ATENÇÃO NECESSÁRIA*")
        elif self.report['warnings']:
            lines.append("🟡 *Status: VERIFICAR*")
        else:
            lines.append("🟢 *Status: TUDO OK*")
        
        return '\n'.join(lines)
    
    def send_telegram_report(self):
        """Envia relatório via Telegram"""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_USER_ID:
            print("⚠️ Credenciais do Telegram não configuradas")
            return False
        
        message = self.format_report()
        
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            data = {
                'chat_id': TELEGRAM_USER_ID,
                'text': message,
                'parse_mode': 'Markdown'
            }
            
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                print("✅ Relatório enviado via Telegram")
                return True
            else:
                print(f"❌ Erro ao enviar Telegram: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erro ao enviar Telegram: {e}")
            return False
    
    def run_audit(self):
        """Executa auditoria completa"""
        print("="*60)
        print("🔒 GueClaw Security Audit - Iniciando varredura")
        print("="*60)
        
        if not self.connect_vps():
            print("\n❌ Não foi possível conectar à VPS. Abortando auditoria.")
            return False
        
        try:
            # Executa todas as verificações
            self.check_open_ports()
            self.check_failed_logins()
            self.check_docker_containers()
            self.check_resource_usage()
            self.check_disk_space()
            self.check_security_updates()
            self.check_gueclaw_status()
            
            print("\n" + "="*60)
            print("📊 Auditoria concluída!")
            print("="*60)
            
            # Exibe relatório
            print("\n" + self.format_report())
            
            # Envia via Telegram
            self.send_telegram_report()
            
            return True
            
        except Exception as e:
            print(f"\n❌ Erro durante auditoria: {e}")
            self.report['alerts'].append(f"Erro crítico: {str(e)}")
            return False
        
        finally:
            if self.ssh:
                self.ssh.close()
                print("\n🔌 Conexão SSH encerrada")


def main():
    """Função principal"""
    auditor = SecurityAuditor()
    success = auditor.run_audit()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
