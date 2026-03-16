#!/usr/bin/env node
/**
 * scripts/debug-api.js
 *
 * SSH tunnel + CLI helpers for the GueClaw Debug API.
 * Forwards VPS port 3742 → localhost:3742 using Python paramiko (same pattern as the agent).
 *
 * Usage:
 *   node scripts/debug-api.js health
 *   node scripts/debug-api.js simulate "Liste os grupos do WhatsApp"
 *   node scripts/debug-api.js simulate "Qual é o status do servidor?" --user myUser
 *   node scripts/debug-api.js logs [lines]
 *   node scripts/debug-api.js conversations [userId]
 *   node scripts/debug-api.js trace <conversationId>
 *   node scripts/debug-api.js stats
 *   node scripts/debug-api.js messages <conversationId>
 *   node scripts/debug-api.js tunnel   ← just open the tunnel and keep it alive
 */

'use strict';

const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const VPS_HOST = process.env.VPS_HOST || '147.93.69.211';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PORT_SSH = Number(process.env.VPS_PORT_SSH) || 22;
const REMOTE_API_PORT = 3742;
const LOCAL_API_PORT = 3742;
const BASE_URL = `http://127.0.0.1:${LOCAL_API_PORT}`;

// ── SSH tunnel via Python (reuses existing paramiko pattern) ──────────────────
function buildTunnelScript() {
  return `
import sys, time, threading
import paramiko

def get_password():
    env_path = '${path.resolve(__dirname, '../.env').replace(/\\/g, '/')}'
    try:
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                if line.startswith('VPS_PASSWORD='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return None

pw = get_password()
if not pw:
    print('ERROR: VPS_PASSWORD not found in .env', file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('${VPS_HOST}', port=${VPS_PORT_SSH}, username='${VPS_USER}', password=pw, timeout=15)

transport = client.get_transport()
transport.request_port_forward('', ${REMOTE_API_PORT})

from paramiko.transport import Transport
import socket

def forward():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', ${LOCAL_API_PORT}))
    server.listen(5)
    while True:
        try:
            client_sock, _ = server.accept()
            remote_sock = transport.open_channel('direct-tcpip', ('127.0.0.1', ${REMOTE_API_PORT}), ('127.0.0.1', 0))
            def bridge(a, b):
                while True:
                    try:
                        data = a.recv(4096)
                        if not data: break
                        b.sendall(data)
                    except: break
                try: a.close()
                except: pass
                try: b.close()
                except: pass
            threading.Thread(target=bridge, args=(client_sock, remote_sock), daemon=True).start()
            threading.Thread(target=bridge, args=(remote_sock, client_sock), daemon=True).start()
        except Exception as e:
            pass

t = threading.Thread(target=forward, daemon=True)
t.start()
print('TUNNEL_READY', flush=True)
sys.stdout.flush()

# Keep alive
while True:
    time.sleep(30)
    try:
        transport.send_ignore()
    except Exception:
        print('TUNNEL_LOST', flush=True)
        sys.exit(1)
`;
}

// ── Tunnel management ─────────────────────────────────────────────────────────
let tunnelProcess = null;

function openTunnel() {
  return new Promise((resolve, reject) => {
    const script = buildTunnelScript();
    const proc = spawn('python3', ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProcess = proc;

    let ready = false;
    proc.stdout.on('data', (data) => {
      const str = data.toString();
      if (str.includes('TUNNEL_READY') && !ready) {
        ready = true;
        console.log('🔗 SSH tunnel open');
        resolve(proc);
      }
      if (str.includes('TUNNEL_LOST')) {
        console.error('❌ SSH tunnel lost');
        process.exit(1);
      }
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) process.stderr.write(`[tunnel] ${msg}\n`);
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (!ready) reject(new Error(`Tunnel process exited with code ${code}`));
    });

    // Timeout
    setTimeout(() => {
      if (!ready) reject(new Error('Tunnel did not become ready within 15s'));
    }, 15000);
  });
}

