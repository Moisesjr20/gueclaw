#!/usr/bin/env python3
"""
Intercept Google OAuth callback via temporary Traefik-routed Docker container.
Starts a Python HTTP server in Docker with higher Traefik priority for the
/integrations/google/callback path, captures the code, exchanges for token.
"""
import json, os, sys, time, urllib.parse, urllib.request
from pathlib import Path
from dotenv import load_dotenv
import paramiko

BASE = str(Path(__file__).parent.parent)
load_dotenv(Path(BASE) / '.env')

CLIENT_ID     = os.getenv('GOOGLE_WORK_CLIENT_ID', '')
CLIENT_SECRET = os.getenv('GOOGLE_WORK_CLIENT_SECRET', '')
REDIRECT_URI  = os.getenv('GOOGLE_WORK_REDIRECT_URI', 'https://fluxohub.kyrius.com.br/integrations/google/callback')
SCOPE         = 'https://www.googleapis.com/auth/calendar'

if not CLIENT_ID or not CLIENT_SECRET:
    print('❌ GOOGLE_WORK_CLIENT_ID / GOOGLE_WORK_CLIENT_SECRET não encontrados no .env')
    sys.exit(1)

pw = os.getenv('VPS_PASSWORD', '')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)

# Step 1: find the traefik network and fluxohub network
print('🔍 Finding Traefik network...')
stdin, stdout, stderr = client.exec_command(
    'docker inspect fluxohub-api --format "{{json .NetworkSettings.Networks}}" 2>/dev/null', timeout=10
)
nets_raw = stdout.read().decode().strip()
nets = json.loads(nets_raw) if nets_raw else {}
network_name = list(nets.keys())[0] if nets else 'traefik_default'
print(f'  Network: {network_name}')

# Step 2: build the capture server Python code
capture_code = r"""
import http.server, urllib.parse, os, time

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        p = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = p.get('code', [''])[0]
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        if code:
            with open('/tmp/oauth_code.txt', 'w') as f:
                f.write(code)
            self.wfile.write(b'<html><body style="font-family:sans-serif;text-align:center;margin-top:80px"><h2>Autorizado com sucesso! Pode fechar esta aba.</h2></body></html>')
        else:
            error = p.get('error', ['unknown'])[0]
            self.wfile.write(f'<h2>Erro: {error}</h2>'.encode())
    def log_message(self, *a): pass

print('Capture server ready on :8000', flush=True)
http.server.HTTPServer(('', 8000), Handler).serve_forever()
""".strip()

# Step 3: start the interceptor container
container_name = 'oauth-capture-tmp'
print(f'\n🚀 Starting interceptor container: {container_name}')

# Remove existing if any
_, out_, _ = client.exec_command(f'docker rm -f {container_name} 2>/dev/null')
out_.read()
time.sleep(1)

run_cmd = (
    f'docker run -d --name {container_name} '
    f'--network {network_name} '
    f'--label "traefik.enable=true" '
    f'--label "traefik.http.routers.oauth-cap.rule=Host(\\"fluxohub.kyrius.com.br\\") && Path(\\"/integrations/google/callback\\")" '
    f'--label "traefik.http.routers.oauth-cap.priority=200" '
    f'--label "traefik.http.routers.oauth-cap.tls=true" '
    f'--label "traefik.http.routers.oauth-cap.tls.certresolver=letsencrypt" '
    f'--label "traefik.http.services.oauth-cap.loadbalancer.server.port=8000" '
    f'--label "traefik.http.routers.oauth-cap.entrypoints=websecure" '
    f'python:3.11-alpine python3 -c "{capture_code.replace(chr(10), "; ").replace(chr(34), chr(39))}"'
)

stdin, stdout, stderr = client.exec_command(run_cmd, timeout=30)
out = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f'  Container ID: {out[:12] if out else "ERROR"}')
if err:
    print(f'  ERR: {err[:300]}')
    
if not out or 'Error' in err:
    print('❌ Failed to start container')
    client.close()
    sys.exit(1)

# Wait for container to be ready
print('  Waiting for server to start...')
time.sleep(5)

# Step 4: show auth URL
auth_url = (
    'https://accounts.google.com/o/oauth2/v2/auth'
    f'?client_id={urllib.parse.quote(CLIENT_ID)}'
    f'&redirect_uri={urllib.parse.quote(REDIRECT_URI)}'
    '&response_type=code'
    f'&scope={urllib.parse.quote(SCOPE)}'
    '&access_type=offline'
    '&prompt=consent'
)

import webbrowser
print('\n' + '=' * 60)
print('Abrindo navegador para autorização...')
print('Faça login com: contato@kyrius.info')
print('=' * 60)
print()
print('URL (caso o navegador não abra):')
print(auth_url)
webbrowser.open(auth_url)

# Step 5: poll for the captured code
print('\n⏳ Aguardando autorização (timeout: 120s)...')
captured_code = None
for i in range(60):
    time.sleep(2)
    stdin, stdout, stderr = client.exec_command(
        f'cat /tmp/oauth_code.txt 2>/dev/null && rm -f /tmp/oauth_code.txt', timeout=5
    )
    code = stdout.read().decode().strip()
    if code:
        captured_code = code
        print(f'✅ Código capturado!')
        break
    if i % 5 == 0:
        print(f'  ... {(i+1)*2}s')

# Step 6: cleanup container
print('\n🧹 Removendo container temporário...')
_, out_, _ = client.exec_command(f'docker rm -f {container_name} 2>/dev/null')
out_.read()

if not captured_code:
    print('❌ Timeout — nenhum código capturado')
    client.close()
    sys.exit(1)

# Step 7: exchange code for tokens
print('🔄 Trocando código por refresh token...')
data = urllib.parse.urlencode({
    'code': captured_code,
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'redirect_uri': REDIRECT_URI,
    'grant_type': 'authorization_code',
}).encode()
req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        tokens = json.loads(resp.read())
except urllib.error.HTTPError as exc:
    print(f'❌ HTTP {exc.code}: {exc.read().decode()}')
    client.close()
    sys.exit(1)

refresh_token = tokens.get('refresh_token', '')
if not refresh_token:
    print('❌ Refresh token não retornado:', json.dumps(tokens, indent=2))
    client.close()
    sys.exit(1)

# Step 8: update .env and VPS
print(f'✅ Refresh token obtido: {refresh_token[:20]}...')

import re
env_path = os.path.join(BASE, '.env')
with open(env_path, encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'GOOGLE_WORK_REFRESH_TOKEN=.*', f'GOOGLE_WORK_REFRESH_TOKEN={refresh_token}', content)
with open(env_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('✅ .env local atualizado')

# Update VPS .env
sftp = client.open_sftp()
sftp.put(env_path, '/opt/gueclaw-agent/.env')
sftp.close()
print('✅ .env no VPS atualizado')

# Restart agent
stdin, stdout, stderr = client.exec_command('pm2 restart gueclaw-agent --update-env 2>&1 | tail -3', timeout=15)
print(stdout.read().decode().strip())

client.close()
print('\n🎉 CONCLUÍDO! Token profissional configurado e agente reiniciado.')
