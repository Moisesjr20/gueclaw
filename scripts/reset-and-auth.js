#!/usr/bin/env node
/**
 * Reset and re-authenticate GitHub Copilot OAuth
 */

const { spawn } = require('child_process');

const VPS_HOST = '147.93.69.211';
const VPS_USER = 'root';
const VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+";

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║      GitHub Copilot OAuth - Reset & Auth        ║');
console.log('╚══════════════════════════════════════════════════╝\n');

console.log('🗑️  Step 1: Deleting expired token...\n');

const deleteCmd = spawn('ssh', [
  `${VPS_USER}@${VPS_HOST}`,
  'rm -f /opt/gueclaw-agent/data/github-token.json'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

deleteCmd.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

deleteCmd.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('password:')) {
    deleteCmd.stdin.write(VPS_PASSWORD + '\n');
  } else {
    process.stderr.write(output);
  }
});

deleteCmd.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Token deleted!\n');
    console.log('🔐 Step 2: Running authentication...\n');
    
    const authCmd = spawn('ssh', [
      `${VPS_USER}@${VPS_HOST}`,
      'cd /opt/gueclaw-agent && npm run copilot:auth'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let hasPromptedPassword = false;
    
    authCmd.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });
    
    authCmd.stderr.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('password:') && !hasPromptedPassword) {
        hasPromptedPassword = true;
        authCmd.stdin.write(VPS_PASSWORD + '\n');
      } else if (output.includes('Are you sure you want to continue connecting')) {
        authCmd.stdin.write('yes\n');
      } else {
        process.stderr.write(output);
      }
    });
    
    authCmd.on('close', (authCode) => {
      if (authCode === 0) {
        console.log('\n✅ Authentication ready!');
        console.log('📋 Follow the instructions above to complete OAuth flow.');
        console.log('\n🔄 After authorizing in browser, restart bot:');
        console.log('   ssh root@147.93.69.211 "pm2 restart gueclaw-agent"\n');
      }
      process.exit(authCode);
    });
  } else {
    console.error('❌ Failed to delete token');
    process.exit(code);
  }
});
