#!/usr/bin/env node
const { spawn } = require('child_process');

const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('🔄 Restarting bot...\n');

const restart = spawn('ssh', ['root@147.93.69.211', 'pm2 restart gueclaw-agent'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

restart.stdout.on('data', (data) => process.stdout.write(data.toString()));
restart.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('password:')) {
    restart.stdin.write(VPS_PASSWORD + '\n');
  } else {
    process.stderr.write(output);
  }
});

restart.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Bot restarted successfully!\n');
    console.log('📋 Test by sending a message to the Telegram bot.');
  }
  process.exit(code);
});
