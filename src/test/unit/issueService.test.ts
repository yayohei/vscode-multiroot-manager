import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitService } from '../../services/gitService';
import { IssueService } from '../../services/issueService';
import { StateManager } from '../../services/stateManager';
import { ConfigManager } from '../../config/configManager';
import { Project } from '../../models/types';

// GitService の git 操作をすべてモック
vi.mock('../../services/gitService');

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mrm-issue-test-'));
}

const testProject: Project = {
  id: 'test-project',
  name: 'Test Project',
  repositories: [
    { name: 'repo-a', path: '/fake/repo-a', default_branch: 'main', remote: 'origin' }
  ]
};

describe('IssueService', () => {
  let tmpDir: string;
  let stateManager: StateManager;
  let mockConfigManager: Partial<ConfigManager>;
  let issueService: IssueService;
  let mockGit: {
    getOrgFromRemote: ReturnType<typeof vi.fn>;
    isValidRepository: ReturnType<typeof vi.fn>;
    createWorktree: ReturnType<typeof vi.fn>;
    removeWorktree: ReturnType<typeof vi.fn>;
    worktreeExists: ReturnType<typeof vi.fn>;
    branchExists: ReturnType<typeof vi.fn>;
    deleteBranch: ReturnType<typeof vi.fn>;
    getBranchStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tmpDir = makeTmpDir();
    stateManager = new StateManager(tmpDir);

    mockGit = {
      getOrgFromRemote: vi.fn().mockResolvedValue('myorg'),
      isValidRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue(undefined),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      worktreeExists: vi.fn().mockResolvedValue(true),
      branchExists: vi.fn().mockResolvedValue(true),
      deleteBranch: vi.fn().mockResolvedValue(undefined),
      getBranchStatus: vi.fn().mockResolvedValue({ created: true, pushed: false }),
    };
    vi.mocked(GitService).mockImplementation(() => mockGit as unknown as GitService);

    mockConfigManager = {
      loadProject: vi.fn().mockReturnValue(testProject),
      getWorkspaceDir: vi.fn().mockReturnValue(path.join(tmpDir, 'workspaces')),
      getConfigDir: vi.fn().mockReturnValue(tmpDir),
      generateBranchName: vi.fn().mockReturnValue('feature/SHOP-123'),
    };

    issueService = new IssueService(
      mockConfigManager as unknown as ConfigManager,
      stateManager
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // createIssue
  // ─────────────────────────────────────────────
  describe('createIssue', () => {
    it('Issue を作成してステートに保存する', async () => {
      const issue = await issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
        title: 'Test Issue',
        description: 'desc',
      });

      expect(issue.id).toBe('SHOP-123');
      expect(issue.projectId).toBe('test-project');
      expect(issue.status).toBe('active');
      expect(issue.title).toBe('Test Issue');

      const saved = stateManager.getIssue('test-project', 'SHOP-123');
      expect(saved?.id).toBe('SHOP-123');
    });

    it('ワークスペースディレクトリを作成する', async () => {
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-123' });

      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-123');
      expect(fs.existsSync(issueDir)).toBe(true);
    });

    it('.code-workspace ファイルを生成する', async () => {
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-123' });

      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-123');
      expect(fs.existsSync(path.join(issueDir, 'SHOP-123.code-workspace'))).toBe(true);
    });

    it('.claude.md ファイルを生成する', async () => {
      await issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
        title: 'Test Issue',
      });

      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-123');
      expect(fs.existsSync(path.join(issueDir, '.claude.md'))).toBe(true);
    });

    it('各リポジトリに createWorktree を呼ぶ', async () => {
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-123' });

      expect(mockGit.createWorktree).toHaveBeenCalledTimes(1);
      expect(mockGit.createWorktree).toHaveBeenCalledWith(
        '/fake/repo-a',
        expect.stringContaining('SHOP-123'),
        'feature/SHOP-123',
        'main'
      );
    });

    it('org を含む worktreePath で RepoState を記録する', async () => {
      const issue = await issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
      });

      expect(issue.repos).toHaveLength(1);
      expect(issue.repos[0].name).toBe('repo-a');
      expect(issue.repos[0].branch).toBe('feature/SHOP-123');
      expect(issue.repos[0].worktreePath).toContain('myorg');
      expect(issue.repos[0].worktreePath).toContain('repo-a');
    });

    it('プロジェクトが存在しない場合は例外を投げる', async () => {
      (mockConfigManager.loadProject as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      await expect(issueService.createIssue({
        projectId: 'nonexistent',
        issueId: 'SHOP-123',
      })).rejects.toThrow('Project not found');
    });

    it('同一 Issue が既に存在する場合は例外を投げる', async () => {
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-123' });

      await expect(issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
      })).rejects.toThrow('Issue already exists');
    });

    it('リポジトリパスが無効な場合は例外を投げる', async () => {
      mockGit.isValidRepository.mockResolvedValue(false);

      await expect(issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
      })).rejects.toThrow('Invalid repository');
    });

    it('worktree 作成失敗時にディレクトリをロールバックする', async () => {
      mockGit.createWorktree.mockRejectedValueOnce(new Error('git error'));

      await expect(issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
      })).rejects.toThrow('git error');

      // Issue ディレクトリが削除されている
      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-123');
      expect(fs.existsSync(issueDir)).toBe(false);

      // ステートに保存されていない
      expect(stateManager.getIssue('test-project', 'SHOP-123')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // deleteIssue
  // ─────────────────────────────────────────────
  describe('deleteIssue', () => {
    beforeEach(async () => {
      await issueService.createIssue({
        projectId: 'test-project',
        issueId: 'SHOP-123',
        title: 'Test Issue',
      });
    });

    it('ステートから Issue を削除する', async () => {
      await issueService.deleteIssue('test-project', 'SHOP-123');
      expect(stateManager.getIssue('test-project', 'SHOP-123')).toBeUndefined();
    });

    it('ワークスペースディレクトリを削除する', async () => {
      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-123');
      expect(fs.existsSync(issueDir)).toBe(true);

      await issueService.deleteIssue('test-project', 'SHOP-123');
      expect(fs.existsSync(issueDir)).toBe(false);
    });

    it('各リポジトリで removeWorktree を呼ぶ', async () => {
      await issueService.deleteIssue('test-project', 'SHOP-123');
      expect(mockGit.removeWorktree).toHaveBeenCalledTimes(1);
    });

    it('デフォルトではブランチを削除しない', async () => {
      await issueService.deleteIssue('test-project', 'SHOP-123');
      expect(mockGit.deleteBranch).not.toHaveBeenCalled();
    });

    it('deleteBranches: true のときブランチを削除する', async () => {
      await issueService.deleteIssue('test-project', 'SHOP-123', { deleteBranches: true });
      expect(mockGit.deleteBranch).toHaveBeenCalledTimes(1);
    });

    it('worktree が存在しない場合は removeWorktree をスキップする', async () => {
      mockGit.worktreeExists.mockResolvedValue(false);
      await issueService.deleteIssue('test-project', 'SHOP-123');
      expect(mockGit.removeWorktree).not.toHaveBeenCalled();
    });

    it('deleteBranches: true でブランチが存在しない場合は deleteBranch をスキップする', async () => {
      mockGit.branchExists.mockResolvedValue(false);
      await issueService.deleteIssue('test-project', 'SHOP-123', { deleteBranches: true });
      expect(mockGit.deleteBranch).not.toHaveBeenCalled();
    });

    it('Issue が存在しない場合は例外を投げる', async () => {
      await expect(issueService.deleteIssue('test-project', 'NONEXISTENT'))
        .rejects.toThrow('Issue not found');
    });

    it('プロジェクトが見つからない場合は例外を投げる', async () => {
      (mockConfigManager.loadProject as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      await expect(issueService.deleteIssue('test-project', 'SHOP-123'))
        .rejects.toThrow('Project not found');
    });

    it('1 リポジトリのクリーンアップが失敗しても他のリポジトリを継続する', async () => {
      // 2 リポジトリを持つ Issue をステートに直接作成
      const twoRepoProject: Project = {
        ...testProject,
        repositories: [
          { name: 'repo-a', path: '/fake/repo-a', default_branch: 'main', remote: 'origin' },
          { name: 'repo-b', path: '/fake/repo-b', default_branch: 'main', remote: 'origin' }
        ]
      };
      (mockConfigManager.loadProject as ReturnType<typeof vi.fn>).mockReturnValue(twoRepoProject);

      const issueDir = path.join(tmpDir, 'workspaces', 'test-project', 'SHOP-456');
      stateManager.saveIssue('test-project', {
        id: 'SHOP-456',
        projectId: 'test-project',
        status: 'active',
        workspaceDir: issueDir,
        repos: [
          { name: 'repo-a', branch: 'feature/SHOP-456', worktreePath: '/fake/wt-a', created: true, pushed: false },
          { name: 'repo-b', branch: 'feature/SHOP-456', worktreePath: '/fake/wt-b', created: true, pushed: false }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 1 つ目の removeWorktree だけ失敗させる
      mockGit.removeWorktree
        .mockRejectedValueOnce(new Error('cleanup fail'))
        .mockResolvedValue(undefined);

      // 例外を投げない
      await expect(issueService.deleteIssue('test-project', 'SHOP-456')).resolves.not.toThrow();

      // 2 リポジトリ分の removeWorktree が呼ばれた
      expect(mockGit.removeWorktree).toHaveBeenCalledTimes(2);

      // ステートから削除されている
      expect(stateManager.getIssue('test-project', 'SHOP-456')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // getIssue / listIssues
  // ─────────────────────────────────────────────
  describe('getIssue', () => {
    it('存在しない Issue は undefined を返す', () => {
      expect(issueService.getIssue('test-project', 'SHOP-999')).toBeUndefined();
    });

    it('作成後に Issue を返す', async () => {
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-123' });
      expect(issueService.getIssue('test-project', 'SHOP-123')?.id).toBe('SHOP-123');
    });
  });

  describe('listIssues', () => {
    it('Issue なしは空配列を返す', () => {
      expect(issueService.listIssues('test-project')).toEqual([]);
    });

    it('作成した Issue がすべて返る', async () => {
      (mockConfigManager.generateBranchName as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce('feature/SHOP-001')
        .mockReturnValueOnce('feature/SHOP-002');

      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-001' });
      await issueService.createIssue({ projectId: 'test-project', issueId: 'SHOP-002' });

      expect(issueService.listIssues('test-project')).toHaveLength(2);
    });
  });
});
