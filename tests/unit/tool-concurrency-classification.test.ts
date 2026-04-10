/**
 * Tool Concurrency Classification Tests (Phase 3.2)
 */

import { ToolRegistry } from '../../src/tools/tool-registry';
import { EchoTool } from '../../src/tools/echo-tool';
import { GrepTool } from '../../src/tools/grep-tool';
import { GlobTool } from '../../src/tools/glob-tool';
import { AnalyzeImageTool } from '../../src/tools/analyze-image-tool';
import { AudioTool } from '../../src/tools/audio-tool';
import { ReadSkillTool } from '../../src/tools/read-skill-tool';
import { SkillTool } from '../../src/tools/skill-tool/skill-tool';
import { VPSCommandTool } from '../../src/tools/vps-command-tool';
import { MemoryWriteTool } from '../../src/tools/memory-write-tool';
import { DockerTool } from '../../src/tools/docker-tool';

describe('Tool Concurrency Classification (Phase 3.2)', () => {
  
  beforeAll(() => {
    // Register all tools
    ToolRegistry.clear();
    ToolRegistry.register(EchoTool);
    ToolRegistry.register(new GrepTool());
    ToolRegistry.register(new GlobTool());
    ToolRegistry.register(new AnalyzeImageTool());
    ToolRegistry.register(new AudioTool());
    ToolRegistry.register(new ReadSkillTool());
    ToolRegistry.register(new SkillTool());
    ToolRegistry.register(new VPSCommandTool());
    ToolRegistry.register(new MemoryWriteTool());
    ToolRegistry.register(new DockerTool());
  });
  
  afterAll(() => {
    ToolRegistry.clear();
  });
  
  describe('READ-ONLY Tools (Concurrent-Safe)', () => {
    it('echo should be concurrent-safe', () => {
      const tool = ToolRegistry.get('echo');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('grep_search should be concurrent-safe', () => {
      const tool = ToolRegistry.get('grep_search');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('glob_search should be concurrent-safe', () => {
      const tool = ToolRegistry.get('glob_search');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('analyze_image should be concurrent-safe', () => {
      const tool = ToolRegistry.get('analyze_image');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('transcribe_audio should be concurrent-safe', () => {
      const tool = ToolRegistry.get('transcribe_audio');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('read_skill should be concurrent-safe', () => {
      const tool = ToolRegistry.get('read_skill');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
    
    it('use_skill should be concurrent-safe', () => {
      const tool = ToolRegistry.get('use_skill');
      expect(tool).toBeDefined();
      expect(tool!.getDefinition().isConcurrencySafe).toBe(true);
    });
  });
  
  describe('WRITE Tools (Serial Execution)', () => {
    it('vps_execute_command should NOT be concurrent-safe', () => {
      const tool = ToolRegistry.get('vps_execute_command');
      expect(tool).toBeDefined();
      const definition = tool!.getDefinition();
      // Should be false or undefined (both mean serial execution)
      expect(definition.isConcurrencySafe !== true).toBe(true);
    });
    
    it('memory_write should NOT be concurrent-safe', () => {
      const tool = ToolRegistry.get('memory_write');
      expect(tool).toBeDefined();
      const definition = tool!.getDefinition();
      expect(definition.isConcurrencySafe !== true).toBe(true);
    });
    
    it('docker_manage should NOT be concurrent-safe', () => {
      const tool = ToolRegistry.get('docker_manage');
      expect(tool).toBeDefined();
      const definition = tool!.getDefinition();
      expect(definition.isConcurrencySafe !== true).toBe(true);
    });
  });
  
  describe('Classification Summary', () => {
    it('should have at least 7 concurrent-safe tools', () => {
      const allTools = ToolRegistry.getAllDefinitions();
      const concurrentSafe = allTools.filter(def => def.isConcurrencySafe === true);
      
      expect(concurrentSafe.length).toBeGreaterThanOrEqual(7);
    });
    
    it('should default to serial (false) when isConcurrencySafe is undefined', () => {
      const allTools = ToolRegistry.getAllDefinitions();
      const serialTools = allTools.filter(def => def.isConcurrencySafe !== true);
      
      // Should have at least 3 serial tools (vps_command, memory_write, docker_command)
      expect(serialTools.length).toBeGreaterThanOrEqual(3);
    });
  });
});
