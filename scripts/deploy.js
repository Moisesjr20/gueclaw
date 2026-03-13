#!/usr/bin/env node
const { spawn } = require('child_process');

const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('🚀 Deploying to VPS...\n');

const deploy = spawn('ssh', ['root@147.93.69.211', 'cd /opt/gueclaw-agent && ./update.sh'], {
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
