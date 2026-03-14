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

console.log('🔄 Restarting bot...\n');

const restart = spawn('ssh', [`${VPS_USER}@${VPS_HOST}`, 'pm2 restart gueclaw-agent'], {
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
