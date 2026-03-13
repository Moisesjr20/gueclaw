#!/usr/bin/env node
const { spawn } = require('child_process');

const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('📜 Fetching detailed logs...\n');

const ssh = spawn('ssh', [
  'root@147.93.69.211',
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