function closeTunnel() {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: '127.0.0.1',
      port: LOCAL_API_PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Pretty print ──────────────────────────────────────────────────────────────
function printTrace(trace) {
  if (!trace || trace.length === 0) { console.log('  (no trace)'); return; }
  trace.forEach(t => {
    const prefix = t.toolName ? `  [iter ${t.iteration}] 🔧 ${t.toolName}` : `  [iter ${t.iteration}] 💭 thought`;
    console.log(prefix);
    if (t.thought) console.log(`    thought: ${t.thought.substring(0, 200)}`);
    if (t.toolArgs) {
      try { console.log(`    args: ${JSON.stringify(JSON.parse(t.toolArgs), null, 2).substring(0, 300)}`); }
      catch { console.log(`    args: ${t.toolArgs?.substring(0, 300)}`); }
    }
    if (t.toolResult) console.log(`    result: ${t.toolResult.substring(0, 300)}`);
    if (t.finishReason) console.log(`    finish: ${t.finishReason}`);
  });
}

// ── Commands ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  if (cmd !== 'tunnel') {
    await openTunnel();
  }

  try {
    switch (cmd) {
      case 'health': {
        const data = await apiRequest('GET', '/api/health');
        console.log('✅ API health:', data);
        break;
      }

      case 'simulate': {
        const input = args[1];
        if (!input) { console.error('Usage: simulate "<message>" [--user <userId>]'); process.exit(1); }
        const userIdx = args.indexOf('--user');
        const userId = userIdx >= 0 ? args[userIdx + 1] : 'debug-cli';

        console.log(`📤 Simulating: "${input}" (user: ${userId})`);
        const data = await apiRequest('POST', '/api/simulate', { userId, input });

        console.log(`\n🎯 Skill routed: ${data.skillRouted || 'none (general loop)'}`);
        console.log(`⏱️  Duration: ${data.durationMs}ms`);
        console.log(`🔁 Iterations: ${data.iterations}`);
        console.log(`\n📝 Response:\n${data.response}`);
        console.log('\n🔍 Trace:');
        printTrace(data.trace);
        console.log(`\n💾 Conversation ID: ${data.conversationId}`);
        break;
      }

      case 'logs': {
        const lines = Number(args[1]) || 50;
        const data = await apiRequest('GET', `/api/logs/tail?lines=${lines}`);
        if (data.error) { console.error('Error:', data.error); break; }
        console.log(`📋 Last ${lines} lines of ${data.path}:\n`);
        console.log(data.lines.join('\n'));
        break;
      }

      case 'conversations': {
        const userId = args[1];
        const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const data = await apiRequest('GET', `/api/conversations${qs}`);
        console.log(`💬 Conversations (${data.length}):`);
        data.forEach(c => {
          console.log(`  ${c.id} | user: ${c.user_id} | msgs: ${c.message_count} | updated: ${new Date(c.updated_at * 1000).toISOString()}`);
        });
        break;
      }

      case 'trace': {
        const convId = args[1];
        if (!convId) { console.error('Usage: trace <conversationId>'); process.exit(1); }
        const data = await apiRequest('GET', `/api/conversations/${convId}/trace`);
        console.log(`🔍 Trace for conversation ${convId} (${data.length} entries):\n`);
        printTrace(data);
        break;
      }

      case 'messages': {
        const convId = args[1];
        if (!convId) { console.error('Usage: messages <conversationId>'); process.exit(1); }
        const data = await apiRequest('GET', `/api/conversations/${convId}/messages`);
        console.log(`📨 Messages for conversation ${convId} (${data.length}):\n`);
        data.forEach(m => console.log(`  [${m.role}] ${m.content.substring(0, 200)}`));
        break;
      }

      case 'stats': {
        const data = await apiRequest('GET', '/api/stats');
        console.log('📊 Stats:', JSON.stringify(data, null, 2));
        break;
      }

      case 'tunnel': {
        console.log('🔗 Opening tunnel and keeping alive (Ctrl+C to stop)...');
        await openTunnel();
        console.log(`✅ Tunnel active — API available at ${BASE_URL}`);
        await new Promise(() => {}); // keep alive
        break;
      }

      default: {
        console.log(`GueClaw Debug API CLI

Commands:
  health                         Check API health
  simulate "<message>" [--user X] Simulate a Telegram message
  logs [lines]                   Tail PM2 logs (default: 50 lines)
  conversations [userId]         List recent conversations
  trace <conversationId>         Show execution trace
  messages <conversationId>      Show conversation messages
  stats                          Show execution stats
  tunnel                         Open SSH tunnel and keep alive
`);
      }
    }
  } finally {
    if (cmd !== 'tunnel') closeTunnel();
  }
}

main().catch(err => {
  console.error('❌', err.message);
  closeTunnel();
  process.exit(1);
});
