/**
 * Command Registry (DVACE Architecture)
 * 
 * Centralized registry for all command types (Local, Prompt, Tool).
 * Provides registration, lookup, and lifecycle management for commands.
 * 
 * @see CHECKLIST-DVACE-REFACTOR.md - Phase 1.2
 */

import {
  Command,
  LocalCommand,
  PromptCommand,
  ToolCommand,
  CommandRegistrationOptions,
  isLocalCommand,
  isPromptCommand,
  isToolCommand
} from '../types/command-types';

/**
 * Command Registry Entry
 */
interface CommandEntry {
  command: Command;
  options: CommandRegistrationOptions;
  registeredAt: number;
}

/**
 * Command Registry Statistics
 */
export interface RegistryStats {
  totalCommands: number;
  localCommands: number;
  promptCommands: number;
  toolCommands: number;
  hiddenCommands: number;
  aliasCount: number;
}

/**
 * Singleton Command Registry
 * 
 * Usage:
 * ```typescript
 * const registry = CommandRegistry.getInstance();
 * 
 * // Register a local command
 * registry.register({
 *   type: 'local',
 *   name: 'version',
 *   description: 'Show version',
 *   run: async () => ({ success: true, message: 'v1.0.0' })
 * });
 * 
 * // Get and execute
 * const cmd = registry.get('version');
 * if (cmd && isLocalCommand(cmd)) {
 *   await cmd.run([], context);
 * }
 * ```
 */
export class CommandRegistry {
  private static instance: CommandRegistry;
  
  /**
   * Map: command name → CommandEntry
   */
  private commands: Map<string, CommandEntry>;
  
  /**
   * Map: alias → canonical command name
   */
  private aliases: Map<string, string>;
  
  private constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }
  
  /**
   * Reset registry (for testing)
   */
  public static reset(): void {
    CommandRegistry.instance = new CommandRegistry();
  }
  
  /**
   * Register a command
   * 
   * @param command - Command to register
   * @param options - Registration options
   * @throws Error if command name already exists (unless override=true)
   */
  public register(
    command: Command,
    options: CommandRegistrationOptions = {}
  ): void {
    const { override = false } = options;
    
    // Validate command name
    if (!command.name || command.name.trim() === '') {
      throw new Error('Command name cannot be empty');
    }
    
    const normalizedName = this.normalizeName(command.name);
    
    // Check for duplicate
    if (this.commands.has(normalizedName) && !override) {
      throw new Error(
        `Command "${normalizedName}" already registered. Use override=true to replace.`
      );
    }
    
    // Register main command
    const entry: CommandEntry = {
      command,
      options,
      registeredAt: Date.now()
    };
    
    this.commands.set(normalizedName, entry);
    
    // Register aliases
    if ('aliases' in command && command.aliases) {
      for (const alias of command.aliases) {
        const normalizedAlias = this.normalizeName(alias);
        
        if (this.aliases.has(normalizedAlias) && !override) {
          throw new Error(
            `Alias "${normalizedAlias}" already registered for another command`
          );
        }
        
        this.aliases.set(normalizedAlias, normalizedName);
      }
    }
  }
  
  /**
   * Get command by name or alias
   * 
   * @param name - Command name or alias
   * @returns Command if found, undefined otherwise
   */
  public get(name: string): Command | undefined {
    const normalizedName = this.normalizeName(name);
    
    // Check direct lookup
    const entry = this.commands.get(normalizedName);
    if (entry) {
      return entry.command;
    }
    
    // Check alias lookup
    const canonicalName = this.aliases.get(normalizedName);
    if (canonicalName) {
      const aliasEntry = this.commands.get(canonicalName);
      return aliasEntry?.command;
    }
    
    return undefined;
  }
  
  /**
   * Check if command exists
   * 
   * @param name - Command name or alias
   * @returns true if command exists
   */
  public hasCommand(name: string): boolean {
    return this.get(name) !== undefined;
  }
  
  /**
   * List all registered command names
   * 
   * @param includeHidden - Include hidden commands
   * @returns Array of command names (sorted alphabetically)
   */
  public listCommands(includeHidden = false): string[] {
    const names: string[] = [];
    
    for (const [name, entry] of this.commands.entries()) {
      if (!includeHidden && entry.options.hidden) {
        continue;
      }
      names.push(name);
    }
    
    return names.sort();
  }
  
  /**
   * List commands by type
   * 
   * @param type - Command type filter
   * @returns Array of commands matching the type
   */
  public listByType(type: 'local' | 'prompt' | 'tool'): Command[] {
    const commands: Command[] = [];
    
    for (const entry of this.commands.values()) {
      if (entry.command.type === type) {
        commands.push(entry.command);
      }
    }
    
    return commands;
  }
  
  /**
   * Unregister a command
   * 
   * @param name - Command name to remove
   * @returns true if command was removed
   */
  public unregister(name: string): boolean {
    const normalizedName = this.normalizeName(name);
    const entry = this.commands.get(normalizedName);
    
    if (!entry) {
      return false;
    }
    
    // Remove aliases
    if ('aliases' in entry.command && entry.command.aliases) {
      for (const alias of entry.command.aliases) {
        this.aliases.delete(this.normalizeName(alias));
      }
    }
    
    // Remove command
    this.commands.delete(normalizedName);
    return true;
  }
  
  /**
   * Get all registered commands (for inspection/debugging)
   * 
   * @returns Map of command entries
   */
  public getAll(): Map<string, Command> {
    const result = new Map<string, Command>();
    
    for (const [name, entry] of this.commands.entries()) {
      result.set(name, entry.command);
    }
    
    return result;
  }
  
  /**
   * Get registry statistics
   * 
   * @returns Statistics about registered commands
   */
  public getStats(): RegistryStats {
    let localCount = 0;
    let promptCount = 0;
    let toolCount = 0;
    let hiddenCount = 0;
    
    for (const entry of this.commands.values()) {
      if (isLocalCommand(entry.command)) localCount++;
      if (isPromptCommand(entry.command)) promptCount++;
      if (isToolCommand(entry.command)) toolCount++;
      if (entry.options.hidden) hiddenCount++;
    }
    
    return {
      totalCommands: this.commands.size,
      localCommands: localCount,
      promptCommands: promptCount,
      toolCommands: toolCount,
      hiddenCommands: hiddenCount,
      aliasCount: this.aliases.size
    };
  }
  
  /**
   * Clear all commands (for testing)
   */
  public clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }
  
  /**
   * Normalize command name (lowercase, trim, remove leading slash)
   * 
   * @param name - Raw command name
   * @returns Normalized name
   */
  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/^\//, '');
  }
}

/**
 * Export singleton instance for convenience
 */
export const commandRegistry = CommandRegistry.getInstance();
