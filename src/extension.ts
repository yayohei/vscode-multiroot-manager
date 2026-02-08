/**
 * VS Code Multiroot Manager Extension
 * Entry point - activate and register commands
 */

import * as vscode from 'vscode';
import { ConfigManager } from './config/configManager';
import { StateManager } from './services/stateManager';
import { IssueService } from './services/issueService';
import { ProjectTreeProvider } from './views/projectTreeProvider';
import { CreateIssueOptions, DeleteIssueOptions } from './models/types';
import * as path from 'path';

let issueService: IssueService;
let treeProvider: ProjectTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Multiroot Manager');
  outputChannel.appendLine('Multiroot Manager extension activated');

  // Initialize services
  const configManager = new ConfigManager();
  const stateManager = new StateManager(configManager.getConfigDir());
  issueService = new IssueService(configManager, stateManager);

  // Initialize TreeView
  treeProvider = new ProjectTreeProvider(configManager, stateManager);
  vscode.window.registerTreeDataProvider('mrmProjects', treeProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mrm.createIssue', createIssueCommand),
    vscode.commands.registerCommand('mrm.openWorkspace', openWorkspaceCommand),
    vscode.commands.registerCommand('mrm.deleteIssue', deleteIssueCommand),
    vscode.commands.registerCommand('mrm.refreshAll', refreshAllCommand),
    vscode.commands.registerCommand('mrm.showStatus', showStatusCommand),
    // PR and Review commands - Phase 3
    vscode.commands.registerCommand('mrm.createPR', createPRCommand),
    vscode.commands.registerCommand('mrm.reviewCode', reviewCodeCommand)
  );

  outputChannel.appendLine('All commands registered');
  outputChannel.appendLine(`Config directory: ${configManager.getConfigDir()}`);
  outputChannel.appendLine(`Workspace directory: ${configManager.getWorkspaceDir()}`);
}

/**
 * Create Issue command
 */
async function createIssueCommand(): Promise<void> {
  try {
    // Load projects
    const configManager = new ConfigManager();
    const projects = configManager.loadProjects();

    if (projects.length === 0) {
      vscode.window.showErrorMessage('No projects found in config directory');
      return;
    }

    // Step 1: Select project
    const projectItems = projects.map(p => ({
      label: p.name,
      description: p.description,
      projectId: p.id
    }));

    const selectedProject = await vscode.window.showQuickPick(projectItems, {
      placeHolder: 'Select a project'
    });

    if (!selectedProject) {
      return;
    }

    // Step 2: Enter issue ID
    const issueId = await vscode.window.showInputBox({
      prompt: 'Enter issue ID (e.g., SHOP-123)',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Issue ID is required';
        }
        return null;
      }
    });

    if (!issueId) {
      return;
    }

    // Step 3: Enter title (optional)
    const title = await vscode.window.showInputBox({
      prompt: 'Enter issue title (optional)',
      placeHolder: 'Add payment retry logic'
    });

    // Step 4: Enter description (optional)
    const description = await vscode.window.showInputBox({
      prompt: 'Enter issue description (optional)',
      placeHolder: 'Implement retry mechanism for payment failures'
    });

    // Create issue
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Creating issue ${issueId}...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Creating worktrees...' });

        const options: CreateIssueOptions = {
          projectId: selectedProject.projectId,
          issueId,
          title,
          description
        };

        const issue = await issueService.createIssue(options);

        progress.report({ increment: 100, message: 'Done!' });

        // Refresh tree view
        treeProvider.refresh();

        // Ask to open workspace
        const openNow = await vscode.window.showInformationMessage(
          `Issue ${issueId} created successfully!`,
          'Open Workspace',
          'Later'
        );

        if (openNow === 'Open Workspace') {
          const workspaceFile = path.join(issue.workspaceDir, `${issueId}.code-workspace`);
          const uri = vscode.Uri.file(workspaceFile);
          await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create issue: ${error}`);
  }
}

/**
 * Open Workspace command
 */
async function openWorkspaceCommand(item?: any): Promise<void> {
  try {
    // If called from context menu, item contains issue info
    if (item && item.issue) {
      const issue = item.issue;
      const workspaceFile = path.join(issue.workspaceDir, `${issue.id}.code-workspace`);
      const uri = vscode.Uri.file(workspaceFile);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
      return;
    }

    // Otherwise, show quick pick
    const configManager = new ConfigManager();
    const projects = configManager.loadProjects();
    const stateManager = new StateManager(configManager.getConfigDir());

    const issueItems: Array<{ label: string; description: string; issue: any }> = [];

    for (const project of projects) {
      const issues = stateManager.loadIssues(project.id);
      for (const issue of issues) {
        issueItems.push({
          label: `${issue.id}${issue.title ? ` - ${issue.title}` : ''}`,
          description: `${project.name} [${issue.status}]`,
          issue
        });
      }
    }

    if (issueItems.length === 0) {
      vscode.window.showInformationMessage('No issues found');
      return;
    }

    const selected = await vscode.window.showQuickPick(issueItems, {
      placeHolder: 'Select an issue to open'
    });

    if (selected) {
      const workspaceFile = path.join(selected.issue.workspaceDir, `${selected.issue.id}.code-workspace`);
      const uri = vscode.Uri.file(workspaceFile);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open workspace: ${error}`);
  }
}

