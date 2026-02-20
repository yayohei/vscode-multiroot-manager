/**
 * VS Code Multiroot Manager Extension
 * Entry point - activate and register commands
 */

import * as vscode from 'vscode';
import { ConfigManager } from './config/configManager';
import { StateManager } from './services/stateManager';
import { IssueService } from './services/issueService';
import { ProjectManager } from './services/projectManager';
import { ProjectTreeProvider } from './views/projectTreeProvider';
import { StatusBarManager } from './statusBar/statusBarManager';
import { createProjectCommand } from './commands/createProjectCommand';
import { CreateIssueOptions, DeleteIssueOptions } from './models/types';
import * as path from 'path';

let issueService: IssueService;
let projectManager: ProjectManager;
let treeProvider: ProjectTreeProvider;
let statusBarManager: StatusBarManager;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Multiroot Manager');
  outputChannel.appendLine('Multiroot Manager extension activated');

  // Initialize services
  configManager = new ConfigManager();
  const stateManager = new StateManager(configManager.getConfigDir());
  issueService = new IssueService(configManager, stateManager);
  projectManager = new ProjectManager(configManager.getConfigDir());

  // Initialize TreeView
  treeProvider = new ProjectTreeProvider(configManager, stateManager);
  vscode.window.registerTreeDataProvider('mrmProjects', treeProvider);

  // Initialize Status Bar
  statusBarManager = new StatusBarManager(configManager, stateManager);
  statusBarManager.activate(context);

  // Register commands
  context.subscriptions.push(
    // Project commands
    vscode.commands.registerCommand('mrm.createProject', () =>
      createProjectCommand(configManager, projectManager, () => {
        treeProvider.refresh();
      })
    ),
    vscode.commands.registerCommand('mrm.showProjectInfo', showProjectInfoCommand),
    vscode.commands.registerCommand('mrm.editProject', editProjectCommand),
    // Issue commands
    vscode.commands.registerCommand('mrm.createIssue', createIssueCommand),
    vscode.commands.registerCommand('mrm.openWorkspace', openWorkspaceCommand),
    vscode.commands.registerCommand('mrm.deleteIssue', deleteIssueCommand),
    vscode.commands.registerCommand('mrm.refreshAll', refreshAllCommand),
    vscode.commands.registerCommand('mrm.showStatus', showStatusCommand),
    vscode.commands.registerCommand('mrm.switchIssue', switchIssueCommand),
    vscode.commands.registerCommand('mrm.cleanupWorkspaces', cleanupWorkspacesCommand)
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

        // Refresh tree view and status bar
        treeProvider.refresh();
        statusBarManager.detectAndUpdateCurrentIssue();
      }
    );

    // Show success message and ask to open workspace
    const openNow = await vscode.window.showInformationMessage(
      `Issue ${issueId} created successfully!`,
      'Open Workspace',
      'Later'
    );

    if (openNow === 'Open Workspace') {
      const issue = issueService.getIssue(selectedProject.projectId, issueId);
      if (issue) {
        const workspaceFile = path.join(issue.workspaceDir, `${issueId}.code-workspace`);
        const uri = vscode.Uri.file(workspaceFile);
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
      }
    }
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

        // Refresh tree view and status bar
        treeProvider.refresh();
        statusBarManager.detectAndUpdateCurrentIssue();
      }
    );

    vscode.window.showInformationMessage(`Issue ${issueToDelete.id} deleted successfully`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete issue: ${error}`);
  }
}

/**
 * Refresh All command
 */
function refreshAllCommand(): void {
  treeProvider.refresh();
  statusBarManager.detectAndUpdateCurrentIssue();
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
 * Show Project Info command
 */
async function showProjectInfoCommand(item?: any): Promise<void> {
  if (!item || !item.project) {
    vscode.window.showInformationMessage('Please select a project from the tree view');
    return;
  }

  const project = item.project;
  const stateManager = new StateManager(configManager.getConfigDir());
  const issues = stateManager.loadIssues(project.id);

  // Count issues by status
  const statusCounts = issues.reduce((acc: any, issue: any) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {});

  // Create Webview Panel
  const panel = vscode.window.createWebviewPanel(
    'projectInfo',
    `Project: ${project.name}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'saveProject':
          try {
            // Update project
            projectManager.updateProject(project.id, {
              name: message.data.name,
              description: message.data.description,
              repositories: message.data.repositories
            });

            // Refresh tree view
            treeProvider.refresh();

            // Reload and redisplay
            const updatedProjects = configManager.loadProjects();
            const updatedProject = updatedProjects.find(p => p.id === project.id);
            if (updatedProject) {
              const updatedIssues = stateManager.loadIssues(updatedProject.id);
              const updatedStatusCounts = updatedIssues.reduce((acc: any, issue: any) => {
                acc[issue.status] = (acc[issue.status] || 0) + 1;
                return acc;
              }, {});
              panel.webview.html = getProjectInfoHtml(updatedProject, updatedIssues, updatedStatusCounts);
            }

            vscode.window.showInformationMessage('Project updated successfully');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to update project: ${error}`);
          }
          break;
      }
    },
    undefined,
    []
  );

  // Generate HTML content
  panel.webview.html = getProjectInfoHtml(project, issues, statusCounts);
}

function getProjectInfoHtml(project: any, issues: any[], statusCounts: any): string {
  // Read-only view
  const repositoriesHtml = project.repositories.map((r: any) => `
    <tr>
      <td><strong>${r.name}</strong></td>
      <td><code>${r.path}</code></td>
      <td><span class="badge">${r.defaultBranch || r.default_branch}</span></td>
      <td>${r.remote || 'origin'}</td>
    </tr>
  `).join('');

  // Editable form
  const repositoriesFormHtml = project.repositories.map((r: any, index: number) => `
    <div class="repo-item" data-index="${index}">
      <div class="repo-header">
        <h4>Repository ${index + 1}</h4>
        <button class="btn-delete" onclick="removeRepository(${index})">🗑️ Remove</button>
      </div>
      <div class="form-grid">
        <label>Name:</label>
        <input type="text" class="repo-name" value="${r.name}" required>

        <label>Path:</label>
        <input type="text" class="repo-path" value="${r.path}" required>

        <label>Default Branch:</label>
        <input type="text" class="repo-branch" value="${r.defaultBranch || r.default_branch}" required>

        <label>Remote:</label>
        <input type="text" class="repo-remote" value="${r.remote || 'origin'}" required>
      </div>
    </div>
  `).join('');

  const issuesHtml = issues.length > 0 ? issues.map((issue: any) => {
    const statusClass = issue.status === 'active' ? 'status-active' : 'status-inactive';
    const statusIcon = issue.status === 'active' ? '🟢' : '⚪';
    return `
      <tr>
        <td>${statusIcon} <strong>${issue.id}</strong></td>
        <td>${issue.title || '-'}</td>
        <td><span class="badge ${statusClass}">${issue.status}</span></td>
        <td>${issue.repos.length} repos</td>
        <td>${new Date(issue.updatedAt).toLocaleDateString()}</td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--vscode-descriptionForeground);">No issues yet</td></tr>';

  const statusSummaryHtml = Object.entries(statusCounts).map(([status, count]) => `
    <span class="status-chip">${status}: ${count}</span>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Info</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    h1 {
      color: var(--vscode-foreground);
      border-bottom: 2px solid var(--vscode-panel-border);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    h2 {
      color: var(--vscode-foreground);
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.3em;
    }

    .section {
      margin-bottom: 30px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .info-label {
      color: var(--vscode-descriptionForeground);
      font-weight: bold;
    }

    .info-value {
      color: var(--vscode-foreground);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      color: var(--vscode-foreground);
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid var(--vscode-panel-border);
    }

    td {
      padding: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    tr:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    code {
      background-color: var(--vscode-textCodeBlock-background);
      color: var(--vscode-textPreformat-foreground);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }

    .badge {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: bold;
    }

    .status-active {
      background-color: #28a745;
      color: white;
    }

    .status-inactive {
      background-color: #6c757d;
      color: white;
    }

    .status-chip {
      display: inline-block;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 5px 12px;
      border-radius: 15px;
      margin-right: 10px;
      font-size: 0.9em;
    }

    .summary-box {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-left: 4px solid var(--vscode-activityBarBadge-background);
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }

    .icon {
      margin-right: 8px;
    }

    /* Edit mode styles */
    .edit-mode { display: none; }
    .view-mode { display: block; }

    .mode-edit .edit-mode { display: block; }
    .mode-edit .view-mode { display: none; }

    input[type="text"], textarea {
      width: 100%;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    input[type="text"]:focus, textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    textarea {
      min-height: 60px;
      resize: vertical;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 10px;
      align-items: center;
      margin-bottom: 15px;
    }

    .form-grid label {
      color: var(--vscode-descriptionForeground);
      font-weight: bold;
    }

    .repo-item {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 15px;
    }

    .repo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .repo-header h4 {
      margin: 0;
      color: var(--vscode-foreground);
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 3px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn-delete {
      background-color: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      padding: 5px 10px;
      font-size: 0.9em;
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .action-bar {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1><span class="icon">📁</span><span id="projectNameDisplay">${project.name}</span></h1>
    <div>
      <button class="view-mode" onclick="enterEditMode()">✏️ Edit Project</button>
      <button class="edit-mode btn-secondary" onclick="cancelEdit()">❌ Cancel</button>
      <button class="edit-mode" onclick="saveProject()">💾 Save</button>
    </div>
  </div>

  <!-- View Mode -->
  <div class="view-mode">
    <div class="section">
      <div class="info-grid">
        <div class="info-label">Project ID:</div>
        <div class="info-value"><code>${project.id}</code></div>

        ${project.description ? `
        <div class="info-label">Description:</div>
        <div class="info-value">${project.description}</div>
        ` : ''}

        <div class="info-label">Config File:</div>
        <div class="info-value"><code>${projectManager.getProjectFilePath(project.id)}</code></div>

        <div class="info-label">Workspace Dir:</div>
        <div class="info-value"><code>${configManager.getWorkspaceDir()}/${project.id}/</code></div>
      </div>
    </div>

    <div class="section">
      <h2><span class="icon">📦</span>Repositories (${project.repositories.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Path</th>
            <th>Default Branch</th>
            <th>Remote</th>
          </tr>
        </thead>
        <tbody>
          ${repositoriesHtml}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Edit Mode -->
  <div class="edit-mode">
    <div class="section">
      <h2>Project Settings</h2>
      <div class="form-grid">
        <label>Project ID:</label>
        <div><code>${project.id}</code> (read-only)</div>

        <label>Project Name:</label>
        <input type="text" id="projectName" value="${project.name}" required>

        <label>Description:</label>
        <textarea id="projectDescription">${project.description || ''}</textarea>
      </div>
    </div>

    <div class="section">
      <h2><span class="icon">📦</span>Repositories</h2>
      <div id="repositoriesList">
        ${repositoriesFormHtml}
      </div>
      <button class="btn-secondary" onclick="addRepository()">➕ Add Repository</button>
    </div>
  </div>

  <div class="section">
    <h2><span class="icon">🎫</span>Issues (${issues.length})</h2>

    ${issues.length > 0 ? `
    <div class="summary-box">
      <strong>Status Summary:</strong><br>
      ${statusSummaryHtml}
    </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th>Issue ID</th>
          <th>Title</th>
          <th>Status</th>
          <th>Repositories</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        ${issuesHtml}
      </tbody>
    </table>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let repoCounter = ${project.repositories.length};

    function enterEditMode() {
      document.body.classList.add('mode-edit');
    }

    function cancelEdit() {
      document.body.classList.remove('mode-edit');
    }

    function addRepository() {
      const list = document.getElementById('repositoriesList');
      const newRepo = document.createElement('div');
      newRepo.className = 'repo-item';
      newRepo.dataset.index = repoCounter;
      newRepo.innerHTML = \`
        <div class="repo-header">
          <h4>Repository \${repoCounter + 1}</h4>
          <button class="btn-delete" onclick="removeRepository(\${repoCounter})">🗑️ Remove</button>
        </div>
        <div class="form-grid">
          <label>Name:</label>
          <input type="text" class="repo-name" value="" required>

          <label>Path:</label>
          <input type="text" class="repo-path" value="" required>

          <label>Default Branch:</label>
          <input type="text" class="repo-branch" value="main" required>

          <label>Remote:</label>
          <input type="text" class="repo-remote" value="origin" required>
        </div>
      \`;
      list.appendChild(newRepo);
      repoCounter++;
    }

    function removeRepository(index) {
      const repo = document.querySelector(\`.repo-item[data-index="\${index}"]\`);
      if (repo) {
        const list = document.getElementById('repositoriesList');
        if (list.children.length > 1) {
          repo.remove();
        } else {
          alert('At least one repository is required');
        }
      }
    }

    function saveProject() {
      const name = document.getElementById('projectName').value.trim();
      const description = document.getElementById('projectDescription').value.trim();

      if (!name) {
        alert('Project name is required');
        return;
      }

      // Collect repositories
      const repositories = [];
      const repoItems = document.querySelectorAll('.repo-item');

      for (const item of repoItems) {
        const repoName = item.querySelector('.repo-name').value.trim();
        const repoPath = item.querySelector('.repo-path').value.trim();
        const repoBranch = item.querySelector('.repo-branch').value.trim();
        const repoRemote = item.querySelector('.repo-remote').value.trim();

        if (!repoName || !repoPath || !repoBranch) {
          alert('All repository fields are required');
          return;
        }

        repositories.push({
          name: repoName,
          path: repoPath,
          defaultBranch: repoBranch,
          remote: repoRemote || 'origin'
        });
      }

      if (repositories.length === 0) {
        alert('At least one repository is required');
        return;
      }

      // Send data to extension
      vscode.postMessage({
        command: 'saveProject',
        data: {
          name,
          description,
          repositories
        }
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Edit Project YAML command
 */
async function editProjectCommand(item?: any): Promise<void> {
  try {
    let projectId: string;

    // Get project from context menu or quick pick
    if (item && item.project) {
      projectId = item.project.id;
    } else {
      // Show quick pick
      const configManager = new ConfigManager();
      const projects = configManager.loadProjects();

      if (projects.length === 0) {
        vscode.window.showInformationMessage('No projects found');
        return;
      }

      const projectItems = projects.map(p => ({
        label: p.name,
        description: p.description,
        projectId: p.id
      }));

      const selected = await vscode.window.showQuickPick(projectItems, {
        placeHolder: 'Select a project to edit'
      });

      if (!selected) {
        return;
      }

      projectId = selected.projectId;
    }

    // Open YAML file in editor
    const filePath = projectManager.getProjectFilePath(projectId);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open project file: ${error}`);
  }
}

