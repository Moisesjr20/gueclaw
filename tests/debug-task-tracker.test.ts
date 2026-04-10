import { TaskTracker } from '../src/core/task-tracker';

describe('DEBUG TaskTracker', () => {
  beforeEach(() => {
    TaskTracker.reset();
  });

  it('should update phase status correctly', () => {
    const tracker = TaskTracker.getInstance();
    
    const task = tracker.createTask('conv-1', 'Test', [
      { name: 'Phase 1', description: 'Test phase' },
    ]);
    
    console.log('===== BEFORE UPDATE =====');
    console.log('Task ID:', task.id);
    console.log('Phase ID:', task.phases[0].id);
    console.log('Initial status:', task.phases[0].status);
    console.log('Full phase:', JSON.stringify(task.phases[0], null, 2));
    
    tracker.updatePhaseStatus(task.id, task.phases[0].id, 'completed', 5);
    
    console.log('===== AFTER UPDATE =====');
    const updated = tracker.getTask(task.id);
    console.log('Updated status:', updated?.phases[0].status);
    console.log('Full updated phase:', JSON.stringify(updated?.phases[0], null, 2));
    
    expect(updated?.phases[0].status).toBe('completed');
    expect(updated?.phases[0].tool_executions).toBe(5);
  });
});
