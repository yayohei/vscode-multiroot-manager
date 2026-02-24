/**
 * Git service for worktree and branch operations
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

export class GitService {
  /**
   * Create a new worktree with a new branch
   */
  async createWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string,
    baseBranch: string = 'main'
  ): Promise<void> {
    const git: SimpleGit = simpleGit(repoPath);

    // Ensure we're on latest base branch
    await git.fetch();

    // Create worktree with new branch
    // git worktree add -b <branch> <path> <base-branch>
    await git.raw([
      'worktree',
      'add',
      '-b',
      branchName,
      worktreePath,
      `origin/${baseBranch}`
    ]);
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    const git: SimpleGit = simpleGit(repoPath);

    // Remove worktree
    await git.raw(['worktree', 'remove', worktreePath, '--force']);
  }

  /**
   * Delete a branch (local)
   */
  async deleteBranch(repoPath: string, branchName: string, force: boolean = false): Promise<void> {
    const git: SimpleGit = simpleGit(repoPath);

    const flag = force ? '-D' : '-d';
    await git.raw(['branch', flag, branchName]);
  }

  /**
   * Check if a worktree exists
   */
  async worktreeExists(worktreePath: string): Promise<boolean> {
    return fs.existsSync(path.join(worktreePath, '.git'));
  }

  /**
   * Get worktree list for a repository
   */
  async listWorktrees(repoPath: string): Promise<string[]> {
    const git: SimpleGit = simpleGit(repoPath);

    try {
      const output = await git.raw(['worktree', 'list', '--porcelain']);
      const worktrees: string[] = [];

      // Parse worktree list output
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktrees.push(line.substring('worktree '.length));
        }
      }

      return worktrees;
    } catch (error) {
      console.error(`Failed to list worktrees: ${error}`);
      return [];
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    const git: SimpleGit = simpleGit(repoPath);

    try {
      const branches = await git.branchLocal();
      return branches.all.includes(branchName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get branch status (created, pushed, etc.)
   */
  async getBranchStatus(repoPath: string, branchName: string): Promise<{
    created: boolean;
    pushed: boolean;
  }> {
    const git: SimpleGit = simpleGit(repoPath);

    const created = await this.branchExists(repoPath, branchName);
    let pushed = false;

    if (created) {
      try {
        // Check if branch exists on remote
        const remotes = await git.raw(['ls-remote', '--heads', 'origin', branchName]);
        pushed = remotes.trim().length > 0;
      } catch (error) {
        pushed = false;
      }
    }

    return { created, pushed };
  }

  /**
   * Get organization name from remote URL
   * Supports: git@host:{org}/{repo}.git, ssh://git@host/{org}/{repo}.git, https://host/{org}/{repo}.git
   */
  async getOrgFromRemote(repoPath: string, remote: string = 'origin'): Promise<string> {
    const git: SimpleGit = simpleGit(repoPath);

    const remoteUrl = await git.raw(['remote', 'get-url', remote]);
    const url = remoteUrl.trim();

    // SSH URL format: ssh://git@github.com/{org}/{repo}.git
    const sshUrlMatch = url.match(/^ssh:\/\/git@[^/]+\/([^/]+)\//);
    if (sshUrlMatch) {
      return sshUrlMatch[1];
    }

    // Standard SSH format: git@github.com:{org}/{repo}.git
    const sshMatch = url.match(/^git@[^:]+:([^/]+)\//);
    if (sshMatch) {
      return sshMatch[1];
    }

    // HTTPS format: https://github.com/{org}/{repo}.git
    const httpsMatch = url.match(/^https?:\/\/[^/]+\/([^/]+)\//);
    if (httpsMatch) {
      return httpsMatch[1];
    }

    throw new Error(`Failed to parse org from remote URL: ${url}`);
  }

  /**
   * Validate repository path
   */
  async isValidRepository(repoPath: string): Promise<boolean> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      await git.status();
      return true;
    } catch (error) {
      return false;
    }
  }
}
