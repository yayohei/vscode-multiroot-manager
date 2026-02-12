/**
 * Workspace service for .code-workspace file generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Repository } from '../models/types';

interface WorkspaceFolder {
  path: string;
  name?: string;
}

interface WorkspaceFile {
  folders: WorkspaceFolder[];
  settings?: Record<string, any>;
}

export class WorkspaceService {
  /**
   * Generate .code-workspace file for an issue
   */
  generateWorkspace(
    issueDir: string,
    issueId: string,
    repos: Repository[],
    repoOrgs?: Map<string, string> // repo.name -> org
  ): string {
    const workspaceFilePath = path.join(issueDir, `${issueId}.code-workspace`);

    // Create folders array with workspace root first
    const folders: WorkspaceFolder[] = [
      {
        path: '.',
        name: '📁 Workspace Root'
      }
    ];

    // Add repository folders with org-aware naming
    repos.forEach(repo => {
      const org = repoOrgs?.get(repo.name);
      const folderPath = org
        ? `./${org}/${repo.name}`
        : `./${repo.name}`;
      const folderName = org
        ? `${org}/${repo.name}`
        : repo.name;

      folders.push({
        path: folderPath,
        name: folderName
      });
    });

    // Create workspace configuration
    const workspace: WorkspaceFile = {
      folders,
      settings: {
        'files.exclude': {
          '**/.git': true
        }
      }
    };

    // Write workspace file
    fs.writeFileSync(
      workspaceFilePath,
      JSON.stringify(workspace, null, 2),
      'utf-8'
    );

    return workspaceFilePath;
  }

  /**
   * Generate .claude.md context file for issue
   */
  generateClaudeContext(
    issueDir: string,
    issueId: string,
    title?: string,
    description?: string
  ): void {
    const contextFilePath = path.join(issueDir, '.claude.md');

    const content = `# Issue: ${issueId}

${title ? `## Title\n${title}\n\n` : ''}${description ? `## Description\n${description}\n\n` : ''}## Context

This workspace contains multiple repositories for working on issue ${issueId}.

## Repositories

Check the workspace folders to see all repositories included in this issue.
`;

    fs.writeFileSync(contextFilePath, content, 'utf-8');
  }

  /**
   * Create issue workspace directory structure
   */
  createIssueDirectory(workspaceDir: string, projectId: string, issueId: string): string {
    const issueDir = path.join(workspaceDir, projectId, issueId);

    if (!fs.existsSync(issueDir)) {
      fs.mkdirSync(issueDir, { recursive: true });
    }

    return issueDir;
  }

  /**
   * Remove issue workspace directory
   */
  removeIssueDirectory(issueDir: string): void {
    if (fs.existsSync(issueDir)) {
      fs.rmSync(issueDir, { recursive: true, force: true });
    }
  }

  /**
   * Check if workspace file exists
   */
  workspaceExists(issueDir: string, issueId: string): boolean {
    const workspaceFile = path.join(issueDir, `${issueId}.code-workspace`);
    return fs.existsSync(workspaceFile);
  }

  /**
   * Get workspace file path
   */
  getWorkspacePath(issueDir: string, issueId: string): string {
    return path.join(issueDir, `${issueId}.code-workspace`);
  }
}
