#!/usr/bin/env python3
"""
GueClaw - Generate Google OAuth Refresh Token (Professional Account)
Starts a local HTTP server on port 8080 to automatically capture the code.

BEFORE RUNNING:
  1. Go to Google Cloud Console → project 835900290757
  2. APIs & Services → Credentials → OAuth 2.0 Client ID (Desktop / Web)
  3. Authorized redirect URIs → Add: http://localhost:8080
  4. Save, then run this script.

Usage:
  python3 scripts/generate-google-token.py
"""

import http.server
import json
import os
import threading
import urllib.parse
import urllib.request
import webbrowser

import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

CLIENT_ID     = os.getenv('GOOGLE_WORK_CLIENT_ID', '')
CLIENT_SECRET = os.getenv('GOOGLE_WORK_CLIENT_SECRET', '')
REDIRECT_URI  = 'http://localhost:8080'
SCOPE         = 'https://www.googleapis.com/auth/calendar'

if not CLIENT_ID or not CLIENT_SECRET:
    print('❌ GOOGLE_WORK_CLIENT_ID / GOOGLE_WORK_CLIENT_SECRET não encontrados no .env')
    raise SystemExit(1)

captured_code = None
server_done   = threading.Event()


class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global captured_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        code_list = params.get('code', [])
        if code_list:
            captured_code = code_list[0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(
                b'<html><body style="font-family:sans-serif;text-align:center;margin-top:80px">'
                b'<h2>&#x2705; Autorizado com sucesso!</h2>'
                b'<p>Pode fechar esta aba e voltar ao terminal.</p>'
                b'</body></html>'
            )
        else:
            self.send_response(400)
            self.end_headers()
            error = params.get('error', ['unknown'])[0]
            self.wfile.write(f'Erro: {error}'.encode())
        server_done.set()

    def log_message(self, *args):
        pass  # suppress server logs


auth_url = (
    'https://accounts.google.com/o/oauth2/v2/auth'
    f'?client_id={urllib.parse.quote(CLIENT_ID)}'
    f'&redirect_uri={urllib.parse.quote(REDIRECT_URI)}'
    '&response_type=code'
    f'&scope={urllib.parse.quote(SCOPE)}'
    '&access_type=offline'
    '&prompt=consent'
)

print('=' * 60)
print('GueClaw — Google OAuth Setup (Conta Profissional)')
print('=' * 60)
print()
print('Abrindo navegador para autorização...')
print('Faça login com: contato@kyrius.info')
print()
print('Se o navegador não abrir, acesse:')
print(auth_url)
print()

# Start local server
server = http.server.HTTPServer(('localhost', 8080), OAuthHandler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

# Open browser
webbrowser.open(auth_url)

print('Aguardando autorização no navegador...')
server_done.wait(timeout=120)
server.shutdown()

if not captured_code:
    print('❌ Timeout ou erro — nenhum código capturado.')
    raise SystemExit(1)

print('✅ Código capturado! Trocando por refresh token...')

data = urllib.parse.urlencode({
    'code': captured_code,
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'redirect_uri': REDIRECT_URI,
    'grant_type': 'authorization_code',
}).encode()

req = urllib.request.Request(
    'https://oauth2.googleapis.com/token', data=data, method='POST'
)
req.add_header('Content-Type', 'application/x-www-form-urlencoded')

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        tokens = json.loads(resp.read())
except urllib.error.HTTPError as exc:
    body = exc.read().decode()
    print(f'❌ Erro HTTP {exc.code}: {body}')
    raise SystemExit(1)

refresh_token = tokens.get('refresh_token', '')
if not refresh_token:
    print('❌ Refresh token não retornado. Revogue o acesso em')
    print('   https://myaccount.google.com/permissions e tente de novo.')
    print('Resposta:', json.dumps(tokens, indent=2))
    raise SystemExit(1)

# Write directly to .env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
with open(env_path, encoding='utf-8') as f:
    content = f.read()

if 'GOOGLE_WORK_REFRESH_TOKEN=' in content:
    import re
    content = re.sub(
        r'GOOGLE_WORK_REFRESH_TOKEN=.*',
        f'GOOGLE_WORK_REFRESH_TOKEN={refresh_token}',
        content,
    )
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print()
    print('=' * 60)
    print('✅ SUCESSO! .env atualizado automaticamente.')
    print('=' * 60)
    print()
    print(f'GOOGLE_WORK_REFRESH_TOKEN={refresh_token[:20]}...')
    print()
    print('Agora execute o deploy:')
    print('  python3 scripts/deploy-calendar-skills.py')
else:
    print()
    print('=' * 60)
    print('✅ Token gerado! Adicione manualmente ao .env:')
    print(f'GOOGLE_WORK_REFRESH_TOKEN={refresh_token}')
