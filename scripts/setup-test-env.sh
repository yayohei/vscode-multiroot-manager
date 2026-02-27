#!/usr/bin/env bash
set -euo pipefail

# Test environment setup for vscode-multiroot-manager
# Creates:
#   ~/tmp/mrm-test-repos/repo-a  (git init + main branch)
#   ~/tmp/mrm-test-repos/repo-b  (git init + main branch)
#   ~/.config/vscode-multiroot-manager/projects/test-project.yaml

REPOS_DIR="${HOME}/tmp/mrm-test-repos"
CONFIG_DIR="${HOME}/.config/vscode-multiroot-manager"
PROJECTS_DIR="${CONFIG_DIR}/projects"

echo "Setting up MRM test environment..."

# Create test repositories
for repo in repo-a repo-b; do
  repo_path="${REPOS_DIR}/${repo}"
  if [ -d "${repo_path}" ]; then
    echo "  [skip] ${repo} already exists"
  else
    mkdir -p "${repo_path}"
    cd "${repo_path}"
    git init
    git checkout -b main
    echo "# ${repo}" > README.md
    git add README.md
    git commit -m "Initial commit"
    echo "  [ok] Created ${repo}"
  fi
done

# Create projects directory
mkdir -p "${PROJECTS_DIR}"

# Create test-project.yaml
cat > "${PROJECTS_DIR}/test-project.yaml" << YAML
name: Test Project
description: Test project for MRM development
repositories:
  - name: repo-a
    path: ${REPOS_DIR}/repo-a
    default_branch: main
    remote: origin
  - name: repo-b
    path: ${REPOS_DIR}/repo-b
    default_branch: main
    remote: origin
YAML

echo "  [ok] Created test-project.yaml"
echo ""
echo "Test environment ready!"
echo "  Repos: ${REPOS_DIR}"
echo "  Config: ${PROJECTS_DIR}/test-project.yaml"
echo ""
echo "Reload VS Code extension and look for 'Test Project' in MRM sidebar."
