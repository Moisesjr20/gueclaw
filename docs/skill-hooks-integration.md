# Skill Hooks Integration Guide

## Overview

Skill hooks allow skills to auto-configure cron jobs and other resources when the agent boots. This enables "install and forget" workflows where skills manage their own automation.

## Architecture

- **SkillHookContext**: Context provided to hooks (scheduler, storage, config, logger)
- **SkillHooks**: Lifecycle hooks (onBoot, onActivate, onDeactivate, onShutdown)
- **SkillHookManager**: Manages hook execution
- **CronJob Extensions**: Added `createdBy`, `tags`, `permanent` fields for tracking

## Usage

### 1. Create Hooks File

In your skill directory (`.agents/skills/my-skill/hooks.ts`):

```typescript
import type { SkillHooks, SkillHookContext } from '../../../src/types/skill-hooks';

export const hooks: SkillHooks = {
  async onBoot(context: SkillHookContext) {
    context.logger('Checking for auto-registered jobs...');
    
    const jobs = context.cronStorage.loadJobs();
    const exists = jobs.some(j => j.createdBy === context.skillName);
    
    if (!exists) {
      await context.cronStorage.createJob({
        name: 'My Auto Job',
        prompt: 'Execute my task',
        schedule: { type: 'interval', value: '1d' },
        trigger: { type: 'time', schedule: { type: 'interval', value: '1d' } },
        deliver: 'telegram',
        userId: process.env.ADMIN_USER_ID!,
        status: 'active',
        createdBy: context.skillName,
        tags: ['auto-registered'],
        permanent: false
      });
      
      context.logger('✅ Auto-registered job');
    }
  },
  
  async onDeactivate(context: SkillHookContext) {
    context.logger('Skill deactivated - jobs will be cleaned up automatically');
  }
};
```

### 2. Load Hooks in Skill Loader

Modify `src/core/skills/skill-loader.ts` to load hooks:

```typescript
import * as path from 'path';

export class SkillLoader {
  public static loadWithHooks(skillName: string): SkillDefinition {
    const metadata = this.getMetadata(skillName);
    const content = this.loadSkillContent(skillName);
    const hooksPath = path.join(this.SKILLS_DIR, skillName, 'hooks.ts');
    
    let hooks;
    if (fs.existsSync(hooksPath)) {
      const hooksModule = require(hooksPath);
      hooks = hooksModule.hooks;
    }
    
    return {
      name: skillName,
      metadata,
      content,
      filePath: path.join(this.SKILLS_DIR, skillName, 'SKILL.md'),
      hooks
    };
  }
}
```

### 3. Register Skills on Boot

In `src/index.ts` or wherever the agent initializes:

```typescript
import { SkillHookManager } from './core/skill-hook-manager';
import { SkillLoader } from './core/skills/skill-loader';
import { CronScheduler } from './services/cron/cron-scheduler';

async function bootstrapSkillHooks() {
  const hookManager = SkillHookManager.getInstance();
  const cronScheduler = CronScheduler.getInstance();
  const skillNames = fs.readdirSync('.agents/skills');
  
  for (const skillName of skillNames) {
    const skillDef = SkillLoader.loadWithHooks(skillName);
    if (skillDef.hooks) {
      await hookManager.registerSkill(skillName, skillDef, cronScheduler);
    }
  }
}

// Call during agent boot
await bootstrapSkillHooks();
```

### 4. Handle Shutdown

In shutdown handler:

```typescript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  
  const hookManager = SkillHookManager.getInstance();
  const cronScheduler = CronScheduler.getInstance();
  
  await hookManager.shutdownAll(cronScheduler);
  await cronScheduler.stop();
  
  process.exit(0);
});
```

## Environment Variables

Skills can access config via environment variables:

```bash
# For skill "vps-security-scanner"
SKILL_VPS_SECURITY_SCANNER_ENABLED=true
SKILL_VPS_SECURITY_SCANNER_SCHEDULE="0 22 * * 0"
```

Access in hooks:

```typescript
async onBoot(context: SkillHookContext) {
  if (context.config.enabled === 'true') {
    // Register job
  }
}
```

## Auto-Cleanup

When a skill is deactivated, the SkillHookManager automatically:
1. Calls `onDeactivate` hook
2. Deletes all jobs where `createdBy === skillName` and `permanent === false`

To protect important jobs from cleanup, set `permanent: true`.

## Example: VPS Security Scanner

See `.agents/skills/vps-security-scanner/hooks.ts` for a complete example that:
- Checks if weekly security scan exists on boot
- Auto-registers if missing
- Uses admin user ID from env
- Sets retry/timeout configs
- Tags jobs for easy filtering

## Benefits

✅ **Zero Configuration**: Skills auto-configure on first boot  
✅ **Clean Uninstall**: Auto-cleanup when skills are removed  
✅ **Declarative**: Hooks are declarative and easy to understand  
✅ **Isolated**: Each skill manages its own resources  
✅ **Safe**: Permanent flag protects critical jobs

## Integration Status

- ✅ Types defined
- ✅ SkillHookManager implemented
- ✅ CronJob extended with tracking fields
- ✅ Example hooks created
- ⏳ Loader integration (manual step required)
- ⏳ Bootstrap in main.ts (manual step required)

## Next Steps

1. Update `skill-loader.ts` to load hooks
2. Call `bootstrapSkillHooks()` in `src/index.ts`
3. Add shutdown handler
4. Test with vps-security-scanner skill
5. Document env var patterns for all skills
