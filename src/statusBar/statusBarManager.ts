/**
 * Status bar manager for displaying current issue
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { StateManager } from '../services/stateManager';
import { Issue } from '../models/types';
import * as path from 'path';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentIssue: Issue | null = null;

  constructor(
    private configManager: ConfigManager,
    private stateManager: StateManager
  ) {
    // Create status bar item (left side, priority 100)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.command = 'mrm.switchIssue';
    this.statusBarItem.tooltip = 'Click to switch issue';
  }

  /**
   * Activate status bar and start monitoring
   */
  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.statusBarItem);

    // Detect current issue on activation
    this.detectAndUpdateCurrentIssue();

    // Monitor workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.detectAndUpdateCurrentIssue();
      })
    );
  }

  /**
   * Detect current issue from workspace and update status bar
   */
  detectAndUpdateCurrentIssue(): void {
    const issue = this.detectCurrentIssue();
    this.setCurrentIssue(issue);
  }

  /**
   * Detect current issue from workspace folders
   */
  private detectCurrentIssue(): Issue | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    // Check if this is a multi-root workspace
    if (workspaceFolders.length < 2) {
      return null;
    }

    // Try to detect from workspace file path
    const workspaceFile = vscode.workspace.workspaceFile;
    if (workspaceFile && workspaceFile.scheme === 'file') {
      const workspacePath = workspaceFile.fsPath;
      const issue = this.detectIssueFromPath(workspacePath);
      if (issue) {
        return issue;
      }
    }

    // Try to detect from folder paths
    const firstFolder = workspaceFolders[0].uri.fsPath;
    return this.detectIssueFromPath(firstFolder);
  }

  /**
   * Detect issue from workspace/folder path
   * Pattern: ~/workspaces/{project}/{issue}/
   */
  private detectIssueFromPath(fsPath: string): Issue | null {
    const workspaceDir = this.configManager.getWorkspaceDir();

    // Check if path is under workspace directory
    if (!fsPath.startsWith(workspaceDir)) {
      return null;
    }

    // Extract project and issue from path
    // e.g., ~/workspaces/mha4mysql/SHOP-123/...
    const relativePath = path.relative(workspaceDir, fsPath);
    const parts = relativePath.split(path.sep);

    if (parts.length < 2) {
      return null;
    }

    const projectId = parts[0];
    const issueId = parts[1];

    // Load issue from state
    const issue = this.stateManager.getIssue(projectId, issueId);
    return issue || null;
  }

  /**
   * Set current issue and update status bar
   */
  setCurrentIssue(issue: Issue | null): void {
    this.currentIssue = issue;
    this.updateStatusBar();
  }

  /**
   * Get current issue
   */
  getCurrentIssue(): Issue | null {
    return this.currentIssue;
  }

  /**
   * Update status bar display
   */
  private updateStatusBar(): void {
    if (!this.currentIssue) {
      this.statusBarItem.text = '$(folder-library) MRM';
      this.statusBarItem.tooltip = 'Multiroot Manager - No active issue';
      this.statusBarItem.show();
      return;
    }

    const issue = this.currentIssue;
    const repoCount = issue.repos.length;

    // Build status text
    let text = `$(folder-opened) ${issue.id}`;

    if (issue.title) {
      // Truncate long titles
      const maxTitleLength = 30;
      const title = issue.title.length > maxTitleLength
        ? issue.title.substring(0, maxTitleLength) + '...'
        : issue.title;
      text += ` - ${title}`;
    }

    text += ` (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;

    // Build tooltip
    const tooltip = [
      `Issue: ${issue.id}`,
      issue.title ? `Title: ${issue.title}` : '',
      `Status: ${issue.status}`,
      `Repositories: ${repoCount}`,
      '',
      'Click to switch issue'
    ].filter(Boolean).join('\n');

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.show();
  }

  /**
   * Hide status bar
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose status bar
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
