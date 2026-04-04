/**
 * Script de Validação de API REST
 * Testa todos os endpoints do debug-api
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3022';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;
const results = [];

async function testEndpoint(method, path, data = null, expectedStatus = 200) {
  const startTime = Date.now();
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${path}`,
      timeout: 10000,
      validateStatus: () => true // Accept all status codes
    };

    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    const duration = Date.now() - startTime;

    const success = response.status === expectedStatus;
    const result = {
      method,
      path,
      status: response.status,
      expectedStatus,
      duration,
      success,
      responseType: typeof response.data,
      dataSize: JSON.stringify(response.data).length
    };

    results.push(result);

    if (success) {
      passed++;
      console.log(`${colors.green}✓${colors.reset} ${method} ${path} - ${duration}ms`);
    } else {
      failed++;
      console.log(`${colors.red}✗${colors.reset} ${method} ${path} - Expected ${expectedStatus}, got ${response.status}`);
    }

    return result;
  } catch (error) {
    failed++;
    const duration = Date.now() - startTime;
    console.log(`${colors.red}✗${colors.reset} ${method} ${path} - ${error.message}`);
    results.push({
      method,
      path,
      status: 'error',
      expectedStatus,
      duration,
      success: false,
      error: error.message
    });
    return null;
  }
}

async function runTests() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}   API REST VALIDATION TEST${colors.reset}`);
  console.log(`${colors.blue}   Base URL: ${API_BASE_URL}${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  // 1. Status & Health
  console.log(`\n${colors.yellow}[1/5] Status & Health Endpoints${colors.reset}`);
  await testEndpoint('GET', '/api/status');
  await testEndpoint('GET', '/api/config');

  // 2. Skills
  console.log(`\n${colors.yellow}[2/5] Skills Endpoints${colors.reset}`);
  await testEndpoint('GET', '/api/skills');
  await testEndpoint('GET', '/api/skills/files/proposal-generator');
  
  // Test save skill (POST)
  const skillContent = '# Test Skill\n\nThis is a test.';
  await testEndpoint('POST', '/api/skills/files/test-skill', { content: skillContent });

  // 3. Executions
  console.log(`\n${colors.yellow}[3/5] Executions Endpoints${colors.reset}`);
  await testEndpoint('GET', '/api/skills/executions');
  await testEndpoint('GET', '/api/skills/executions/recent');

  // 4. Chat
  console.log(`\n${colors.yellow}[4/5] Chat Endpoints${colors.reset}`);
  await testEndpoint('GET', '/api/chat/messages/test-conversation');
  
  // Test send message (POST)
  const chatMessage = {
    message: 'Test message from API validation',
    conversationId: 'api-test-' + Date.now()
  };
  await testEndpoint('POST', '/api/chat', chatMessage, 201);

  // 5. Logs
  console.log(`\n${colors.yellow}[5/5] Logs Endpoint${colors.reset}`);
  await testEndpoint('GET', '/api/logs');

  // Results Summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}   RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  console.log(`Total Tests: ${passed + failed}`);
  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  // Performance Stats
  const durations = results.filter(r => r.duration).map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);

  console.log(`${colors.yellow}Performance:${colors.reset}`);
  console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
  console.log(`  Min: ${minDuration}ms`);
  console.log(`  Max: ${maxDuration}ms`);

  // SLA Check (95% < 2s)
  const underSLA = durations.filter(d => d < 2000).length;
  const slaPercentage = (underSLA / durations.length) * 100;
  const slaStatus = slaPercentage >= 95 ? colors.green + '✓' : colors.red + '✗';
  console.log(`  SLA (95% < 2s): ${slaStatus} ${slaPercentage.toFixed(1)}%${colors.reset}\n`);

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
