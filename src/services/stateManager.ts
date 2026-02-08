/**
 * State manager for issue persistence in data/{project}/issues.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Issue, IssuesData, Project } from '../models/types';
import { getProjectDataDir } from '../config/paths';

export class StateManager {
  constructor(private configDir: string) {}

  /**
   * Load all issues for a project
   */
  loadIssues(projectId: string): Issue[] {
    const issuesFile = this.getIssuesFilePath(projectId);

    if (!fs.existsSync(issuesFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(issuesFile, 'utf-8');
      const data: any = yaml.parse(content);

      if (!data || !Array.isArray(data.issues)) {
        return [];
      }

      // Convert CLI format to Extension format if needed
      return data.issues.map((issue: any) => this.normalizeIssue(issue)).filter((i: Issue | null) => i !== null);
    } catch (error) {
      console.error(`Failed to load issues for ${projectId}: ${error}`);
      return [];
    }
  }

  /**
   * Normalize issue data from CLI format to Extension format
   */
  private normalizeIssue(rawIssue: any): Issue | null {
    if (!rawIssue || !rawIssue.id) {
      return null;
    }

    // Determine workspaceDir from different formats
    let workspaceDir = '';
    if (rawIssue.workspaceDir) {
      workspaceDir = rawIssue.workspaceDir;
    } else if (rawIssue.workspace && rawIssue.workspace.path) {
      // CLI format: extract directory from workspace file path
      workspaceDir = path.dirname(rawIssue.workspace.path);
    }

    // Normalize repositories array
    const repos = Array.isArray(rawIssue.repositories)
      ? rawIssue.repositories.map((repo: any) => ({
          name: repo.name || '',
          branch: repo.branch || '',
          worktreePath: repo.worktreePath || path.join(workspaceDir, repo.name || ''),
          created: repo.created || false,
          pushed: repo.pushed || false
        }))
      : (Array.isArray(rawIssue.repos) ? rawIssue.repos : []);

    return {
      id: rawIssue.id,
      title: rawIssue.title,
      description: rawIssue.description,
      projectId: rawIssue.projectId || rawIssue.project_id || '',
      status: rawIssue.status || 'active',
      workspaceDir,
      repos,
      createdAt: rawIssue.createdAt || rawIssue.created_at || new Date().toISOString(),
      updatedAt: rawIssue.updatedAt || rawIssue.updated_at || new Date().toISOString()
    };
  }

  /**
   * Save an issue to the issues.yaml file
   */
  saveIssue(projectId: string, issue: Issue): void {
    const issues = this.loadIssues(projectId);

    // Remove existing issue with same ID if exists
    const filteredIssues = issues.filter(i => i.id !== issue.id);

    // Add new/updated issue
    filteredIssues.push(issue);

    // Sort by createdAt (newest first)
    filteredIssues.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    this.saveIssuesFile(projectId, filteredIssues);
  }

  /**
   * Delete an issue from the issues.yaml file
   */
  deleteIssue(projectId: string, issueId: string): void {
    const issues = this.loadIssues(projectId);
    const filteredIssues = issues.filter(i => i.id !== issueId);
    this.saveIssuesFile(projectId, filteredIssues);
  }

  /**
   * Get a specific issue
   */
  getIssue(projectId: string, issueId: string): Issue | undefined {
    const issues = this.loadIssues(projectId);
    return issues.find(i => i.id === issueId);
  }

  /**
   * Get all projects with their issues
   */
  getAllProjectsWithIssues(projects: Project[]): Map<string, Issue[]> {
    const map = new Map<string, Issue[]>();

    for (const project of projects) {
      const issues = this.loadIssues(project.id);
      map.set(project.id, issues);
    }

    return map;
  }

  /**
   * Update issue status
   */
  updateIssueStatus(projectId: string, issueId: string, status: Issue['status']): void {
    const issue = this.getIssue(projectId, issueId);
    if (issue) {
      issue.status = status;
      issue.updatedAt = new Date().toISOString();
      this.saveIssue(projectId, issue);
    }
  }

  /**
   * Get issues file path for a project
   */
  private getIssuesFilePath(projectId: string): string {
    const dataDir = getProjectDataDir(this.configDir, projectId);
    return path.join(dataDir, 'issues.yaml');
  }

  /**
   * Save issues to file
   */
  private saveIssuesFile(projectId: string, issues: Issue[]): void {
    const issuesFile = this.getIssuesFilePath(projectId);
    const dataDir = path.dirname(issuesFile);

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data: IssuesData = { issues };
    const content = yaml.stringify(data);

    fs.writeFileSync(issuesFile, content, 'utf-8');
  }
}
