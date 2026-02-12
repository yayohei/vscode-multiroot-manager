/**
 * TreeView provider for projects and issues
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { StateManager } from '../services/stateManager';
import { Project, Issue } from '../models/types';

type TreeNode = ProjectNode | IssueNode | RepoNode;

class ProjectNode {
  constructor(
    public readonly project: Project,
    public readonly issueCount: number
  ) {}
}

class IssueNode {
  constructor(
    public readonly issue: Issue,
    public readonly project: Project
  ) {}
}

class RepoNode {
  constructor(
    public readonly repoName: string,
    public readonly issue: Issue,
    public readonly project: Project
  ) {}
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private configManager: ConfigManager,
    private stateManager: StateManager
  ) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element instanceof ProjectNode) {
      return this.getProjectTreeItem(element);
    } else if (element instanceof IssueNode) {
      return this.getIssueTreeItem(element);
    } else if (element instanceof RepoNode) {
      return this.getRepoTreeItem(element);
    }

    return new vscode.TreeItem('Unknown');
  }

  /**
   * Get children for tree node
   */
  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      // Root level: show all projects
      return Promise.resolve(this.getProjects());
    }

    if (element instanceof ProjectNode) {
      // Project level: show all issues
      return Promise.resolve(this.getIssues(element.project));
    }

    if (element instanceof IssueNode) {
      // Issue level: show all repos
      return Promise.resolve(this.getRepos(element.issue, element.project));
    }

    return Promise.resolve([]);
  }

  /**
   * Get all projects
   */
  private getProjects(): ProjectNode[] {
    const projects = this.configManager.loadProjects();
    const nodes: ProjectNode[] = [];

    for (const project of projects) {
      const issues = this.stateManager.loadIssues(project.id);
      nodes.push(new ProjectNode(project, issues.length));
    }

    return nodes;
  }

  /**
   * Get all issues for a project
   */
  private getIssues(project: Project): IssueNode[] {
    const issues = this.stateManager.loadIssues(project.id);
    return issues.map(issue => new IssueNode(issue, project));
  }

  /**
   * Get all repos for an issue
   */
  private getRepos(issue: Issue, project: Project): RepoNode[] {
    if (!issue.repos || !Array.isArray(issue.repos)) {
      return [];
    }
    return issue.repos.map(repo => new RepoNode(repo.name, issue, project));
  }

  /**
   * Create tree item for project
   */
  private getProjectTreeItem(node: ProjectNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${node.project.name} (${node.issueCount} issues)`,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    item.contextValue = 'project';
    item.iconPath = new vscode.ThemeIcon('folder-library');
    item.tooltip = node.project.description || node.project.name;

    return item;
  }

  /**
   * Create tree item for issue
   */
  private getIssueTreeItem(node: IssueNode): vscode.TreeItem {
    const label = node.issue.title
      ? `${node.issue.id} - ${node.issue.title}`
      : node.issue.id;

    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    item.contextValue = 'issue';
    item.description = this.getIssueStatusLabel(node.issue.status);

    // Set icon based on status
    switch (node.issue.status) {
      case 'active':
        item.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.green'));
        break;
      case 'pr_created':
        item.iconPath = new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.blue'));
        break;
      case 'merged':
        item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.purple'));
        break;
      case 'closed':
        item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.gray'));
        break;
    }

    item.tooltip = this.getIssueTooltip(node.issue);

    return item;
  }

  /**
   * Create tree item for repo
   */
  private getRepoTreeItem(node: RepoNode): vscode.TreeItem {
    const repoState = node.issue.repos.find(r => r.name === node.repoName);
    if (!repoState) {
      return new vscode.TreeItem(node.repoName);
    }

    const item = new vscode.TreeItem(
      node.repoName,
      vscode.TreeItemCollapsibleState.None
    );

    item.contextValue = 'repo';
    item.description = `${repoState.branch}${repoState.pushed ? ' ✓pushed' : ''}`;
    item.iconPath = new vscode.ThemeIcon('repo');
    item.tooltip = `Branch: ${repoState.branch}\nPath: ${repoState.worktreePath}`;

    return item;
  }

  /**
   * Get status label for display
   */
  private getIssueStatusLabel(status: Issue['status']): string {
    switch (status) {
      case 'active':
        return '[active]';
      case 'pr_created':
        return '[PR created]';
      case 'merged':
        return '[merged]';
      case 'closed':
        return '[closed]';
      default:
        return '';
    }
  }

  /**
   * Get tooltip for issue
   */
  private getIssueTooltip(issue: Issue): string {
    const lines = [
      `Issue: ${issue.id}`,
      `Status: ${issue.status}`,
      `Workspace: ${issue.workspaceDir}`,
      `Repositories: ${issue.repos.length}`,
      `Created: ${new Date(issue.createdAt).toLocaleString()}`
    ];

    if (issue.title) {
      lines.unshift(`${issue.title}`);
    }

    return lines.join('\n');
  }
}
