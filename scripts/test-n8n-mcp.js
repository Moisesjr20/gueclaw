#!/usr/bin/env node
/**
 * test-n8n-mcp.js
 * Valida a conectividade e autenticação com a instância n8n antes de usar o MCP.
 *
 * Uso:
 *   node scripts/test-n8n-mcp.js
 *
 * Lê N8N_API_URL e N8N_API_KEY do .env ou das variáveis de ambiente do sistema.
 */

const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");

// ── Carregar .env manualmente (sem dependência externa) ───────────────────────
function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

// ── Config ─────────────────────────────────────────────────────────────────────
const N8N_API_URL = (process.env.N8N_API_URL || "").replace(/\/$/, "");
const N8N_API_KEY = process.env.N8N_API_KEY || "";

if (!N8N_API_URL || !N8N_API_KEY) {
  console.error("❌  ERRO: N8N_API_URL e/ou N8N_API_KEY não definidos no .env");
  process.exit(1);
}

console.log(`\n🔍  Testando conectividade com n8n MCP`);
console.log(`    URL : ${N8N_API_URL}`);
console.log(`    KEY : ${N8N_API_KEY.slice(0, 20)}...\n`);

// ── Suite de testes ────────────────────────────────────────────────────────────
const tests = [
  {
    name: "GET /api/v1/workflows",
    path: "/api/v1/workflows?limit=5",
    expect: (status, body) => {
      if (status !== 200) throw new Error(`Status ${status} — esperado 200`);
      const data = JSON.parse(body);
      if (!Array.isArray(data.data)) throw new Error("Campo 'data' não é array");
      return `${data.data.length} workflow(s) encontrado(s)`;
    },
  },
  {
    name: "GET /api/v1/executions (últimas 3)",
    path: "/api/v1/executions?limit=3",
    expect: (status, body) => {
      if (status !== 200) throw new Error(`Status ${status} — esperado 200`);
      const data = JSON.parse(body);
      if (!Array.isArray(data.data)) throw new Error("Campo 'data' não é array");
      return `${data.data.length} execução(ões) recente(s)`;
    },
  },
  {
    name: "GET /api/v1/credentials (lista de tipos)",
    path: "/api/v1/credentials",
    expect: (status, body) => {
      // 200 = ok, 403 = sem permissão (mas API está viva)
      if (status === 403) return "403 Proibido (API viva, sem permissão para credentials)";
      if (status !== 200) throw new Error(`Status ${status} inesperado`);
      const data = JSON.parse(body);
      return `${(data.data || []).length} credential(s)`;
    },
  },
];

// ── HTTP helper ────────────────────────────────────────────────────────────────
function request(urlStr, apiPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${urlStr}${apiPath}`;
    const parsed = new URL(fullUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "X-N8N-API-KEY": apiPath.startsWith("/api") ? N8N_API_KEY : undefined,
        "Content-Type": "application/json",
        "X-N8N-API-KEY": N8N_API_KEY,
      },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout após 10s"));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Executor ───────────────────────────────────────────────────────────────────
async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`  [ ] ${test.name} ... `);
    try {
      const { status, body } = await request(N8N_API_URL, test.path);
      const msg = test.expect(status, body);
      console.log(`✅  ${msg}`);
      passed++;
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log(`\n✅  API n8n OK — pode ativar n8n-mcp-full no mcp.json\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Alguns testes falharam. Verifique a URL/KEY antes de ativar o MCP.\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌  Erro fatal:", err.message);
  process.exit(1);
});
