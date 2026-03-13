#!/usr/bin/env ts-node
/**
 * Test GitHub Copilot Provider Configuration
 * 
 * Usage:
 *   npm run test:copilot
 *   or
 *   ts-node scripts/test-copilot.ts
 */

import 'dotenv/config';
import { GitHubCopilotProvider } from '../src/core/providers/github-copilot-provider';
import { Message } from '../src/types';

async function testCopilotProvider() {
  console.log('\n🧪 Testing GitHub Copilot Provider\n');
  console.log('='.repeat(50));

  // Check environment variables
  const apiKey = process.env.GITHUB_COPILOT_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.GITHUB_COPILOT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.GITHUB_COPILOT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
  const apiType = (process.env.GITHUB_COPILOT_API_TYPE || 'openai') as 'openai' | 'github' | 'azure';

  if (!apiKey) {
    console.error('\n❌ Error: No API Key found!');
    console.error('Please set OPENAI_API_KEY or GITHUB_COPILOT_API_KEY in your .env file\n');
    process.exit(1);
  }

  console.log(`\n📋 Configuration:`);
  console.log(`   API Type: ${apiType}`);
  console.log(`   Base URL: ${baseURL}`);
  console.log(`   Model: ${model}`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Initialize provider
  const provider = new GitHubCopilotProvider(apiKey, baseURL, model, apiType);

  // Test messages
  const testMessages: Message[] = [
    {
      conversationId: 'test-conversation',
      role: 'user',
      content: 'Hello! Please respond with just "OK" to confirm you are working. Keep it brief.',
    },
  ];

  console.log('🚀 Sending test request...\n');

  try {
    const startTime = Date.now();
    const response = await provider.generateCompletion(testMessages, {
      temperature: 0.7,
      maxTokens: 100,
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Success!\n');
    console.log(`📝 Response:`);
    console.log(`   Content: ${response.content}`);
    console.log(`   Finish Reason: ${response.finishReason}`);
    console.log(`   Tokens Used: ${response.usage?.totalTokens || 0} (${response.usage?.promptTokens || 0} prompt + ${response.usage?.completionTokens || 0} completion)`);
    console.log(`   Duration: ${duration}s\n`);

    if (response.finishReason === 'error') {
      console.error('❌ Error in response:', response.content);
      process.exit(1);
    }

    console.log('='.repeat(50));
    console.log('✅ GitHub Copilot Provider is working correctly!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error during test:');
    console.error(error.message);
    
    if (error.response?.data) {
      console.error('\nAPI Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }

    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Check if your API key is valid');
    console.log('   2. Verify your API quota/credits');
    console.log('   3. Ensure the base URL is correct');
    console.log('   4. Check your internet connection\n');

    process.exit(1);
  }
}

// Run the test
testCopilotProvider().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
