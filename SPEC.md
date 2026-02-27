# VSCode Multiroot Manager Extension - Specification

## Overview

Go CLI tool `mrm` (vscode-multiroot-manager) の機能を VSCode Extension としてネイティブに提供する。
複数リポジトリを横断する Issue 開発を VSCode 内で完結させる。

## CLI → Extension Feature Mapping

| CLI Command | Extension Equivalent | UI Element |
|---|---|---|
| `mrm` (TUI) | Extension TreeView + Commands | Sidebar Activity Bar |
| `mrm init` | Auto-detect on activation | Configuration check |
| `mrm create <id>` | Command: `mrm.createIssue` | Input box / Quick pick |
| `mrm list` | TreeView: Issues | Sidebar panel |
| `mrm status <id>` | TreeView: Issue detail | Expandable tree node |
| `mrm open <id>` | Command: `mrm.openWorkspace` | Tree item click |
| `mrm project list` | TreeView: Projects | Top-level tree nodes |
| Delete issue | Command: `mrm.deleteIssue` | Context menu |

## Architecture

### Directory Structure

```
src/
├── extension.ts              # Entry point (activate/deactivate)
├── models/
│   └── types.ts              # Data types
├── config/
│   ├── configManager.ts      # YAML config read/write
│   └── paths.ts              # XDG paths, tilde expansion
├── services/
│   ├── gitService.ts         # Git/worktree operations (via simple-git)
│   ├── workspaceService.ts   # .code-workspace generation + template copy
│   ├── stateManager.ts       # Issue state persistence (YAML)
│   ├── issueService.ts       # Issue creation orchestrator
│   └── projectManager.ts     # Project YAML management
├── commands/
│   └── createProjectCommand.ts  # Interactive project creation wizard
├── views/
│   └── projectTreeProvider.ts   # TreeDataProvider: Project/Issue/Repo
├── statusBar/
│   └── statusBarManager.ts      # Current issue display in status bar
└── test/
    └── suite/
        └── *.test.ts
```

### Key Dependencies

| Package | Purpose |
|---|---|
| `yaml` | YAML config read/write |
| `simple-git` | Git/worktree operations |

### Extension Activation

- **activationEvents**: `onView:mrmProjects`
- On activation: validate config directory exists, load projects

## UI Design

### Activity Bar

- Icon: multi-folder icon in activity bar
- View container: `mrm-explorer`

### Sidebar TreeView

```
MRM: Projects
├── web-app (3 repos, 5 issues)
│   ├── SHOP-456 - Add payment retry   [active]
│   │   ├── frontend
│   │   ├── backend
│   │   └── common
│   └── SHOP-457 - Fix cart timeout    [active]
└── mobile-app (2 repos, 3 issues)
```

### Commands (Command Palette)

| Command ID | Title |
|---|---|
| `mrm.createProject` | MRM: Create Project |
| `mrm.showProjectInfo` | MRM: Show Project Info |
| `mrm.editProject` | MRM: Edit Project YAML |
| `mrm.createIssue` | MRM: Create Issue |
| `mrm.openWorkspace` | MRM: Open Workspace |
| `mrm.switchIssue` | MRM: Switch Issue |
| `mrm.deleteIssue` | MRM: Delete Issue |
| `mrm.refreshAll` | MRM: Refresh |
| `mrm.showStatus` | MRM: Show Issue Status |

### Configuration (settings.json)

```jsonc
{
  "mrm.configDir": "~/.config/vscode-multiroot-manager",
  "mrm.workspaceDir": "~/workspaces",
  "mrm.branchNaming.pattern": "feature/{issue_id}",
  "mrm.branchNaming.separator": "-"
}
```

## Config Compatibility

既存の `~/.config/vscode-multiroot-manager/` を共有する:
- `config.yaml` — Extension settings に fallback
- `projects/*.yaml` — そのまま読み取り
- `data/*/issues.yaml` — そのまま読み書き

CLI と Extension が同じ設定・データを参照し、併用可能。

## Issue Creation Flow

1. Command Palette → `MRM: Create Issue`
2. Quick Pick: Select project
3. Input Box: Issue ID
4. (Optional) Input Box: Title, Description
5. Background:
   - Create branches (git worktree) in all repos
   - Generate `.code-workspace` file
   - Copy template files (project templates → default template dir → `.claude.md`)
   - Save state to `issues.yaml`
6. TreeView refresh
7. Notification: "Issue SHOP-456 created. Open workspace?"

## Template System

Issue作成時にファイル/ディレクトリをワークスペースにコピーする仕組み:

**優先順位:**
1. `projects/*.yaml` の `templates:` フィールド（GUI または YAML で設定）
2. `~/.config/vscode-multiroot-manager/templates/{project}/` ディレクトリ
3. デフォルト: `.claude.md` を自動生成

## Workspace Generation

```
~/workspaces/{project}/{issue-id}/
├── {repo-name}/              # git worktree
│   └── ...
├── {issue-id}.code-workspace
└── .claude.md                # or template files
```

## Implementation Status

### ✅ Phase 1: Foundation
- Project scaffolding
- Type definitions
- Config reading

### ✅ Phase 2: Core
- TreeView (projects + issues + repos)
- Project creation wizard
- Issue creation / deletion
- Workspace generation
- Template file copy
- Open / switch workspace commands
- Status bar integration
- Project Info webview (view + edit)
