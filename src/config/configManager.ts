/**
 * Configuration manager for reading config.yaml and projects/*.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { Config, Project, BranchNaming } from '../models/types';
import { expandTilde, getConfigDir, getWorkspaceDir, getProjectsDir } from './paths';

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load global configuration from VS Code settings and config.yaml
   */
  private loadConfig(): Config {
    const vscodeConfig = vscode.workspace.getConfiguration('mrm');

    // Get config directory from VS Code settings or default
    const configDir = expandTilde(
      vscodeConfig.get<string>('configDir') || getConfigDir()
    );

    // Get workspace directory from VS Code settings or default
    const workspaceDir = expandTilde(
      vscodeConfig.get<string>('workspaceDir') || getWorkspaceDir()
    );

    // Try to load config.yaml if exists
    const configFile = path.join(configDir, 'config.yaml');
    let fileConfig: Partial<Config> = {};

    if (fs.existsSync(configFile)) {
      try {
        const content = fs.readFileSync(configFile, 'utf-8');
        fileConfig = yaml.parse(content) || {};
      } catch (error) {
        console.warn(`Failed to load config.yaml: ${error}`);
      }
    }

    // Merge VS Code settings with file config (VS Code settings take precedence)
    const branchNaming: BranchNaming = {
      pattern: vscodeConfig.get<string>('branchNaming.pattern') ||
               fileConfig.branchNaming?.pattern ||
               'feature/{issue_id}',
      separator: vscodeConfig.get<string>('branchNaming.separator') ||
                 fileConfig.branchNaming?.separator ||
                 '-'
    };

    return {
      configDir,
      workspaceDir,
      branchNaming,
      github: {
        defaultOwner: vscodeConfig.get<string>('github.defaultOwner') ||
                     fileConfig.github?.defaultOwner,
        defaultRepo: vscodeConfig.get<string>('github.defaultRepo') ||
                    fileConfig.github?.defaultRepo
      },
      gemini: {
        model: vscodeConfig.get<string>('gemini.model') ||
               fileConfig.gemini?.model ||
               'gemini-2.5-flash',
        enabled: vscodeConfig.get<boolean>('gemini.enabled') ??
                fileConfig.gemini?.enabled ??
                true
      }
    };
  }

  /**
   * Get config directory path
   */
  getConfigDir(): string {
    return this.config.configDir;
  }

  /**
   * Get workspace directory path
   */
  getWorkspaceDir(): string {
    return this.config.workspaceDir;
  }

  /**
   * Get branch naming configuration
   */
  getBranchNaming(): BranchNaming {
    return this.config.branchNaming;
  }

  /**
   * Get full configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Load all projects from projects/*.yaml
   */
  loadProjects(): Project[] {
    const projectsDir = getProjectsDir(this.config.configDir);

    if (!fs.existsSync(projectsDir)) {
      return [];
    }

    const projects: Project[] = [];
    const files = fs.readdirSync(projectsDir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
        continue;
      }

      try {
        const filePath = path.join(projectsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const projectData = yaml.parse(content);

        if (projectData && projectData.repositories && Array.isArray(projectData.repositories)) {
          const projectId = path.basename(file, path.extname(file));
          projects.push({
            id: projectId,
            name: projectData.name || projectId,
            description: projectData.description,
            repositories: projectData.repositories.map((repo: any) => ({
              name: repo.name,
              path: expandTilde(repo.path),
              default_branch: repo.default_branch || 'main',
              remote: repo.remote || 'origin'
            })),
            branchNaming: projectData.branch_naming || this.config.branchNaming
          });
        }
      } catch (error) {
        console.warn(`Failed to load project file ${file}: ${error}`);
      }
    }

    return projects;
  }

  /**
   * Load a specific project by ID
   */
  loadProject(projectId: string): Project | undefined {
    const projects = this.loadProjects();
    return projects.find(p => p.id === projectId);
  }

  /**
   * Generate branch name from pattern
   */
  generateBranchName(issueId: string, branchNaming?: BranchNaming): string {
    const naming = branchNaming || this.config.branchNaming;
    const normalizedIssueId = issueId.replace(/\s+/g, naming.separator);
    return naming.pattern.replace('{issue_id}', normalizedIssueId);
  }
}
