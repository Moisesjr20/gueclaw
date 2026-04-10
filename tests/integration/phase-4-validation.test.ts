/**
 * DVACE Phase 4 Validation Tests
 * 
 * Objective: Validate Task System with terminal states and tool_executions tracking
 * 
 * Coverage:
 * - 4.1: Terminal states (killed, completed, failed)
 * - 4.2: Tool executions validation
 * - 4.3: Agent loop integration
 * 
 * MIGRATED TO IN-MEMORY STATE (Phase 4 - Opção A)
 * - Removed database dependency
 * - Using resetStateForTests() for test isolation
 * - Resolves: Database UPDATE Bug (PHASE-4-DATABASE-ISSUE.md)
 */

import { TaskTracker, TaskStatus, PhaseStatus } from '../../src/core/task-tracker';
import { resetStateForTests } from '../../src/state/gueclaw-state';

describe('DVACE Phase 4: Task System Validation', () => {
  let tracker: TaskTracker;
  
  beforeEach(() => {
    // Reset state manager (dvace-style)
    resetStateForTests();
    
    // Reset singleton - gets fresh state
    TaskTracker.reset();
    tracker = TaskTracker.getInstance();
  });
  
  afterEach(() => {
    // Clean up
    TaskTracker.reset();
  });

  describe('4.1: Terminal States', () => {
    it('should prevent phase updates when in terminal state (completed)', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      // Complete the phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'completed', 5);
      
      // Try to update again (should be ignored)
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'pending', 0);
      
      // Verify status didn't change
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.phases[0].status).toBe('completed');
      expect(updatedTask?.phases[0].tool_executions).toBe(5);
    });

    it('should prevent phase updates when in terminal state (failed)', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      // Fail the phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'failed', 2, 'Error occurred');
      
      // Try to update again (should be ignored)
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'in_progress', 3);
      
      // Verify status didn't change
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.phases[0].status).toBe('failed');
      expect(updatedTask?.phases[0].tool_executions).toBe(2);
      expect(updatedTask?.phases[0].error_message).toBe('Error occurred');
    });

    it('should prevent phase updates when in terminal state (killed)', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      // Start the phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'in_progress', 0);
      
      // Kill the task
      tracker.updateTaskStatus(task.id, 'killed', 'User cancelled');
      
      // Try to update phase (should be ignored)
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'completed', 5);
      
      // Verify status is still killed
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.phases[0].status).toBe('killed');
      expect(updatedTask?.status).toBe('killed');
    });

    it('should prevent task updates when in terminal state', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      // Complete all phases
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'completed', 5);
      
      // Verify task is completed
      let updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
      
      // Try to kill the task (should be ignored)
      tracker.updateTaskStatus(task.id, 'killed');
      
      // Verify status didn't change
      updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should mark all phases as killed when task is killed', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
        { name: 'Phase 2', description: 'Execute tool2' },
        { name: 'Phase 3', description: 'Execute tool3' },
      ]);
      
      // Start first phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'in_progress', 2);
      
      // Kill the task
      tracker.updateTaskStatus(task.id, 'killed', 'User requested cancellation');
      
      // Verify all phases are killed
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.status).toBe('killed');
      expect(updatedTask?.phases[0].status).toBe('killed');
      expect(updatedTask?.phases[1].status).toBe('killed');
      expect(updatedTask?.phases[2].status).toBe('killed');
      expect(updatedTask?.phases[0].error_message).toBe('User requested cancellation');
    });
  });

  describe('4.2: Tool Executions Validation', () => {
    it('should increment tool executions on each call', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tools' },
      ]);
      
      // Start the phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'in_progress', 0);
      
      // Increment tool executions
      tracker.incrementToolExecutions(task.id, 0);
      tracker.incrementToolExecutions(task.id, 0);
      tracker.incrementToolExecutions(task.id, 0);
      
      // Verify count
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.phases[0].tool_executions).toBe(3);
    });

    it('should not increment tool executions on terminal phase', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      // Complete the phase
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'completed', 5);
      
      // Try to increment (should be ignored)
      tracker.incrementToolExecutions(task.id, 0);
      tracker.incrementToolExecutions(task.id, 0);
      
      // Verify count didn't change
      const updatedTask = tracker.getTask(task.id);
      expect(updatedTask?.phases[0].tool_executions).toBe(5);
    });

    it('should validate phase completion requires tool executions', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      const phase = task.phases[0];
      
      // Execution phase with 0 tools should fail validation
      const invalidCompletion = tracker.validatePhaseCompletion(phase, 'execution');
      expect(invalidCompletion).toBe(false);
      
      // After incrementing, should pass
      tracker.incrementToolExecutions(task.id, 0);
      const phaseAfter = tracker.getTask(task.id)!.phases[0];
      const validCompletion = tracker.validatePhaseCompletion(phaseAfter, 'execution');
      expect(validCompletion).toBe(true);
    });

    it('should allow planning phases to complete without tool executions', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Planning Phase', description: 'Planning only' },
      ]);
      
      const phase = task.phases[0];
      
      // Planning phase with 0 tools should pass validation
      const validCompletion = tracker.validatePhaseCompletion(phase, 'planning');
      expect(validCompletion).toBe(true);
    });
  });

  describe('4.3: Agent Loop Integration', () => {
    it('should retrieve tasks by conversation ID', () => {
      // Create multiple tasks in different conversations
      const task1 = tracker.createTask('conv-1', 'Task 1', [{ name: 'Phase 1', description: 'Planning only' }]);
      const task2 = tracker.createTask('conv-1', 'Task 2', [{ name: 'Phase 1', description: 'Planning only' }]);
      const task3 = tracker.createTask('conv-2', 'Task 3', [{ name: 'Phase 1', description: 'Planning only' }]);
      
      // Retrieve tasks for conv-1
      const conv1Tasks = tracker.getTasksByConversationId('conv-1');
      expect(conv1Tasks).toHaveLength(2);
      expect(conv1Tasks.map(t => t.id).sort()).toEqual([task1.id, task2.id].sort());
      
      // Retrieve tasks for conv-2
      const conv2Tasks = tracker.getTasksByConversationId('conv-2');
      expect(conv2Tasks).toHaveLength(1);
      expect(conv2Tasks[0].id).toBe(task3.id);
    });

    it('should find active phase in conversation tasks', () => {
      const task = tracker.createTask('conv-1', 'Multi-phase Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
        { name: 'Phase 2', description: 'Execute tool2' },
        { name: 'Phase 3', description: 'Execute tool3' },
      ]);
      
      // Start Phase 2
      tracker.updatePhaseStatus(task.id, task.phases[1].id, 'in_progress', 0);
      
      // Simulate agent loop finding active phase
      const tasks = tracker.getTasksByConversationId('conv-1');
      const activeTask = tasks.find(t => t.phases.some(p => p.status === 'in_progress'));
      const activePhaseIndex = activeTask?.phases.findIndex(p => p.status === 'in_progress');
      
      expect(activeTask?.id).toBe(task.id);
      expect(activePhaseIndex).toBe(1);
      expect(activeTask?.phases[activePhaseIndex!].name).toBe('Phase 2');
    });

    it('should handle multiple active phases across tasks', () => {
      const task1 = tracker.createTask('conv-1', 'Task 1', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      const task2 = tracker.createTask('conv-1', 'Task 2', [
        { name: 'Phase 1', description: 'Execute tool2' },
      ]);
      
      // Start both tasks
      tracker.updatePhaseStatus(task1.id, task1.phases[0].id, 'in_progress', 0);
      tracker.updatePhaseStatus(task2.id, task2.phases[0].id, 'in_progress', 0);
      
      // Simulate agent loop incrementing first active phase only
      const tasks = tracker.getTasksByConversationId('conv-1');
      const firstActiveTask = tasks.find(t => t.phases.some(p => p.status === 'in_progress'));
      const activePhaseIndex = firstActiveTask?.phases.findIndex(p => p.status === 'in_progress');
      
      if (firstActiveTask && activePhaseIndex !== -1) {
        tracker.incrementToolExecutions(firstActiveTask.id, activePhaseIndex!);
      }
      
      // Verify only first task was incremented
      const updatedTask1 = tracker.getTask(task1.id);
      const updatedTask2 = tracker.getTask(task2.id);
      
      // One should have been incremented
      const totalExecutions = 
        updatedTask1!.phases[0].tool_executions + 
        updatedTask2!.phases[0].tool_executions;
      
      expect(totalExecutions).toBe(1);
    });
  });

  describe('4.4: Task Display', () => {
    it('should include killed emoji in task summary', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      tracker.updateTaskStatus(task.id, 'killed', 'User cancelled');
      
      const summary = tracker.getTaskSummary(task.id);
      expect(summary).toContain('🛑'); // Killed emoji
    });

    it('should show tool executions count in summary', () => {
      const task = tracker.createTask('conv-1', 'Test Task', [
        { name: 'Phase 1', description: 'Execute tool1' },
      ]);
      
      tracker.updatePhaseStatus(task.id, task.phases[0].id, 'in_progress', 0);
      tracker.incrementToolExecutions(task.id, 0);
      tracker.incrementToolExecutions(task.id, 0);
      tracker.incrementToolExecutions(task.id, 0);
      
      const summary = tracker.getTaskSummary(task.id);
      expect(summary).toContain('3 ações');
    });
  });
});

