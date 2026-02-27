# Change Log

## [0.1.3] - 2026-02-27

### Added
- Template management: copy files/directories into new issue workspaces
- Template UI in Project Info panel and Edit Project command
- Marketplace icon (128x128 PNG)

### Improved
- Existing branch support: reuse branch when worktree already exists
- Project node click opens Project Info directly
- Hint text added to all form fields in Project Info panel

### Fixed
- Duplicate repository name/path validation on create and edit
- Error handling improvements in Project Info save

### Removed
- Unimplemented configuration settings (`mrm.github.*`, `mrm.gemini.*`)
- Unused `@octokit/rest` dependency

## [0.1.2] - 2026-02-12

### Added
- SVG icon for Activity Bar display

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
