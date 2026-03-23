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

console.log('🚀 Deploying to VPS...\n');

const deploy = spawn('ssh', [`${VPS_USER}@${VPS_HOST}`, 'cd /opt/gueclaw-agent && bash update.sh'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

deploy.stdout.on('data', (data) => process.stdout.write(data.toString()));
deploy.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('password:')) {
    deploy.stdin.write(VPS_PASSWORD + '\n');
  } else {
    process.stderr.write(output);
  }
});

deploy.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Deployment complete!\n');
    console.log('🎉 Auto-renewal feature is now active!');
    console.log('📲 When token expires, you will receive a Telegram message with:');
    console.log('   - OAuth URL');
    console.log('   - 8-digit code');
    console.log('   - Automatic retry after authorization\n');
  }
  process.exit(code);
});
