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
| `mrm pr <id>` | Command: `mrm.createPR` | Context menu / button |
| `mrm review <id>` | Command: `mrm.reviewCode` | Context menu / button |
| `mrm project list` | TreeView: Projects | Top-level tree nodes |
| Delete issue | Command: `mrm.deleteIssue` | Context menu |

## Architecture

### Directory Structure

```
src/
├── extension.ts              # Entry point (activate/deactivate)
├── models/
│   └── types.ts              # Data types (from Go types.go)
├── config/
│   ├── configManager.ts      # YAML config read/write
│   └── paths.ts              # XDG paths, tilde expansion
├── services/
│   ├── gitService.ts         # Git/worktree operations (via simple-git)
│   ├── githubService.ts      # GitHub API (via @octokit/rest)
│   ├── workspaceService.ts   # .code-workspace generation
│   ├── stateManager.ts       # Issue state persistence (YAML)
│   ├── issueService.ts       # Issue creation orchestrator
│   └── prService.ts          # PR creation
├── views/
│   ├── projectTreeProvider.ts  # TreeDataProvider for projects
│   ├── issueTreeProvider.ts    # TreeDataProvider for issues
│   └── issueDetailPanel.ts     # Webview for issue detail (optional)
└── test/
    └── suite/
        └── *.test.ts
```

### Key Dependencies

| Package | Purpose |
|---|---|
| `yaml` | YAML config read/write |
| `simple-git` | Git/worktree operations |
| `@octokit/rest` | GitHub API |
| `glob` | File pattern matching |

### Extension Activation

- **activationEvents**: `onView:mrmProjects`, `onCommand:mrm.*`
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
│   │   ├── frontend   ✓pushed  PR#234 ✅
│   │   ├── backend    ✓pushed  PR#567 ✅
│   │   └── common     ✓pushed  PR#89  ✅
│   ├── SHOP-457 - Fix cart timeout     [active]
│   └── SHOP-458 - Improve search UI   [pr_created]
└── mobile-app (2 repos, 3 issues)
```

### Commands (Command Palette)

| Command ID | Title |
|---|---|
| `mrm.createIssue` | MRM: Create Issue |
| `mrm.openWorkspace` | MRM: Open Workspace |
| `mrm.createPR` | MRM: Create Pull Request |
| `mrm.reviewCode` | MRM: AI Code Review |
| `mrm.deleteIssue` | MRM: Delete Issue |
| `mrm.refreshAll` | MRM: Refresh |
| `mrm.showStatus` | MRM: Show Issue Status |

### Configuration (settings.json)

```jsonc
{
  "mrm.configDir": "~/.config/vscode-multiroot-manager",
  "mrm.workspaceDir": "~/workspaces",
  "mrm.defaultEditor": "code",
  "mrm.branchNaming.pattern": "feature/{issue_id}",
  "mrm.branchNaming.separator": "-",
  "mrm.github.defaultOwner": "",
  "mrm.github.defaultRepo": "",
  "mrm.gemini.model": "gemini-2.5-flash",
  "mrm.gemini.enabled": true
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
3. Input Box: Issue ID or GitHub/Jira URL
4. (Optional) Input Box: Title, Description
5. Background:
   - Fetch issue info (GitHub/Jira API)
   - Create branches (git worktree) in all repos
   - Generate `.code-workspace` file
   - Generate `.claude.md` context files
   - Copy Claude config files to worktrees
   - Save state to `issues.yaml`
6. TreeView refresh
7. Notification: "Issue SHOP-456 created. Open workspace?"

## Status Display

TreeView items show inline:
- Branch status (created/pushed)
- PR status (number, state)
- CI status (success/failure/pending)

## Workspace Generation

Same structure as CLI:
```
~/workspaces/{project}/{issue-id}/
├── {repo-name}/              # git worktree
│   ├── .claude/
│   ├── .claudedoc/
│   └── .claude.md
├── {issue-id}.code-workspace
└── .claude.md
```

## Implementation Phases

### Phase 1: Foundation (Current)
- Project scaffolding
- Type definitions
- Config reading

### Phase 2: Core
- TreeView (projects + issues)
- Issue creation (manual)
- Workspace generation
- Open workspace command

### Phase 3: GitHub Integration
- GitHub Issue fetch
- PR creation
- CI status display

### Phase 4: AI Integration
- Gemini code review
- AI PR description

### Phase 5: Polish
- Delete issue with cleanup options
- Status refresh
- Error handling improvements
