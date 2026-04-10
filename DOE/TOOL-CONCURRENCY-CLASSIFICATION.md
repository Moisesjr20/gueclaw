# Tool Concurrency Safety Classification

**Purpose:** Classify each tool as concurrent-safe (read-only) or serial (write/mutation) for Phase 3.2 of DVACE refactoring.

## Classification Rules

- **isConcurrencySafe: true** → READ-ONLY operations, no side effects, can run in parallel
  - Examples: grep, glob, read-file, analyze-image, echo
  
- **isConcurrencySafe: false** → WRITE operations or side effects, must run serially
  - Examples: file-write, vps-command, docker, memory-write, save-to-repository

## Tool Classification (27 tools)

### ✅ Concurrent-Safe Tools (READ-ONLY)

1. **analyze-image-tool** → READ-ONLY (analyzes image files)
2. **audio-tool** → READ-ONLY (transcribes audio)
3. **build-tool** → READ-ONLY (analyzes build without modifying)
4. **echo-tool** → READ-ONLY (returns input)
5. **glob-tool** → READ-ONLY (lists files matching pattern)
6. **grep-tool** → READ-ONLY (searches file content)
7. **read-skill-tool** → READ-ONLY (reads skill definitions)
8. **skill-tool** → READ-ONLY (loads skill context)

### ❌ Serial Tools (WRITE/MUTATION)

9. **api-request-tool** → SERIAL (HTTP POST/PUT/DELETE can mutate)
10. **docker-tool** → SERIAL (manages containers, side effects)
11. **file-operations-tool** → SERIAL (writes/deletes files)
12. **financial-tool** → SERIAL (may write to database)
13. **mcp-tool** → SERIAL (calls external MCP servers, unknown behavior)
14. **memory-write-tool** → SERIAL (writes to memory/database)
15. **save-to-repository-tool** → SERIAL (writes files to repository)
16. **vps-command-tool** → SERIAL (executes shell commands on VPS)

### 🔄 Context-Dependent (default to SERIAL for safety)

17. **api-request-tool** → SERIAL by default (could be concurrent for GET, but safer to serialize)

## Implementation Strategy

1. Add `isConcurrencySafe: true` to read-only tools
2. Leave `isConcurrencySafe: false` (or omit) for serial tools (default behavior)
3. Update `ToolOrchestrator.partitionToolCalls()` to check this field
4. Add validation in tests

## Updated Files

- ✅ `src/core/providers/base-provider.ts` → Added `isConcurrencySafe?: boolean` to ToolDefinition
- ⏳ `src/tools/analyze-image-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/audio-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/build-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/echo-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/glob-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/grep-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/read-skill-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/tools/skill-tool/skill-tool.ts` → Add isConcurrencySafe: true
- ⏳ `src/core/agent-loop/tool-orchestrator.ts` → Update partitionToolCalls() to check isConcurrencySafe

## Testing Strategy

1. Create `tests/unit/tool-concurrency-classification.test.ts`
2. Test that concurrent-safe tools are partitioned correctly
3. Test that serial tools run one at a time
4. Test mixed concurrent + serial execution order
