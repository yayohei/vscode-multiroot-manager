# Change Log

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
