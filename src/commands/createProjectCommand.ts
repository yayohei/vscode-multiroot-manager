/**
 * Create Project command - Interactive wizard
 */

import * as vscode from 'vscode';
import { ProjectManager, CreateProjectData } from '../services/projectManager';
import { ConfigManager } from '../config/configManager';

interface RepositoryInput {
  name: string;
  path: string;
  defaultBranch: string;
}

export async function createProjectCommand(
  configManager: ConfigManager,
  projectManager: ProjectManager,
  onSuccess: () => void
): Promise<void> {
  try {
    // Step 1: Project ID
    const projectId = await vscode.window.showInputBox({
      prompt: 'Enter project ID (used as filename)',
      placeHolder: 'my-project',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project ID is required';
        }
        if (!/^[a-z0-9-_]+$/.test(value)) {
          return 'Project ID must contain only lowercase letters, numbers, hyphens, and underscores';
        }
        if (projectManager.projectExists(value)) {
          return `Project "${value}" already exists`;
        }
        return null;
      }
    });

    if (!projectId) {
      return; // User cancelled
    }

    // Step 2: Project Name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project name (display name)',
      placeHolder: 'My Project',
      value: projectId,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name is required';
        }
        return null;
      }
    });

    if (!projectName) {
      return;
    }

    // Step 3: Description (optional)
    const description = await vscode.window.showInputBox({
      prompt: 'Enter project description (optional)',
      placeHolder: 'Multi-repository project for...'
    });

    // Step 4: Add repositories
    const repositories: RepositoryInput[] = [];
    let addingRepositories = true;

    while (addingRepositories) {
      // Repository name
      const repoName = await vscode.window.showInputBox({
        prompt: `Repository name (${repositories.length + 1})`,
        placeHolder: 'frontend',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Repository name is required';
          }
          if (repositories.some(r => r.name === value)) {
            return `Repository "${value}" already added`;
          }
          return null;
        }
      });

      if (!repoName) {
        if (repositories.length === 0) {
          // User cancelled without adding any repository
          vscode.window.showInformationMessage('Project creation cancelled');
          return;
        }
        // User cancelled, but we have at least one repo - finish
        break;
      }

      // Repository path (folder picker)
      const repoUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: `Select ${repoName} repository folder`,
        title: `Select repository folder for ${repoName}`
      });

      if (!repoUris || repoUris.length === 0) {
        // User cancelled folder selection - abort entire process
        vscode.window.showInformationMessage('Project creation cancelled');
        return;
      }

      const repoPath = repoUris[0].fsPath;

      // Default branch
      const defaultBranch = await vscode.window.showInputBox({
        prompt: 'Default branch name',
        placeHolder: 'main',
        value: 'main',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Branch name is required';
          }
          return null;
        }
      });

      if (!defaultBranch) {
        // User cancelled branch name input - abort entire process
        vscode.window.showInformationMessage('Project creation cancelled');
        return;
      }

      // Add repository
      repositories.push({
        name: repoName,
        path: repoPath,
        defaultBranch
      });

      // Ask to add another
      const addAnother = await vscode.window.showQuickPick(
        [
          { label: '$(add) Add Another Repository', value: true },
          { label: '$(check) Finish', value: false }
        ],
        {
          placeHolder: `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} added. Add another?`
        }
      );

      if (!addAnother || !addAnother.value) {
        addingRepositories = false;
      }
    }

    if (repositories.length === 0) {
      vscode.window.showErrorMessage('Project creation cancelled: No repositories added');
      return;
    }

    // Step 5: Confirmation
    const confirmItems = [
      `**Project ID**: ${projectId}`,
      `**Name**: ${projectName}`,
      description ? `**Description**: ${description}` : '',
      '',
      `**Repositories** (${repositories.length}):`,
      ...repositories.map(r => `  - **${r.name}**: ${r.path} (${r.defaultBranch})`)
    ].filter(Boolean);

    const confirm = await vscode.window.showQuickPick(
      [
        { label: '$(check) Create Project', value: true },
        { label: '$(x) Cancel', value: false }
      ],
      {
        placeHolder: 'Review project configuration',
        title: 'Create Project',
        // Use first item's detail to show summary
      }
    );

    if (!confirm || !confirm.value) {
      vscode.window.showInformationMessage('Project creation cancelled');
      return;
    }

    // Step 6: Create project
    const projectData: CreateProjectData = {
      id: projectId,
      name: projectName,
      description,
      repositories
    };

    projectManager.createProject(projectData);

    // Success
    vscode.window.showInformationMessage(
      `Project "${projectName}" created successfully!`,
      'Open File'
    ).then(action => {
      if (action === 'Open File') {
        const filePath = projectManager.getProjectFilePath(projectId);
        vscode.workspace.openTextDocument(filePath).then(doc => {
          vscode.window.showTextDocument(doc);
        });
      }
    });

    // Trigger refresh
    onSuccess();

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create project: ${error}`);
  }
}
