#!/usr/bin/env python3
"""
deploy-and-test.py
Deploya o GueClaw na VPS via SSH (paramiko) e verifica o status do PM2.
Lê as credenciais do .env local.
"""
import os
import sys
import re
import paramiko
from pathlib import Path

# ── Carregar .env ─────────────────────────────────────────────────────────────
def load_dotenv():
    env_path = Path(__file__).parent.parent / ".env"
    env = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        idx = line.find("=")
        if idx == -1:
            continue
        env[line[:idx].strip()] = line[idx+1:].strip()
    return env

env = load_dotenv()
VPS_HOST = "147.93.69.211"
VPS_USER = "root"
VPS_PASSWORD = env.get("VPS_PASSWORD", os.environ.get("VPS_PASSWORD", ""))
VPS_PORT = 22

if not VPS_PASSWORD:
    print("❌  VPS_PASSWORD não encontrado no .env")
    sys.exit(1)

# ── SSH helper ────────────────────────────────────────────────────────────────
def ssh_run(client, cmd, label=""):
    print(f"\n{'─'*50}")
    print(f"▶  {label or cmd}")
    print(f"{'─'*50}")
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    return code, out, err

# ── Conectar ──────────────────────────────────────────────────────────────────
print(f"\n🔌  Conectando em {VPS_USER}@{VPS_HOST}:{VPS_PORT} ...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASSWORD, timeout=15)
    print("✅  Conectado\n")
except Exception as e:
    print(f"❌  Falha ao conectar: {e}")
    sys.exit(1)

# ── Etapa 1: Estado atual ─────────────────────────────────────────────────────
code, out, _ = ssh_run(client,
    "cd /opt/gueclaw-agent && git log --oneline -3 && echo '---' && pm2 status gueclaw-agent 2>&1 || true",
    "Estado atual (git log + PM2)")
print()

# ── Etapa 2: Update (git pull + build + restart) ──────────────────────────────
code, out, err = ssh_run(client,
    "cd /opt/gueclaw-agent && bash update.sh 2>&1",
    "Rodando update.sh")

if code != 0:
    print(f"\n❌  update.sh falhou com código {code}")
    client.close()
    sys.exit(1)

# ── Etapa 3: Smoke test PM2 ───────────────────────────────────────────────────
smoke_cmd = """python3 -c "
import subprocess, json, sys
result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True)
procs = json.loads(result.stdout)
agent = next((p for p in procs if p['name'] == 'gueclaw-agent'), None)
if not agent:
    print('NOT_FOUND')
    sys.exit(1)
status = agent['pm2_env']['status']
restarts = agent['pm2_env'].get('restart_time', 0)
mem = agent['monit']['memory'] // 1024 // 1024
cpu = agent['monit']['cpu']
print(f'status={status} restarts={restarts} mem={mem}MB cpu={cpu}%')
sys.exit(0 if status == 'online' else 1)
" 2>&1"""

code, out, _ = ssh_run(client, smoke_cmd, "Smoke test — PM2 status")

print("\n" + "═"*50)
if code == 0:
    print("✅  DEPLOY OK — gueclaw-agent online")
    print(out.strip())
else:
    print("❌  DEPLOY FALHOU — gueclaw-agent não está online")
    ssh_run(client, "pm2 logs gueclaw-agent --lines 30 --nostream 2>&1", "Últimos logs PM2")

client.close()
sys.exit(code)
