#!/usr/bin/env bash
set -euo pipefail

# Reset MRM test environment
# Removes worktrees, feature branches, issue data, and workspace dirs

REPOS_DIR="${HOME}/tmp/mrm-test-repos"
CONFIG_DIR="${HOME}/.config/vscode-multiroot-manager"
WORKSPACE_DIR="${HOME}/workspaces/test-project"

echo "Resetting MRM test environment..."

# Remove worktrees and feature branches from test repos
for repo in repo-a repo-b; do
  repo_path="${REPOS_DIR}/${repo}"
  if [ ! -d "${repo_path}" ]; then
    continue
  fi

  cd "${repo_path}"

  # List and remove non-main worktrees
  worktrees=$(git worktree list --porcelain | grep '^worktree ' | awk '{print $2}' | grep -v "^${repo_path}$" || true)
  for wt in ${worktrees}; do
    echo "  Removing worktree: ${wt}"
    git worktree remove "${wt}" --force 2>/dev/null || true
  done

  # Delete feature/* branches
  feature_branches=$(git branch | grep 'feature/' || true)
  for branch in ${feature_branches}; do
    echo "  Deleting branch: ${branch}"
    git branch -D "${branch}" 2>/dev/null || true
  done
done

# Remove issue state
issues_file="${CONFIG_DIR}/data/test-project/issues.yaml"
if [ -f "${issues_file}" ]; then
  rm "${issues_file}"
  echo "  [ok] Removed issues.yaml"
fi

# Remove workspace directory
if [ -d "${WORKSPACE_DIR}" ]; then
  rm -rf "${WORKSPACE_DIR}"
  echo "  [ok] Removed workspace directory: ${WORKSPACE_DIR}"
fi

echo ""
echo "Test environment reset complete."
echo "  Repos are clean (main branch only)"
echo "  No active issues"
