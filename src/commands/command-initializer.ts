/**
 * Command Initializer (DVACE Architecture)
 * 
 * Registers all built-in commands to the CommandRegistry.
 * Should be called during application bootstrap.
 */

import { CommandRegistry } from '../core/command-registry';
import { allTelegramCommands } from './telegram-commands';

/**
 * Initialize and register all built-in commands
 */
export function initializeCommands(): void {
  const registry = CommandRegistry.getInstance();
  
  console.log('🔧 Registering commands...');
  
  let localCount = 0;
  let promptCount = 0;
  let toolCount = 0;
  
  for (const command of allTelegramCommands) {
    try {
      registry.register(command);
      
      // Count by type
      const cmdType = command.type;
      if (cmdType === 'local') localCount++;
      else if (cmdType === 'prompt') promptCount++;
      else if (cmdType === 'tool') toolCount++;
      
      console.log(`  ✓ Registered /${command.name} (${cmdType})`);
    } catch (error: any) {
      console.error(`  ✗ Failed to register /${command.name}: ${error.message}`);
    }
  }
  
  const stats = registry.getStats();
  
  console.log(`\n✅ Commands registered successfully!`);
  console.log(`   • LocalCommands: ${localCount}`);
  console.log(`   • PromptCommands: ${promptCount}`);
  console.log(`   • ToolCommands: ${toolCount}`);
  console.log(`   • Total Aliases: ${stats.aliasCount}\n`);
}

/**
 * Export registry instance for convenience
 */
export { CommandRegistry } from '../core/command-registry';
export { commandRegistry } from '../core/command-registry';