/**
 * Delete Issue command
 */
async function deleteIssueCommand(item?: any): Promise<void> {
  try {
    let issueToDelete: any;
    let projectId: string;

    // Get issue from context menu or quick pick
    if (item && item.issue && item.project) {
      issueToDelete = item.issue;
      projectId = item.project.id;
    } else {
      // Show quick pick
      const configManager = new ConfigManager();
      const projects = configManager.loadProjects();
      const stateManager = new StateManager(configManager.getConfigDir());

      const issueItems: Array<{ label: string; description: string; issue: any; projectId: string }> = [];

      for (const project of projects) {
        const issues = stateManager.loadIssues(project.id);
        for (const issue of issues) {
          issueItems.push({
            label: `${issue.id}${issue.title ? ` - ${issue.title}` : ''}`,
            description: `${project.name} [${issue.status}]`,
            issue,
            projectId: project.id
          });
        }
      }

      if (issueItems.length === 0) {
        vscode.window.showInformationMessage('No issues found');
        return;
      }

      const selected = await vscode.window.showQuickPick(issueItems, {
        placeHolder: 'Select an issue to delete'
      });

      if (!selected) {
        return;
      }

      issueToDelete = selected.issue;
      projectId = selected.projectId;
    }

    // Confirm deletion
    const deleteBranchesChoice = await vscode.window.showWarningMessage(
      `Delete issue ${issueToDelete.id}?`,
      { modal: true, detail: 'This will remove worktrees and workspace files.' },
      'Delete (Keep Branches)',
      'Delete (Remove Branches)',
      'Cancel'
    );

    if (!deleteBranchesChoice || deleteBranchesChoice === 'Cancel') {
      return;
    }

    const deleteBranches = deleteBranchesChoice === 'Delete (Remove Branches)';

    // Delete issue
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Deleting issue ${issueToDelete.id}...`,
        cancellable: false
      },
      async (progress) => {
        const options: DeleteIssueOptions = { deleteBranches };
        await issueService.deleteIssue(projectId, issueToDelete.id, options);

        progress.report({ increment: 100, message: 'Done!' });

        // Refresh tree view
        treeProvider.refresh();

        vscode.window.showInformationMessage(`Issue ${issueToDelete.id} deleted successfully`);
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete issue: ${error}`);
  }
}

/**
 * Refresh All command
 */
function refreshAllCommand(): void {
  treeProvider.refresh();
  vscode.window.showInformationMessage('Refreshed');
}

/**
 * Show Status command
 */
async function showStatusCommand(item?: any): Promise<void> {
  if (!item || !item.issue) {
    vscode.window.showInformationMessage('Please select an issue from the tree view');
    return;
  }

  const issue = item.issue;
  const lines = [
    `Issue: ${issue.id}`,
    issue.title ? `Title: ${issue.title}` : '',
    `Status: ${issue.status}`,
    `Project: ${item.project.name}`,
    `Workspace: ${issue.workspaceDir}`,
    '',
    'Repositories:',
    ...issue.repos.map((r: any) => `  - ${r.name}: ${r.branch} ${r.pushed ? '✓pushed' : ''}`),
    '',
    `Created: ${new Date(issue.createdAt).toLocaleString()}`,
    `Updated: ${new Date(issue.updatedAt).toLocaleString()}`
  ].filter(Boolean);

  vscode.window.showInformationMessage(lines.join('\n'));
}

/**
 * Create PR command (Phase 3 - placeholder)
 */
function createPRCommand(): void {
  vscode.window.showInformationMessage('Create PR - Not yet implemented (Phase 3)');
}

/**
 * Review Code command (Phase 4 - placeholder)
 */
function reviewCodeCommand(): void {
  vscode.window.showInformationMessage('AI Code Review - Not yet implemented (Phase 4)');
}

export function deactivate(): void {
  // Cleanup
}
