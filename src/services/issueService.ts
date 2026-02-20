/**
 * Issue service - orchestrates issue creation and deletion
 */

import * as path from 'path';
import * as fs from 'fs';
import { GitService } from './gitService';
import { WorkspaceService } from './workspaceService';
import { StateManager } from './stateManager';
import { ConfigManager } from '../config/configManager';
import {
  Issue,
  CreateIssueOptions,
  DeleteIssueOptions,
  RepoState
} from '../models/types';

export class IssueService {
  private gitService: GitService;
  private workspaceService: WorkspaceService;

  constructor(
    private configManager: ConfigManager,
    private stateManager: StateManager
  ) {
    this.gitService = new GitService();
    this.workspaceService = new WorkspaceService();
  }

  /**
   * Create a new issue with worktrees, branches, and workspace
   */
  async createIssue(options: CreateIssueOptions): Promise<Issue> {
    const { projectId, issueId, title, description } = options;

    // Load project configuration
    const project = this.configManager.loadProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Check if issue already exists (return as-is if already fully set up)
    const existingIssue = this.stateManager.getIssue(projectId, issueId);
    if (existingIssue) {
      return existingIssue;
    }

    // Create issue workspace directory
    const workspaceDir = this.configManager.getWorkspaceDir();
    const issueDir = this.workspaceService.createIssueDirectory(
      workspaceDir,
      projectId,
      issueId
    );

    // Generate branch name
    const branchName = this.configManager.generateBranchName(
      issueId,
      project.branchNaming
    );

    const repoStates: RepoState[] = [];
    const createdWorktrees: string[] = [];
    const repoOrgs: Map<string, string> = new Map(); // repo.name -> org

    try {
      // Create worktrees and branches for each repository
      for (const repo of project.repositories) {
        // Get org name from remote URL for directory structure
        const org = await this.gitService.getOrgFromRemote(repo.path, repo.remote || 'origin');
        repoOrgs.set(repo.name, org);
        const worktreePath = path.join(issueDir, org, repo.name);

        // Validate repository exists
        const isValid = await this.gitService.isValidRepository(repo.path);
        if (!isValid) {
          throw new Error(`Invalid repository: ${repo.path}`);
        }

        // Create worktree (checks out existing branch if it already exists)
        await this.gitService.createWorktree(
          repo.path,
          worktreePath,
          branchName,
          repo.default_branch || 'main'
        );

        createdWorktrees.push(worktreePath);

        // Check status
        const status = await this.gitService.getBranchStatus(repo.path, branchName);

        repoStates.push({
          name: repo.name,
          branch: branchName,
          worktreePath,
          created: status.created,
          pushed: status.pushed
        });
      }

      // Generate .code-workspace file
      this.workspaceService.generateWorkspace(
        issueDir,
        issueId,
        project.repositories,
        repoOrgs
      );

      // Generate .claude.md context file
      this.workspaceService.generateClaudeContext(
        issueDir,
        issueId,
        title,
        description
      );

      // Create issue object
      const issue: Issue = {
        id: issueId,
        title,
        description,
        projectId,
        status: 'active',
        workspaceDir: issueDir,
        repos: repoStates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to state
      this.stateManager.saveIssue(projectId, issue);

      return issue;
    } catch (error) {
      // Rollback: remove created worktrees
      for (const worktreePath of createdWorktrees) {
        try {
          const repoName = path.basename(worktreePath);
          const repo = project.repositories.find(r => r.name === repoName);
          if (repo) {
            await this.gitService.removeWorktree(repo.path, worktreePath);
          }
        } catch (rollbackError) {
          console.error(`Failed to rollback worktree ${worktreePath}: ${rollbackError}`);
        }
      }

      // Remove issue directory
      this.workspaceService.removeIssueDirectory(issueDir);

      throw error;
    }
  }

  /**
   * Delete an issue with cleanup
   */
  async deleteIssue(
    projectId: string,
    issueId: string,
    options: DeleteIssueOptions = {}
  ): Promise<void> {
    const { deleteBranches = false } = options;

    // Load issue
    const issue = this.stateManager.getIssue(projectId, issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // Load project
    const project = this.configManager.loadProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Remove worktrees
    for (const repoState of issue.repos) {
      const repo = project.repositories.find(r => r.name === repoState.name);
      if (!repo) {
        continue;
      }

      try {
        // Remove worktree
        const worktreeExists = await this.gitService.worktreeExists(repoState.worktreePath);
        if (worktreeExists) {
          await this.gitService.removeWorktree(repo.path, repoState.worktreePath);
        }

        // Delete branch if requested
        if (deleteBranches) {
          const branchExists = await this.gitService.branchExists(repo.path, repoState.branch);
          if (branchExists) {
            await this.gitService.deleteBranch(repo.path, repoState.branch, true);
          }
        }
      } catch (error) {
        console.error(`Failed to cleanup repo ${repoState.name}: ${error}`);
        // Continue with other repos
      }
    }

    // Remove workspace directory
    this.workspaceService.removeIssueDirectory(issue.workspaceDir);

    // Remove from state
    this.stateManager.deleteIssue(projectId, issueId);
  }

  /**
   * Get issue details
   */
  getIssue(projectId: string, issueId: string): Issue | undefined {
    return this.stateManager.getIssue(projectId, issueId);
  }

  /**
   * List all issues for a project
   */
  listIssues(projectId: string): Issue[] {
    return this.stateManager.loadIssues(projectId);
  }

  /**
   * Find orphaned issue directories (exist in workspace but not in state)
   */
  async findOrphanedIssues(projectId: string): Promise<string[]> {
    const workspaceDir = this.configManager.getWorkspaceDir();
    const projectWorkspaceDir = path.join(workspaceDir, projectId);

    // Get all issues from state
    const activeIssues = this.stateManager.loadIssues(projectId);
    const activeIssueIds = new Set(activeIssues.map(i => i.id));

    // Get all directories in project workspace
    const orphaned: string[] = [];

    if (!fs.existsSync(projectWorkspaceDir)) {
      return orphaned;
    }

    const entries = fs.readdirSync(projectWorkspaceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !activeIssueIds.has(entry.name)) {
        orphaned.push(entry.name);
      }
    }

    return orphaned;
  }

  /**
   * Cleanup orphaned issue directories
   */
  async cleanupOrphanedIssues(projectId: string): Promise<number> {
    const orphaned = await this.findOrphanedIssues(projectId);
    const workspaceDir = this.configManager.getWorkspaceDir();

    for (const issueId of orphaned) {
      const issueDir = path.join(workspaceDir, projectId, issueId);
      this.workspaceService.removeIssueDirectory(issueDir);
    }

    return orphaned.length;
  }
}
