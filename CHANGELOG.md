# Change Log

## [0.1.1] - 2026-02-12

### Improved
- **Workspace structure enhancement**: Added workspace root folder for better visibility
- **Organization display**: Show org name in folder names (e.g., `org/repo`)
- **Relative paths**: Use relative paths in `.code-workspace` for better portability

### Changed
- `.code-workspace` now includes workspace root (`.`) as first folder
- Folder names show full `org/repo` path instead of just repo name
- Folder paths are now relative (`./org/repo`) instead of absolute

## [0.1.0] - 2026-02-12

### Added
- Initial release
- Project management with YAML configuration
- Issue creation with git worktree support
- Multi-repository workspace generation
- Organization-aware directory structure (org/repo hierarchy)
- GitHub integration foundation
- Status bar integration
- TreeView for projects/issues/repositories
- CLI compatibility (shared config directory)

### Features
- Create and manage projects
- Create issues with automatic worktree and branch creation
- Delete issues with cleanup
- Switch between issue workspaces
- Open workspace in new window
- Refresh project tree

### Technical
- Support for SSH (ssh://, git@) and HTTPS remote URLs
- Auto-detection of organization from git remote
- Compatible with Go CLI tool `mrm`
