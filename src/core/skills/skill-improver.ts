import { SkillExecutionTracker, FailurePattern } from './skill-execution-tracker';
import { ProviderFactory } from '../providers/provider-factory';
import { ILLMProvider } from '../providers/base-provider';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Improvement Proposal from LLM Analysis
 */
export interface ImprovementProposal {
  rootCause: string;
  proposedFix: string;
  changes: SkillChange[];
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Change to apply to skill file
 */
export interface SkillChange {
  type: 'add' | 'modify' | 'delete';
  section?: string;
  oldContent?: string;
  newContent: string;
  lineNumber?: number;
}

/**
 * Improvement Result
 */
export interface ImprovementResult {
  success: boolean;
  skillName: string;
  appliedChanges: number;
  confidence: number;
  summary: string;
  error?: string;
}

/**
 * Auto-improves skills based on failure patterns
 */
export class SkillImprover {
  private static provider: ILLMProvider | null = null;
  private static readonly CONFIDENCE_THRESHOLD = 0.8;
  private static readonly MIN_FAILURES = 3;

  /**
   * Initialize improver (get LLM provider)
   */
  private static getProvider(): ILLMProvider {
    if (!SkillImprover.provider) {
      SkillImprover.provider = ProviderFactory.getProvider();
    }
    return SkillImprover.provider;
  }

  /**
   * Check if a skill needs improvement and apply if confidence is high
   * @param skillName - Name of the skill to check
   * @param forceAnalysis - Force analysis even if no pattern detected
   * @param forceApply - Apply changes even if confidence is below threshold
   * @returns Improvement result
   */
  public static async checkAndImprove(
    skillName: string,
    forceAnalysis: boolean = false,
    forceApply: boolean = false
  ): Promise<ImprovementResult> {
    try {
      // Detect failure pattern
      const pattern = SkillExecutionTracker.detectFailurePattern(
        skillName,
        SkillImprover.MIN_FAILURES,
        24
      );

      if (!pattern && !forceAnalysis) {
        return {
          success: false,
          skillName,
          appliedChanges: 0,
          confidence: 0,
          summary: `No failure pattern detected for ${skillName} (need ${SkillImprover.MIN_FAILURES}+ similar failures)`,
        };
      }

      console.log(`🔍 [SkillImprover] Analyzing ${skillName}...`);

      // Analyze and propose improvement
      const proposal = await SkillImprover.analyzeAndPropose(skillName, pattern);

      if (!proposal) {
        return {
          success: false,
          skillName,
          appliedChanges: 0,
          confidence: 0,
          summary: 'Failed to generate improvement proposal from LLM',
        };
      }

      console.log(`📊 [SkillImprover] Confidence: ${(proposal.confidence * 100).toFixed(1)}%`);

      // Apply if confidence is high enough (or forced)
      const shouldApply = forceApply || proposal.confidence >= SkillImprover.CONFIDENCE_THRESHOLD;

      if (!shouldApply) {
        return {
          success: false,
          skillName,
          appliedChanges: 0,
          confidence: proposal.confidence,
          summary: `Confidence too low (${(proposal.confidence * 100).toFixed(1)}% < ${SkillImprover.CONFIDENCE_THRESHOLD * 100}%). Use /improve-force to apply anyway.`,
        };
      }

      // Apply improvement
      const applied = await SkillImprover.applyImprovement(skillName, proposal);

      if (applied) {
        // Append to changelog
        await SkillImprover.appendChangelog(skillName, proposal, pattern);

        return {
          success: true,
          skillName,
          appliedChanges: proposal.changes.length,
          confidence: proposal.confidence,
          summary: `✅ Applied ${proposal.changes.length} changes. Root cause: ${proposal.rootCause}`,
        };
      } else {
        return {
          success: false,
          skillName,
          appliedChanges: 0,
          confidence: proposal.confidence,
          summary: 'Failed to apply changes to skill file',
          error: 'File write error',
        };
      }
    } catch (error: any) {
      console.error(`❌ [SkillImprover] Error: ${error.message}`);
      return {
        success: false,
        skillName,
        appliedChanges: 0,
        confidence: 0,
        summary: 'Error during improvement process',
        error: error.message,
      };
    }
  }

