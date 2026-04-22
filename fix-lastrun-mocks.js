const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'tests', 'services', 'cron', 'condition-evaluator.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Strategy: Find all places where we evaluate 'job:xxx.lastRun' and ensure the mock before it includes lastRun
// We'll use regex to find patterns and add lastRun to the mockReturnValue

// Pattern 1: Find mocks followed by lastRun evaluation
const pattern = /(const \w+Ago = new Date\(now - \d+\);[\s\S]{0,200}?mockStorage\.getJob\.mockReturnValue\(\{[\s\S]{0,100}?id: '[\w\d]+',[\s\S]{0,50}?status: 'active')\n(\s+\} as any\);[\s\S]{0,300}?evaluate\('job:\w+\.lastRun)/g;

let count = 0;
content = content.replace(pattern, (match, beforeClosing, afterClosing) => {
  // Extract the timestamp variable name
  const timestampMatch = match.match(/const (\w+Ago) = new Date/);
  if (timestampMatch) {
    const varName = timestampMatch[1];
    count++;
    return beforeClosing + `,\n        lastRun: ${varName}.toISOString()` + afterClosing;
  }
  return match;
});

console.log(`✅ Applied ${count} fixes via regex pattern matching`);

// Manual fixes for specific cases that regex might miss
const manualFixes = [
  // Complex expression fix
  {
    search: `      mockStorage.getJob.mockImplementation((id: string) => ({
        id,
        status: 'active'
      } as any));

      const now = Date.now();
      mockStorage.getJobOutputs.mockImplementation`,
    replace: `      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);
      
      mockStorage.getJob.mockImplementation((id: string) => ({
        id,
        status: 'active',
        lastRun: id === 'abc123' ? oneHourAgo.toISOString() : new Date().toISOString()
      } as any));

      mockStorage.getJobOutputs.mockImplementation`
  }
];

manualFixes.forEach((fix, idx) => {
  if (content.includes(fix.search)) {
    content = content.replace(fix.search, fix.replace);
    console.log(`✅ Manual fix ${idx + 1} applied`);
  }
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ File updated successfully!');
