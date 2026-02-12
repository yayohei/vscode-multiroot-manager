# VS Code Multiroot Manager

Manage multi-repository workspaces per issue/ticket with git worktree, GitHub integration, and workspace automation.

## Features

### Core Features (Phase 2 - ✅ Implemented)

- **Issue Creation**: Create issues with automatic worktree and branch setup across multiple repositories
- **Workspace Generation**: Generate `.code-workspace` files with all repositories included
- **Issue Management**: View all projects and issues in a tree view
- **Issue Deletion**: Clean up worktrees, branches, and workspace files
- **CLI Compatibility**: Shares configuration with the `mrm` CLI tool (`~/.config/vscode-multiroot-manager/`)

### TreeView

Browse projects and issues in the Activity Bar sidebar:

```
MRM: Projects
├── web-app (3 repos, 5 issues)
│   ├── SHOP-456 - Add payment retry   [active]
│   │   ├── frontend   ✓pushed
│   │   ├── backend    ✓pushed
│   │   └── common     ✓pushed
│   └── SHOP-457 - Fix cart timeout    [active]
└── mobile-app (2 repos, 3 issues)
```

### Commands

**Project Management**
- `MRM: Create Project` - Create a new project with interactive wizard
- `MRM: Show Project Info` - Display project details and configuration
- `MRM: Edit Project YAML` - Open project configuration file in editor

**Issue Management**
- `MRM: Create Issue` - Create a new issue with worktrees
- `MRM: Open Workspace` - Open issue workspace in new window
- `MRM: Switch Issue` - Quick Pick for switching between issues
- `MRM: Delete Issue` - Delete issue and clean up resources
- `MRM: Show Status` - Show issue details

**General**
- `MRM: Refresh` - Refresh tree view

## Requirements

- VS Code 1.85.0 or higher
- Git installed and configured
- Repositories cloned locally

## Installation

### From VSIX (Development)

```bash
code --install-extension vscode-multiroot-manager-0.1.0.vsix
```

### From Marketplace (Coming Soon)

Search for "Multiroot Manager" in VS Code Extensions.

## Configuration

### Project Setup

#### Using Interactive Wizard (Recommended)

1. Click the Multiroot Manager icon in the Activity Bar
2. Click the "New Folder" icon in the toolbar (or run `MRM: Create Project`)
3. Follow the wizard:
   - Enter project ID (filename, e.g., `my-project`)
   - Enter project name (display name, e.g., `My Project`)
   - Enter description (optional)
   - Add repositories:
     - Enter repository name (e.g., `frontend`)
     - Select repository folder via dialog
     - Enter default branch (e.g., `main`)
     - Choose to add another repository or finish
4. Review and confirm
5. Project configuration will be saved to `~/.config/vscode-multiroot-manager/projects/{projectId}.yaml`

#### Manual Configuration

Alternatively, create project configuration files directly:

```yaml
# ~/.config/vscode-multiroot-manager/projects/my-project.yaml
name: My Project
description: Multi-repo project description

repositories:
  - name: frontend
    path: ~/repos/my-project-frontend
    default_branch: main
  - name: backend
    path: ~/repos/my-project-backend
    default_branch: main

branch_naming:
  pattern: "feature/{issue_id}"
```

### VS Code Settings

Settings can be changed through VS Code UI or settings.json.

#### Through UI (Recommended)

1. Open Settings: `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux)
2. Search for "Multiroot Manager" or "mrm"
3. Modify settings as needed

#### Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mrm.configDir` | `~/.config/vscode-multiroot-manager` | Configuration directory (shared with CLI) |
| `mrm.workspaceDir` | `~/workspaces` | Workspace output directory |
| `mrm.branchNaming.pattern` | `feature/{issue_id}` | Branch naming pattern |
| `mrm.branchNaming.separator` | `-` | Separator for issue IDs (`-`, `_`, or `/`) |
| `mrm.github.defaultOwner` | `""` | Default GitHub owner (Phase 3) |
| `mrm.github.defaultRepo` | `""` | Default GitHub repo (Phase 3) |
| `mrm.gemini.model` | `gemini-2.5-flash` | Gemini AI model (Phase 4) |
| `mrm.gemini.enabled` | `true` | Enable AI features (Phase 4) |