  /**
   * Analyze failures and propose improvement using LLM
   * @param skillName - Name of the skill
   * @param pattern - Detected failure pattern (optional)
   * @returns Improvement proposal
   */
  private static async analyzeAndPropose(
    skillName: string,
    pattern: FailurePattern | null
  ): Promise<ImprovementProposal | null> {
    const provider = SkillImprover.getProvider();

    // Load current skill content
    const skillPath = path.join('.agents', 'skills', skillName, 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill file not found: ${skillPath}`);
    }

    const skillContent = fs.readFileSync(skillPath, 'utf-8');

    // Get recent failures for context
    const recentFailures = SkillExecutionTracker.getRecentFailures(skillName, 24);

    // Build analysis prompt
    const prompt = `You are an expert AI skill developer. Analyze the following skill that has been failing repeatedly and propose an improvement.

**Skill Name:** ${skillName}

**Current Skill Content:**
\`\`\`markdown
${skillContent}
\`\`\`

**Failure Pattern Detected:**
${pattern ? `
- Normalized Error: ${pattern.normalizedError}
- Occurrences: ${pattern.count} times in last 24h
- Error Type: ${pattern.errorType}
- First Occurred: ${new Date(pattern.firstOccurrence * 1000).toISOString()}
- Last Occurred: ${new Date(pattern.lastOccurrence * 1000).toISOString()}
${pattern.contexts.length > 0 ? `- Contexts: ${pattern.contexts.join(', ')}` : ''}
` : 'No specific pattern, but multiple recent failures detected.'}

**Recent Failures (samples):**
${recentFailures.slice(0, 5).map((f, i) => `
${i + 1}. Error: ${f.errorMessage}
   Type: ${f.errorType || 'unknown'}
   Time: ${new Date(f.timestamp * 1000).toISOString()}
   Context: ${f.context || 'none'}
`).join('')}

**Your Task:**
1. Identify the root cause of these failures
2. Propose specific fixes to the skill content
3. Provide confidence level (0.0-1.0) in your proposed solution

**Output Format (JSON):**
\`\`\`json
{
  "rootCause": "Clear explanation of what's causing the failures",
  "proposedFix": "High-level description of the solution",
  "changes": [
    {
      "type": "modify",
      "section": "Section name in SKILL.md",
      "oldContent": "Content to replace (if type is 'modify')",
      "newContent": "New content to add or replacement"
    }
  ],
  "confidence": 0.85,
  "reasoning": "Explanation of why this fix will work"
}
\`\`\`

**Important:**
- Be specific in changes (include exact text to find/replace)
- Only propose changes you're confident will fix the issue
- Set confidence < 0.8 if you're not sure
- If the issue is external (API changes, etc.), suggest updating error handling

Respond ONLY with the JSON object, no additional text.`;

    try {
      const response = await provider.generateCompletion([
        { 
          role: 'system', 
          content: 'You are an expert AI skill developer. Always respond with valid JSON.',
          conversationId: 'skill-improvement' 
        },
        { 
          role: 'user', 
          content: prompt,
          conversationId: 'skill-improvement'
        }
      ], {
        temperature: 0.3, // Lower temperature for more deterministic analysis
        maxTokens: 2000,
      });

      const content = response.content.trim();
      
      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const proposal: ImprovementProposal = JSON.parse(jsonStr);

      // Validate confidence range
      if (proposal.confidence < 0 || proposal.confidence > 1) {
        proposal.confidence = Math.max(0, Math.min(1, proposal.confidence));
      }

      return proposal;
    } catch (error: any) {
      console.error(`❌ [SkillImprover] Failed to parse LLM response: ${error.message}`);
      return null;
    }
  }

  /**
   * Apply improvement changes to skill file
   * @param skillName - Name of the skill
   * @param proposal - Improvement proposal
   * @returns True if successful
   */
  private static async applyImprovement(
    skillName: string,
    proposal: ImprovementProposal
  ): Promise<boolean> {
    const skillPath = path.join('.agents', 'skills', skillName, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      console.error(`❌ [SkillImprover] Skill file not found: ${skillPath}`);
      return false;
    }

    let content = fs.readFileSync(skillPath, 'utf-8');

    // Apply each change
    for (const change of proposal.changes) {
      switch (change.type) {
        case 'modify':
          if (change.oldContent && content.includes(change.oldContent)) {
            content = content.replace(change.oldContent, change.newContent);
            console.log(`✅ [SkillImprover] Modified: ${change.section || 'content'}`);
          } else {
            console.warn(`⚠️  [SkillImprover] Old content not found for modification: ${change.section}`);
          }
          break;

        case 'add':
          // Add at the end or after a specific section
          if (change.section) {
            const sectionRegex = new RegExp(`(## ${change.section}[\\s\\S]*?)(?=##|$)`, 'i');
            if (sectionRegex.test(content)) {
              content = content.replace(sectionRegex, `$1\n\n${change.newContent}\n`);
              console.log(`✅ [SkillImprover] Added to section: ${change.section}`);
            } else {
              content += `\n\n## ${change.section}\n\n${change.newContent}\n`;
              console.log(`✅ [SkillImprover] Created new section: ${change.section}`);
            }
          } else {
            content += `\n\n${change.newContent}\n`;
            console.log(`✅ [SkillImprover] Added content at end`);
          }
          break;

        case 'delete':
          if (change.oldContent && content.includes(change.oldContent)) {
            content = content.replace(change.oldContent, '');
            console.log(`✅ [SkillImprover] Deleted: ${change.section || 'content'}`);
          }
          break;
      }
    }

    // Write back to file
    try {
      fs.writeFileSync(skillPath, content, 'utf-8');
      console.log(`✅ [SkillImprover] Skill file updated: ${skillPath}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [SkillImprover] Failed to write file: ${error.message}`);
      return false;
    }
  }

  /**
   * Append improvement to skill changelog
   * @param skillName - Name of the skill
   * @param proposal - Improvement proposal
   * @param pattern - Failure pattern
   */
  private static async appendChangelog(
    skillName: string,
    proposal: ImprovementProposal,
    pattern: FailurePattern | null
  ): Promise<void> {
    const skillDir = path.join('.agents', 'skills', skillName);
    const changelogPath = path.join(skillDir, '.changelog.md');

    const entry = `---

## [Auto-Improvement] ${new Date().toISOString().split('T')[0]}

**Timestamp:** ${new Date().toISOString()}

**Root Cause:**
${proposal.rootCause}

**Proposed Fix:**
${proposal.proposedFix}

**Confidence:** ${(proposal.confidence * 100).toFixed(1)}%

**Reasoning:**
${proposal.reasoning}

**Failure Pattern:**
${pattern ? `
- Normalized Error: ${pattern.normalizedError}
- Occurrences: ${pattern.count} times
- Error Type: ${pattern.errorType}
- First: ${new Date(pattern.firstOccurrence * 1000).toISOString()}
- Last: ${new Date(pattern.lastOccurrence * 1000).toISOString()}
` : 'Manual improvement (no pattern detected)'}

**Changes Applied:** ${proposal.changes.length}
${proposal.changes.map((c, i) => `${i + 1}. ${c.type.toUpperCase()}: ${c.section || 'content'}`).join('\n')}

`;

    // Create or append to changelog
    if (fs.existsSync(changelogPath)) {
      const existing = fs.readFileSync(changelogPath, 'utf-8');
      fs.writeFileSync(changelogPath, entry + '\n' + existing, 'utf-8');
    } else {
      const header = `# ${skillName} - Auto-Improvement Changelog

This file tracks automatic improvements made to this skill by the SkillImprover system.

`;
      fs.writeFileSync(changelogPath, header + entry, 'utf-8');
    }

    console.log(`📝 [SkillImprover] Changelog updated: ${changelogPath}`);
  }
}
