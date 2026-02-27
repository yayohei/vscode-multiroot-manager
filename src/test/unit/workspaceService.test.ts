import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WorkspaceService } from '../../services/workspaceService';
import { Repository } from '../../models/types';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mrm-ws-test-'));
}

const repos: Repository[] = [
  { name: 'repo-a', path: '/repos/repo-a' },
  { name: 'repo-b', path: '/repos/repo-b' }
];

describe('WorkspaceService', () => {
  let tmpDir: string;
  let ws: WorkspaceService;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    ws = new WorkspaceService();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('generateWorkspace', () => {
    it('creates .code-workspace file', () => {
      ws.generateWorkspace(tmpDir, 'SHOP-123', repos);
      const file = path.join(tmpDir, 'SHOP-123.code-workspace');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('workspace contains workspace root and repo folders', () => {
      ws.generateWorkspace(tmpDir, 'SHOP-123', repos);
      const file = path.join(tmpDir, 'SHOP-123.code-workspace');
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.folders).toHaveLength(3); // root + 2 repos
      expect(content.folders[0].path).toBe('.');
      expect(content.folders[0].name).toBe('📁 Workspace Root');
      expect(content.folders[1].path).toBe('./repo-a');
      expect(content.folders[2].path).toBe('./repo-b');
    });

    it('uses org-aware paths when repoOrgs provided', () => {
      const orgMap = new Map([['repo-a', 'myorg']]);
      ws.generateWorkspace(tmpDir, 'SHOP-123', repos, orgMap);
      const file = path.join(tmpDir, 'SHOP-123.code-workspace');
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.folders[1].path).toBe('./myorg/repo-a');
      expect(content.folders[1].name).toBe('myorg/repo-a');
      expect(content.folders[2].path).toBe('./repo-b');
    });

    it('returns the workspace file path', () => {
      const result = ws.generateWorkspace(tmpDir, 'SHOP-123', repos);
      expect(result).toBe(path.join(tmpDir, 'SHOP-123.code-workspace'));
    });

    it('includes files.exclude settings', () => {
      ws.generateWorkspace(tmpDir, 'SHOP-123', repos);
      const file = path.join(tmpDir, 'SHOP-123.code-workspace');
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.settings?.['files.exclude']?.['**/.git']).toBe(true);
    });

    it('handles empty repos array (only workspace root folder)', () => {
      ws.generateWorkspace(tmpDir, 'SHOP-123', []);
      const file = path.join(tmpDir, 'SHOP-123.code-workspace');
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.folders).toHaveLength(1);
      expect(content.folders[0].path).toBe('.');
    });
  });

  describe('generateClaudeContext', () => {
    it('generates default .claude.md when no templates', () => {
      ws.generateClaudeContext(tmpDir, 'SHOP-123', 'My Issue', 'Some description');
      const file = path.join(tmpDir, '.claude.md');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).toContain('SHOP-123');
      expect(content).toContain('My Issue');
    });

    it('includes description in default .claude.md', () => {
      ws.generateClaudeContext(tmpDir, 'SHOP-123', 'Title', 'My description');
      const content = fs.readFileSync(path.join(tmpDir, '.claude.md'), 'utf-8');
      expect(content).toContain('My description');
    });

    it('copies from template directory when exists', () => {
      const configDir = path.join(tmpDir, 'config');
      const templateDir = path.join(configDir, 'templates', 'my-project');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'TEMPLATE.md'), '# Template Content');

      ws.generateClaudeContext(tmpDir, 'SHOP-123', undefined, undefined, 'my-project', configDir);
      const file = path.join(tmpDir, 'TEMPLATE.md');
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, 'utf-8')).toBe('# Template Content');
    });

    it('copies TemplateEntry file to issue dir', () => {
      const srcFile = path.join(tmpDir, 'src-template.md');
      fs.writeFileSync(srcFile, '# From Template Entry');
      const issueDir = path.join(tmpDir, 'issue');
      fs.mkdirSync(issueDir);

      ws.generateClaudeContext(issueDir, 'SHOP-123', undefined, undefined, undefined, undefined, [
        { src: srcFile, dest: '.claude.md' }
      ]);

      const destFile = path.join(issueDir, '.claude.md');
      expect(fs.existsSync(destFile)).toBe(true);
      expect(fs.readFileSync(destFile, 'utf-8')).toBe('# From Template Entry');
    });

    it('does not overwrite existing files when using TemplateEntry', () => {
      const issueDir = path.join(tmpDir, 'issue');
      fs.mkdirSync(issueDir);
      const existing = path.join(issueDir, '.claude.md');
      fs.writeFileSync(existing, 'ORIGINAL');

      const srcFile = path.join(tmpDir, 'src-template.md');
      fs.writeFileSync(srcFile, 'FROM TEMPLATE');

      ws.generateClaudeContext(issueDir, 'SHOP-123', undefined, undefined, undefined, undefined, [
        { src: srcFile, dest: '.claude.md' }
      ]);

      expect(fs.readFileSync(existing, 'utf-8')).toBe('ORIGINAL');
    });

    it('skips TemplateEntry when src does not exist', () => {
      const issueDir = path.join(tmpDir, 'issue');
      fs.mkdirSync(issueDir);

      expect(() => ws.generateClaudeContext(
        issueDir, 'SHOP-123', undefined, undefined, undefined, undefined,
        [{ src: '/nonexistent/path/file.md', dest: '.claude.md' }]
      )).not.toThrow();
    });
  });

  describe('createIssueDirectory', () => {
    it('creates directory structure and returns path', () => {
      const wsDir = path.join(tmpDir, 'workspaces');
      const result = ws.createIssueDirectory(wsDir, 'my-project', 'SHOP-123');
      expect(result).toBe(path.join(wsDir, 'my-project', 'SHOP-123'));
      expect(fs.existsSync(result)).toBe(true);
    });

    it('does not throw if directory already exists', () => {
      const wsDir = path.join(tmpDir, 'workspaces');
      ws.createIssueDirectory(wsDir, 'my-project', 'SHOP-123');
      expect(() => ws.createIssueDirectory(wsDir, 'my-project', 'SHOP-123')).not.toThrow();
    });
  });

  describe('workspaceExists and getWorkspacePath', () => {
    it('returns false when workspace file does not exist', () => {
      expect(ws.workspaceExists(tmpDir, 'SHOP-123')).toBe(false);
    });

    it('returns true after generating workspace', () => {
      ws.generateWorkspace(tmpDir, 'SHOP-123', repos);
      expect(ws.workspaceExists(tmpDir, 'SHOP-123')).toBe(true);
    });

    it('getWorkspacePath returns expected path', () => {
      const result = ws.getWorkspacePath(tmpDir, 'SHOP-123');
      expect(result).toBe(path.join(tmpDir, 'SHOP-123.code-workspace'));
    });
  });

  describe('removeIssueDirectory', () => {
    it('removes directory recursively', () => {
      const dir = path.join(tmpDir, 'to-remove');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'file.txt'), 'content');
      ws.removeIssueDirectory(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('does not throw when directory does not exist', () => {
      expect(() => ws.removeIssueDirectory(path.join(tmpDir, 'nonexistent'))).not.toThrow();
    });
  });
});