#### Through settings.json

```json
{
  "mrm.configDir": "~/.config/vscode-multiroot-manager",
  "mrm.workspaceDir": "~/workspaces",
  "mrm.branchNaming.pattern": "feature/{issue_id}",
  "mrm.branchNaming.separator": "-"
}
```

## Usage

### Create a Project

1. Click the Multiroot Manager icon in the Activity Bar
2. Click the "New Folder" icon in the toolbar (or run `MRM: Create Project`)
3. Follow the interactive wizard:
   - Enter project ID (used as filename)
   - Enter project name (display name)
   - Optionally enter description
   - Add repositories (name, path, default branch)
4. Project configuration will be saved and appear in the tree view

### View/Edit Project

**Show Project Info (Webview)**
1. Right-click project in tree view → `Show Project Info`
2. Webview panel opens with detailed project information:
   - Project name, description, ID
   - Repository list (name, path, default branch, remote)
   - Issues list with status summary
3. Click **✏️ Edit Project** button to enter edit mode
4. Edit project settings:
   - Update project name and description
   - Modify repository details (name, path, branch, remote)
   - ➕ Add new repositories
   - 🗑️ Remove repositories
5. Click **💾 Save** to apply changes
6. Click **❌ Cancel** to discard changes

**Edit Project YAML (Advanced)**
1. Right-click project in tree view → `Edit Project YAML`
2. Configuration file opens in editor
3. Edit YAML directly for advanced configuration
4. Save file to apply changes
5. Run `MRM: Refresh` to reload configuration

### Create an Issue

1. Click the Multiroot Manager icon in the Activity Bar
2. Run `MRM: Create Issue` from Command Palette
3. Select project
4. Enter issue ID (e.g., `SHOP-123`)
5. Optionally enter title and description
6. Extension will:
   - Create worktrees for each repository
   - Create feature branches
   - Generate `.code-workspace` file
   - Generate `.claude.md` context file

### Open Workspace

- Click "Open Workspace" in the tree view
- Or run `MRM: Open Workspace` and select issue
- New VS Code window opens with all repositories

### Delete Issue

- Right-click issue in tree view → `Delete Issue`
- Choose deletion option:
  - **Keep Branches**: Remove worktrees and workspace files only
  - **Remove Branches**: Delete everything including git branches

## CLI Compatibility

This extension is compatible with the `mrm` CLI tool and shares the same configuration directory (`~/.config/vscode-multiroot-manager/`).

You can use both the extension and CLI tool interchangeably.

## Architecture

- **Config Manager**: Reads YAML configuration files and VS Code settings
- **Git Service**: Manages worktree and branch operations (via `simple-git`)
- **Workspace Service**: Generates `.code-workspace` files
- **State Manager**: Persists issue state in `data/{project}/issues.yaml`
- **Issue Service**: Orchestrates issue creation and deletion
- **TreeView**: Displays projects, issues, and repositories

## Roadmap

### Phase 3: GitHub Integration (Planned)
- Fetch issue metadata from GitHub
- Create pull requests
- Display CI status in tree view

### Phase 4: AI Integration (Planned)
- Gemini-powered code review
- AI-generated PR descriptions

### Phase 5: Polish (Planned)
- Enhanced error handling
- Status refresh automation
- Workspace templates

## Development

### Build

```bash
npm install
npm run build
```

### Debug

Press `F5` to launch Extension Development Host.

### Lint

```bash
npm run lint
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Support

For issues and feature requests, please visit:
https://github.com/yayohei/vscode-multiroot-manager/issues
