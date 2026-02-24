/**
 * Type definitions for vscode-multiroot-manager
 * Core types for Issue creation/deletion workflow
 */

// --- Configuration Types ---

export interface BranchNaming {
  pattern: string; // e.g., "feature/{issue_id}"
  separator: string; // e.g., "-"
}

export interface Config {
  configDir: string;
  workspaceDir: string;
  branchNaming: BranchNaming;
  github?: {
    defaultOwner?: string;
    defaultRepo?: string;
  };
  gemini?: {
    model: string;
    enabled: boolean;
  };
}

// --- Project Types ---

export interface Repository {
  name: string;
  path: string; // Absolute path to repository
  default_branch?: string; // Default: "main"
  remote?: string; // Default: "origin"
}

export interface Project {
  id: string; // Project directory name
  name: string;
  description?: string;
  repositories: Repository[];
  branchNaming?: BranchNaming; // Override global branch naming
}

// --- Issue State Types ---

export type IssueStatus = "active" | "pr_created" | "merged" | "closed";

export interface RepoState {
  name: string;
  branch: string;
  worktreePath: string;
  created: boolean;
  pushed: boolean;
}

export interface Issue {
  id: string; // Issue ID (e.g., "SHOP-123")
  title?: string;
  description?: string;
  projectId: string;
  status: IssueStatus;
  workspaceDir: string; // e.g., ~/workspaces/web-app/SHOP-123
  repos: RepoState[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface IssuesData {
  issues: Issue[];
}

// --- Operation Options ---

export interface CreateIssueOptions {
  projectId: string;
  issueId: string;
  title?: string;
  description?: string;
}

export interface DeleteIssueOptions {
  deleteBranches?: boolean; // Delete git branches (default: false)
  force?: boolean; // Force delete without confirmation
}

// --- TreeView Types ---

export type TreeItemType = "project" | "issue" | "repo";

export interface TreeItemContext {
  type: TreeItemType;
  projectId?: string;
  issueId?: string;
  repoName?: string;
}
