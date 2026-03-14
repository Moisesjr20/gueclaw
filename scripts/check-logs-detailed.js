#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');

const VPS_USER = process.env.VPS_USER || 'root';
const VPS_HOST = (process.env.VPS_HOST || '147.93.69.211').replace(/^[^@]*@/, '');
const VPS_PASSWORD = process.env.VPS_PASSWORD || '';

if (!VPS_PASSWORD) {
  console.error('❌ VPS_PASSWORD not set in .env');
  process.exit(1);
}

console.log('📜 Fetching detailed logs...\n');

const ssh = spawn('ssh', [
  `${VPS_USER}@${VPS_HOST}`,
  'pm2 logs gueclaw-agent --lines 100 --nostream'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasPromptedPassword = false;

ssh.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

ssh.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('password:') && !hasPromptedPassword) {
    hasPromptedPassword = true;
    ssh.stdin.write(VPS_PASSWORD + '\n');
  } else if (output.includes('Are you sure you want to continue connecting')) {
    ssh.stdin.write('yes\n');
  } else {
    process.stderr.write(output);
  }
});

ssh.on('close', (code) => {
  process.exit(code);
});
