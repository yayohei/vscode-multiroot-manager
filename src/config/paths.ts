/**
 * Path utilities for config directory and workspace directory
 */

import * as os from 'os';
import * as path from 'path';

/**
 * Expand tilde (~) to home directory
 */
export function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Get config directory path (XDG-compatible)
 * Default: ~/.config/vscode-multiroot-manager
 */
export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'vscode-multiroot-manager');
  }
  return path.join(os.homedir(), '.config', 'vscode-multiroot-manager');
}

/**
 * Get workspace directory path
 * Default: ~/workspaces
 */
export function getWorkspaceDir(): string {
  return path.join(os.homedir(), 'workspaces');
}

/**
 * Get projects directory path
 */
export function getProjectsDir(configDir: string): string {
  return path.join(configDir, 'projects');
}

/**
 * Get data directory path
 */
export function getDataDir(configDir: string): string {
  return path.join(configDir, 'data');
}

/**
 * Get project-specific data directory
 */
export function getProjectDataDir(configDir: string, projectId: string): string {
  return path.join(getDataDir(configDir), projectId);
}
