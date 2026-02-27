import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';
import { StateManager } from '../../services/stateManager';
import { Issue } from '../../models/types';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mrm-state-test-'));
}

function makeIssue(id: string, projectId: string = 'test-project'): Issue {
  return {
    id,
    title: `Issue ${id}`,
    projectId,
    status: 'active',
    workspaceDir: `/workspaces/${projectId}/${id}`,
    repos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

describe('StateManager', () => {
  let tmpDir: string;
  let sm: StateManager;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    sm = new StateManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadIssues', () => {
    it('returns empty array when no issues file exists', () => {
      expect(sm.loadIssues('no-project')).toEqual([]);
    });

    it('returns empty array when file has no issues key', () => {
      const dataDir = path.join(tmpDir, 'data', 'test-project');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'issues.yaml'), 'something: else\n');
      expect(sm.loadIssues('test-project')).toEqual([]);
    });

    it('returns empty array when issues is not an array', () => {
      const dataDir = path.join(tmpDir, 'data', 'test-project');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'issues.yaml'), 'issues: null\n');
      expect(sm.loadIssues('test-project')).toEqual([]);
    });

    it('loads issues from YAML file', () => {
      const issue = makeIssue('SHOP-001');
      sm.saveIssue('test-project', issue);
      const loaded = sm.loadIssues('test-project');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('SHOP-001');
    });

    it('filters out null issues (missing id)', () => {
      const dataDir = path.join(tmpDir, 'data', 'test-project');
      fs.mkdirSync(dataDir, { recursive: true });
      const data = { issues: [{ title: 'No ID issue' }, { id: 'SHOP-001', projectId: 'test-project', status: 'active', workspaceDir: '', repos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
      fs.writeFileSync(path.join(dataDir, 'issues.yaml'), yaml.stringify(data));
      const loaded = sm.loadIssues('test-project');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('SHOP-001');
    });
  });

  describe('saveIssue', () => {
    it('creates data directory and issues.yaml if not exist', () => {
      sm.saveIssue('test-project', makeIssue('SHOP-001'));
      const issuesFile = path.join(tmpDir, 'data', 'test-project', 'issues.yaml');
      expect(fs.existsSync(issuesFile)).toBe(true);
    });

    it('adds new issue to existing issues', () => {
      sm.saveIssue('test-project', makeIssue('SHOP-001'));
      sm.saveIssue('test-project', makeIssue('SHOP-002'));
      const issues = sm.loadIssues('test-project');
      expect(issues).toHaveLength(2);
    });

    it('updates existing issue with same ID', () => {
      const issue = makeIssue('SHOP-001');
      sm.saveIssue('test-project', issue);
      const updated = { ...issue, title: 'Updated Title', status: 'pr_created' as const };
      sm.saveIssue('test-project', updated);
      const issues = sm.loadIssues('test-project');
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe('Updated Title');
      expect(issues[0].status).toBe('pr_created');
    });

    it('sorts issues by createdAt descending', () => {
      const older = { ...makeIssue('SHOP-001'), createdAt: '2024-01-01T00:00:00.000Z' };
      const newer = { ...makeIssue('SHOP-002'), createdAt: '2024-06-01T00:00:00.000Z' };
      sm.saveIssue('test-project', older);
      sm.saveIssue('test-project', newer);
      const issues = sm.loadIssues('test-project');
      expect(issues[0].id).toBe('SHOP-002');
      expect(issues[1].id).toBe('SHOP-001');
    });
  });

  describe('deleteIssue', () => {
    it('removes issue by ID', () => {
      sm.saveIssue('test-project', makeIssue('SHOP-001'));
      sm.saveIssue('test-project', makeIssue('SHOP-002'));
      sm.deleteIssue('test-project', 'SHOP-001');
      const issues = sm.loadIssues('test-project');
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('SHOP-002');
    });

    it('does not throw when issue does not exist', () => {
      sm.saveIssue('test-project', makeIssue('SHOP-001'));
      expect(() => sm.deleteIssue('test-project', 'NONEXISTENT')).not.toThrow();
      expect(sm.loadIssues('test-project')).toHaveLength(1);
    });
  });

  describe('getIssue', () => {
    it('returns undefined for unknown issue', () => {
      expect(sm.getIssue('test-project', 'SHOP-999')).toBeUndefined();
    });

    it('returns the correct issue', () => {
      sm.saveIssue('test-project', makeIssue('SHOP-001'));
      sm.saveIssue('test-project', makeIssue('SHOP-002'));
      const issue = sm.getIssue('test-project', 'SHOP-001');
      expect(issue?.id).toBe('SHOP-001');
    });
  });

  describe('YAML normalization (CLI format)', () => {
    it('handles CLI format with workspace.path', () => {
      const dataDir = path.join(tmpDir, 'data', 'test-project');
      fs.mkdirSync(dataDir, { recursive: true });
      const cliFormat = {
        issues: [{
          id: 'SHOP-CLI',
          title: 'CLI Issue',
          project_id: 'test-project',
          status: 'active',
          workspace: { path: '/workspaces/test-project/SHOP-CLI/SHOP-CLI.code-workspace' },
          repositories: [
            { name: 'repo-a', branch: 'feature/SHOP-CLI', created: true, pushed: false }
          ],
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }]
      };
      fs.writeFileSync(path.join(dataDir, 'issues.yaml'), yaml.stringify(cliFormat));

      const issues = sm.loadIssues('test-project');
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('SHOP-CLI');
      expect(issues[0].projectId).toBe('test-project');
      expect(issues[0].workspaceDir).toBe('/workspaces/test-project/SHOP-CLI');
    });

    it('normalizes repos from repositories array (CLI format)', () => {
      const dataDir = path.join(tmpDir, 'data', 'test-project');
      fs.mkdirSync(dataDir, { recursive: true });
      const cliFormat = {
        issues: [{
          id: 'SHOP-CLI',
          project_id: 'test-project',
          status: 'active',
          workspaceDir: '/workspaces/test-project/SHOP-CLI',
          repositories: [
            { name: 'repo-a', branch: 'feature/SHOP-CLI', worktreePath: '/workspaces/test-project/SHOP-CLI/repo-a', created: true, pushed: false }
          ],
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }]
      };
      fs.writeFileSync(path.join(dataDir, 'issues.yaml'), yaml.stringify(cliFormat));

      const issues = sm.loadIssues('test-project');
      expect(issues[0].repos).toHaveLength(1);
      expect(issues[0].repos[0].name).toBe('repo-a');
      expect(issues[0].repos[0].branch).toBe('feature/SHOP-CLI');
      expect(issues[0].repos[0].created).toBe(true);
    });
  });
});
