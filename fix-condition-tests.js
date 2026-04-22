const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'tests', 'services', 'cron', 'condition-evaluator.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern: mock com status 'active' mas sem lastRun, seguido por timestamp ou resultado que usa lastRun
// Precisamos adicionar lastRun aos mocks

const fixes = [
  // Fix 1: test com oneHourAgo (linha ~92-104)
  {
    search: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneHourAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2h');`,
    replace: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: oneHourAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneHourAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2h');`
  },
  // Fix 2: thirtyMinutesAgo
  {
    search: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: thirtyMinutesAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 1h');`,
    replace: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: thirtyMinutesAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: thirtyMinutesAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 1h');`
  },
  // Fix 3: twoHoursAgo (parse hours)
  {
    search: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 3h');`,
    replace: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: twoHoursAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 3h');`
  },
  // Fix 4: oneDayAgo
  {
    search: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneDayAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2d');`,
    replace: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: oneDayAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneDayAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2d');`
  },
  // Fix 5: thirtySecondsAgo
  {
    search: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: thirtySecondsAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 60s');`,
    replace: `      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: thirtySecondsAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: thirtySecondsAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 60s');`
  },
  // Fix 6: comparison < operator (outro oneHourAgo)
  {
    search: `    test('should evaluate < operator', async () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneHourAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2h');`,
    replace: `    test('should evaluate < operator', async () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: oneHourAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: oneHourAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun < 2h');`
  },
  // Fix 7: > operator  
  {
    search: `    test('should evaluate > operator', async () => {
      const now = Date.now();
      const threeHoursAgo = new Date(now - 10800000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: threeHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun > 2h');`,
    replace: `    test('should evaluate > operator', async () => {
      const now = Date.now();
      const threeHoursAgo = new Date(now - 10800000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: threeHoursAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: threeHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun > 2h');`
  },
  // Fix 8: <= operator
  {
    search: `    test('should evaluate <= operator', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 7200000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun <= 2h');`,
    replace: `    test('should evaluate <= operator', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 7200000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: twoHoursAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun <= 2h');`
  },
  // Fix 9: >= operator
  {
    search: `    test('should evaluate >= operator', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 7200000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active'
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun >= 2h');`,
    replace: `    test('should evaluate >= operator', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 7200000);

      mockStorage.getJob.mockReturnValue({
        id: 'abc123',
        status: 'active',
        lastRun: twoHoursAgo.toISOString()
      } as any);
      mockStorage.getJobOutputs.mockReturnValue([{
        success: true,
        timestamp: twoHoursAgo.toISOString()
      }] as any);

      const result = await evaluator.evaluate('job:abc123.lastRun >= 2h');`
  },
  // Fix 10: complex expression - adicionar lastRun ao mock de abc123
  {
    search: `      mockStorage.getJob.mockImplementation((id: string) => ({
        id,
        status: 'active'
      } as any));

      const now = Date.now();
      mockStorage.getJobOutputs.mockImplementation((id: string) => {
        if (id === 'abc123') {
          return [{
            success: true,
            timestamp: new Date(now - 3600000).toISOString()
          }] as any;
        }`,
    replace: `      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);
      
      mockStorage.getJob.mockImplementation((id: string) => ({
        id,
        status: 'active',
        lastRun: id === 'abc123' ? oneHourAgo.toISOString() : new Date().toISOString()
      } as any));

      mockStorage.getJobOutputs.mockImplementation((id: string) => {
        if (id === 'abc123') {
          return [{
            success: true,
            timestamp: oneHourAgo.toISOString()
          }] as any;
        }`
  }
];

let fixedCount = 0;
fixes.forEach((fix, index) => {
  if (content.includes(fix.search)) {
    content = content.replace(fix.search, fix.replace);
    fixedCount++;
    console.log(`✅ Fix ${index + 1} applied`);
  } else {
    console.log(`⚠️  Fix ${index + 1} NOT found`);
  }
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Fixed ${fixedCount}/${fixes.length} issues in condition-evaluator.test.ts`);
