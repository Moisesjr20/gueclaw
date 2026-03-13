#!/usr/bin/env node
/**
 * Quick script to delete expired token and re-authenticate
 */

const { execSync } = require('child_process');

const VPS_HOST = '147.93.69.211';
const VPS_USER = 'root';
const VPS_PASS = "2ZeVU0IfAwjKW93'g1B+";

console.log('\n🗑️  Removing expired token...\n');

try {
  // Use sshpass if available, otherwise show manual instructions
  try {
    execSync(`ssh ${VPS_USER}@${VPS_HOST} "rm -f /opt/gueclaw-agent/data/github-token.json"`, {
      stdio: 'inherit',
      input: Buffer.from(VPS_PASS + '\n')
    });
    console.log('✅ Token deleted!\n');
  } catch (e) {
    console.log('⚠️  Could not delete automatically. Please run manually:\n');
    console.log(`   ssh root@${VPS_HOST}`);
    console.log(`   Password: ${VPS_PASS}`);
    console.log(`   rm -f /opt/gueclaw-agent/data/github-token.json\n`);
  }
  
  console.log('📋 Now run authentication:');
  console.log(`   cd /opt/gueclaw-agent`);
  console.log(`   npm run copilot:auth`);
  console.log('\n💡 Or run from local machine:');
  console.log(`   node scripts/auth-copilot-remote.js\n`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
