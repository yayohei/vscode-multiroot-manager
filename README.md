# VS Code Multiroot Manager

Manage multi-repository workspaces per issue/ticket with git worktree support.

## Overview

Work on multiple repositories simultaneously for a single issue. Automatically creates git worktrees, branches, and VS Code workspaces organized by organization and repository structure.

## Features

- **Issue-based Workspaces**: Create workspaces that bundle multiple repositories for a single issue/ticket
- **Git Worktree Integration**: Automatic worktree and branch creation across repositories
- **Organization-aware**: Directory structure reflects GitHub organization hierarchy (`{issue}/{org}/{repo}`)
- **Project Management**: YAML-based configuration for multi-repository projects
- **TreeView**: Browse projects, issues, and repositories in the sidebar
- **CLI Compatible**: Shares configuration with the `mrm` CLI tool

## Installation

Download the latest `.vsix` from [Releases](https://github.com/yayohei/vscode-multiroot-manager/releases) and install:

```bash
code --install-extension vscode-multiroot-manager-*.vsix
```

## Quick Start

1. **Create a Project**: `MRM: Create Project` → Define repositories
2. **Create an Issue**: Right-click project → Create Issue → Enter issue ID
3. **Workspace Opens**: New window with all repositories ready for development

## Directory Structure

```
~/workspaces/{project}/{issue}/
├── 📁 Workspace Root
│   ├── .claude.md              # AI context file
│   └── {issue}.code-workspace  # VS Code workspace
└── {org}/
    └── {repo}/                 # Git worktree
```

## Configuration

Settings are stored in `~/.config/vscode-multiroot-manager/`:
- `config.yaml` - Global configuration
- `projects/*.yaml` - Project definitions
- `data/*/issues.yaml` - Issue state

## Requirements

- VS Code 1.85.0 or higher
- Git with worktree support
- Multi-repository projects

## License

MIT

## Support

For issues and feature requests, please visit:
https://github.com/yayohei/vscode-multiroot-manager/issues
