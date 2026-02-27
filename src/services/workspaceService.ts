/**
 * Workspace service for .code-workspace file generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Repository, TemplateEntry } from '../models/types';

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
    description?: string,
    projectId?: string,
    configDir?: string,
    templates?: TemplateEntry[]
  ): void {
    // Copy from project-defined templates (no overwrite)
    if (templates && templates.length > 0) {
      for (const entry of templates) {
        this.copyTemplateEntry(entry, issueDir);
      }
      return;
    }

    // Fallback: copy from default template directory (no overwrite)
    if (projectId && configDir) {
      const templateDir = path.join(configDir, 'templates', projectId);
      if (fs.existsSync(templateDir)) {
        this.copyTemplateDir(templateDir, issueDir);
        return;
      }
    }

    // Final fallback: generate default .claude.md
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
   * Copy a single template entry (file or directory) to issue dir, no overwrite
   */
  private copyTemplateEntry(entry: TemplateEntry, issueDir: string): void {
    const { src, dest } = entry;
    if (!fs.existsSync(src)) {
      return;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      const destDir = dest ? path.join(issueDir, dest) : issueDir;
      this.copyTemplateDir(src, destDir);
    } else {
      const destPath = dest
        ? path.join(issueDir, dest)
        : path.join(issueDir, path.basename(src));
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(src, destPath);
      }
    }
  }

  /**
   * Recursively copy template directory to destination, skipping existing files
   */
  private copyTemplateDir(srcDir: string, destDir: string): void {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        this.copyTemplateDir(srcPath, destPath);
      } else if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
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
