---
name: self-improvement
description: Create, modify, and improve agent skills. Allows the agent to extend its own capabilities by generating new skill files.
metadata:
  version: 1.0.0
  author: GueClaw System
  category: meta
  tools:
    - file_operations
---

# Self-Improvement Skill

## Purpose

This skill enables the agent to create, modify, and manage its own skills. It allows GueClaw to extend its capabilities dynamically based on user needs and evolving requirements.

## Core Capabilities

### 1. Create New Skills

When asked to create a new skill, follow this process:

1. **Analyze Requirements**: Understand what the user wants the skill to do
2. **Design the Skill**: Plan the skill structure, tools needed, and workflow
3. **Generate SKILL.md**: Create a properly formatted skill file with:
   - YAML frontmatter (name, description, version, author, category, tools)
   - Clear purpose and capabilities
   - Step-by-step instructions
   - Tool usage guidelines
   - Examples
4. **Save the Skill**: Use `file_operations` tool to write the skill file
5. **Verify**: Confirm the skill was created successfully

### 2. Skill File Structure

Every skill MUST follow this structure:

```markdown
---
name: skill-name
description: Brief description of what the skill does
version: 1.0.0
author: GueClaw Agent
category: category-name
tools:
  - tool_name_1
  - tool_name_2
---

# Skill Title

## Purpose
Clear explanation of the skill's purpose

## Core Capabilities
What the skill can do

## Instructions
Step-by-step guidelines for executing this skill

## Tool Usage
How to use tools for this skill

## Examples
Example scenarios and expected outcomes

## Error Handling
How to handle common errors
```

### 3. Skill Categories

Choose appropriate categories:
- **automation**: Automated workflows and scheduled tasks
- **development**: Code generation, programming assistance
- **infrastructure**: VPS, Docker, system administration
- **data**: Data processing, analysis, transformation
- **integration**: API integrations, third-party services
- **monitoring**: System monitoring, alerts, logs
- **security**: Security checks, audits, backups
- **meta**: Skills about skills (like this one)

### 4. Tool Selection

Select appropriate tools for the skill:
- `vps_execute_command`: Shell command execution
- `docker_manage`: Docker operations
- `file_operations`: File and directory operations
- `api_request`: HTTP API calls

### 5. Best Practices

When creating skills:
- Keep skills focused on a single domain/purpose
- Write clear, actionable instructions
- Include examples and edge cases
- Specify tool usage explicitly
- Add error handling guidelines
- Use semantic versioning
- Document all assumptions

## Instructions for Executing This Skill

When a user asks to create a new skill:

1. **Clarify Requirements**
   - Ask questions if the purpose is unclear
   - Understand the tools needed
   - Identify the category

2. **Generate the Skill File**
   - Use the template above
   - Fill in all YAML frontmatter fields
   - Write comprehensive documentation
   - Include practical examples

3. **Create the Skill Directory and File**
   ```
   Action: file_operations
   Parameters:
     action: create_dir
     filePath: .agents/skills/[skill-name]
   
   Action: file_operations
   Parameters:
     action: write
     filePath: .agents/skills/[skill-name]/SKILL.md
     content: [generated skill content]
   ```

4. **Verify Creation**
   - Check if file exists
   - Confirm proper formatting
   - Notify user of success

5. **Provide Usage Instructions**
   - Explain how to use the new skill
   - Give example prompts

## Example Scenarios

### Example 1: Create Database Backup Skill

**User Request**: "Create a skill for backing up PostgreSQL databases"

**Agent Actions**:
1. Analyze: Need a skill for database backup automation
2. Tools needed: `vps_execute_command`, `file_operations`
3. Category: `infrastructure`
4. Generate skill content with:
   - Commands for pg_dump
   - Compression steps
   - Storage location management
   - Verification procedures
5. Save to `.agents/skills/postgres-backup/SKILL.md`
6. Confirm creation

### Example 2: Create API Integration Skill

**User Request**: "I need a skill to interact with GitHub API"

**Agent Actions**:
1. Analyze: REST API integration with GitHub
2. Tools needed: `api_request`, `file_operations`
3. Category: `integration`
4. Generate skill with:
   - Authentication guidelines
   - Common endpoints (repos, issues, PRs)
   - Response parsing
   - Error handling
5. Save to `.agents/skills/github-integration/SKILL.md`
6. Provide usage examples

## Modifying Existing Skills

When asked to modify a skill:

1. Read current skill file
2. Understand requested changes
3. Modify content while preserving structure
4. Increment version number
5. Save updated skill
6. Confirm changes

## Error Handling

- **Skill Already Exists**: Check if user wants to update or create new version
- **Invalid Directory**: Create directory structure if missing
- **Permission Errors**: Report issue with file system access
- **Invalid YAML**: Correct frontmatter formatting before saving

## Notes

- This skill is foundational for agent evolution
- Always validate YAML frontmatter syntax
- Keep skill documentation clear and maintainable
- Version control is important for tracking changes
- Skills should be self-contained and well-documented
