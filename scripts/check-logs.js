#!/usr/bin/env node
/**
 * Quick script to check PM2 logs remotely
 */

const { spawn } = require('child_process');

const VPS_HOST = '147.93.69.211';
const VPS_USER = 'root';
const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('📜 Fetching logs from VPS...\n');

const ssh = spawn('ssh', [
  `${VPS_USER}@${VPS_HOST}`,
  'pm2 logs gueclaw-agent --lines 40 --nostream'
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

ssh.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
