/**
 * Response Formatter Utilities
 * 
 * Formats MCP tool responses for optimal readability and token efficiency.
 */

import { MemoryIndexResult, TimelineEntry, FullMemoryDetails } from '../types';

/**
 * Format search results as markdown for better readability
 */
export function formatSearchResults(results: MemoryIndexResult[], query: string): string {
  if (results.length === 0) {
    return `No memories found matching "${query}"`;
  }

  const lines: string[] = [
    `🔍 Found ${results.length} ${results.length === 1 ? 'memory' : 'memories'} matching "${query}"\n`,
  ];

  results.forEach((result, index) => {
    const emoji = getTypeEmoji(result.type);
    const importanceFlag = getImportanceFlag(result.importance);
    
    lines.push(
      `${index + 1}. ${emoji} **${result.title}**`,
      `   ID: \`${result.id}\``,
      `   Type: ${result.type} | Importance: ${importanceFlag} | Confidence: ${(result.confidence * 100).toFixed(0)}%`,
      `   Date: ${formatDate(result.date)}`,
      result.tags.length > 0 ? `   Tags: ${result.tags.join(', ')}` : '',
      ''
    );
  });

  return lines.filter(Boolean).join('\n');
}

/**
 * Format timeline for visual clarity
 */
export function formatTimeline(entries: TimelineEntry[], centerMemoryId: string): string {
  const lines: string[] = ['📅 Timeline:\n'];

  entries.forEach((entry) => {
    const emoji = getTypeEmoji(entry.type);
    const prefix = entry.isTarget ? '🎯 ' : '   ';
    const position = entry.relativePosition;
    const positionStr = position < 0 ? `[${position}]` : position > 0 ? `[+${position}]` : '[0]';

    if (entry.isTarget) {
      lines.push(
        `${prefix}${positionStr} ${emoji} **${entry.content}**`,
        `        Type: ${entry.type} | Importance: ${getImportanceFlag(entry.importance)}`,
        `        Confidence: ${((entry.confidence ?? 0) * 100).toFixed(0)}%`,
        entry.context ? `        Context: ${entry.context}` : '',
        entry.tags && entry.tags.length > 0 ? `        Tags: ${entry.tags.join(', ')}` : '',
        ''
      );
    } else {
      lines.push(`${prefix}${positionStr} ${emoji} ${entry.content}`);
    }
  });

  return lines.filter(Boolean).join('\n');
}

/**
 * Format full memory details
 */
export function formatMemoryDetails(memory: FullMemoryDetails): string {
  const emoji = getTypeEmoji(memory.type);
  const importanceFlag = getImportanceFlag(memory.importance);

  const lines: string[] = [
    `${emoji} **Memory Details**\n`,
    `**ID:** \`${memory.id}\``,
    `**Type:** ${memory.type}`,
    `**Importance:** ${importanceFlag}`,
    `**Confidence:** ${(memory.confidence * 100).toFixed(0)}%`,
    `**Date:** ${formatDate(memory.extractedAtISO)}\n`,
    `**Content:**`,
    memory.content,
  ];

  if (memory.context) {
    lines.push('', '**Context:**', memory.context);
  }

  if (memory.tags.length > 0) {
    lines.push('', `**Tags:** ${memory.tags.join(', ')}`);
  }

  if (memory.metadata) {
    lines.push('', '**Metadata:**', '```json', JSON.stringify(memory.metadata, null, 2), '```');
  }

  return lines.join('\n');
}

/**
 * Get emoji for memory type
 */
function getTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    preference: '⚙️',
    decision: '🎯',
    fact: '📋',
    goal: '🎯',
    skill: '💡',
    constraint: '⚠️',
    context: '🌐',
  };
  return emojiMap[type] || '📝';
}

/**
 * Get importance flag/badge
 */
function getImportanceFlag(importance: string): string {
  const flagMap: Record<string, string> = {
    critical: '🔴 Critical',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  };
  return flagMap[importance] || importance;
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (error) {
    return isoDate;
  }
}

/**
 * Truncate text for compact display
 */
export function truncate(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
