#!/usr/bin/env node
/**
 * GitHub Copilot OAuth - Remote Authentication via SSH
 * Connects to VPS and runs the authentication command
 */

const { spawn } = require('child_process');
const readline = require('readline');

const VPS_HOST = '147.93.69.211';
const VPS_USER = 'root';
const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║   GitHub Copilot OAuth - Remote Authentication  ║');
console.log('╚══════════════════════════════════════════════════╝\n');

console.log(`📡 Connecting to ${VPS_USER}@${VPS_HOST}...\n`);

// Spawn SSH process
const ssh = spawn('ssh', [
  `${VPS_USER}@${VPS_HOST}`,
  'cd /opt/gueclaw-agent && npm run copilot:auth'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasPromptedPassword = false;

// Handle stdout
ssh.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
});

// Handle stderr (SSH prompts come through stderr)
ssh.stderr.on('data', (data) => {
  const output = data.toString();
  
  // Check if it's asking for password
  if (output.includes('password:') && !hasPromptedPassword) {
    hasPromptedPassword = true;
    console.log('🔑 Sending password...');
    ssh.stdin.write(VPS_PASSWORD + '\n');
  } else if (output.includes('Are you sure you want to continue connecting')) {
    // Auto-accept host key
    ssh.stdin.write('yes\n');
  } else {
    // Show other stderr output
    process.stderr.write(output);
  }
});

// Handle exit
ssh.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Authentication completed!');
    console.log('🔄 Restart the bot: ssh root@147.93.69.211 "pm2 restart gueclaw-agent"');
  } else {
    console.log(`\n❌ Process exited with code ${code}`);
  }
  process.exit(code);
});

// Handle errors
ssh.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted by user');
  ssh.kill();
  process.exit(1);
});