/**
 * Switch Issue command (Quick Pick)
 */
async function switchIssueCommand(): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const projects = configManager.loadProjects();
    const stateManager = new StateManager(configManager.getConfigDir());

    // Build issue items for Quick Pick
    const issueItems: Array<{
      label: string;
      description: string;
      detail: string;
      issue: any;
      projectId: string;
    }> = [];

    for (const project of projects) {
      const issues = stateManager.loadIssues(project.id);
      for (const issue of issues) {
        issueItems.push({
          label: `$(folder) ${issue.id}${issue.title ? ` - ${issue.title}` : ''}`,
          description: project.name,
          detail: `${issue.repos.length} ${issue.repos.length === 1 ? 'repo' : 'repos'} | ${issue.status}`,
          issue,
          projectId: project.id
        });
      }
    }

    if (issueItems.length === 0) {
      vscode.window.showInformationMessage('No issues found');
      return;
    }

    // Show Quick Pick
    const selected = await vscode.window.showQuickPick(issueItems, {
      placeHolder: 'Select an issue to switch to',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) {
      return;
    }

    // Open workspace
    const workspaceFile = path.join(
      selected.issue.workspaceDir,
      `${selected.issue.id}.code-workspace`
    );
    const uri = vscode.Uri.file(workspaceFile);
    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to switch issue: ${error}`);
  }
}

/**
 * Cleanup orphaned workspace directories
 */
async function cleanupWorkspacesCommand(): Promise<void> {
  try {
    // Get all projects
    const projects = projectManager.listProjects();

    if (projects.length === 0) {
      vscode.window.showInformationMessage('No projects found');
      return;
    }

    // Find all orphaned issues across all projects
    let totalOrphaned = 0;
    const orphanedByProject: { [key: string]: string[] } = {};

    for (const project of projects) {
      const orphaned = await issueService.findOrphanedIssues(project.id);
      if (orphaned.length > 0) {
        orphanedByProject[project.id] = orphaned;
        totalOrphaned += orphaned.length;
      }
    }

    if (totalOrphaned === 0) {
      vscode.window.showInformationMessage('✅ No orphaned workspace directories found');
      return;
    }

    // Show confirmation dialog
    const message = `Found ${totalOrphaned} orphaned workspace ${totalOrphaned === 1 ? 'directory' : 'directories'}:\n\n` +
      Object.entries(orphanedByProject)
        .map(([projectId, issues]) => `${projectId}: ${issues.join(', ')}`)
        .join('\n');

    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Delete All',
      'Cancel'
    );

    if (choice !== 'Delete All') {
      return;
    }

    // Delete all orphaned directories
    let deletedCount = 0;
    for (const project of projects) {
      const count = await issueService.cleanupOrphanedIssues(project.id);
      deletedCount += count;
    }

    vscode.window.showInformationMessage(
      `🗑️ Deleted ${deletedCount} orphaned workspace ${deletedCount === 1 ? 'directory' : 'directories'}`
    );

    // Refresh tree view
    treeProvider.refresh();

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to cleanup workspaces: ${error}`);
  }
}

export function deactivate(): void {
  // Cleanup
}
