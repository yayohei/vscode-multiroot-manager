import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';
import { ProjectManager } from '../../services/projectManager';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mrm-pm-test-'));
}

describe('ProjectManager', () => {
  let tmpDir: string;
  let pm: ProjectManager;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    pm = new ProjectManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('projectExists', () => {
    it('returns false for non-existent project', () => {
      expect(pm.projectExists('no-such-project')).toBe(false);
    });

    it('returns true after creating a project', () => {
      pm.createProject({ id: 'foo', name: 'Foo', repositories: [] });
      expect(pm.projectExists('foo')).toBe(true);
    });
  });

  describe('createProject', () => {
    it('creates YAML file with correct content', () => {
      pm.createProject({
        id: 'my-project',
        name: 'My Project',
        description: 'Test project',
        repositories: [
          { name: 'repo-a', path: '/tmp/repo-a', defaultBranch: 'main' }
        ]
      });

      const file = path.join(tmpDir, 'projects', 'my-project.yaml');
      expect(fs.existsSync(file)).toBe(true);

      const content = yaml.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.name).toBe('My Project');
      expect(content.description).toBe('Test project');
      expect(content.repositories).toHaveLength(1);
      expect(content.repositories[0].name).toBe('repo-a');
      expect(content.repositories[0].default_branch).toBe('main');
    });

    it('uses "main" as default branch when not specified', () => {
      pm.createProject({
        id: 'proj',
        name: 'Proj',
        repositories: [{ name: 'repo', path: '/tmp/repo' }]
      });

      const file = path.join(tmpDir, 'projects', 'proj.yaml');
      const content = yaml.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.repositories[0].default_branch).toBe('main');
    });

    it('throws when project ID already exists', () => {
      pm.createProject({ id: 'dup', name: 'Dup', repositories: [] });
      expect(() => pm.createProject({ id: 'dup', name: 'Dup2', repositories: [] }))
        .toThrow('already exists');
    });

    it('throws on duplicate repository names', () => {
      expect(() => pm.createProject({
        id: 'proj',
        name: 'Proj',
        repositories: [
          { name: 'repo', path: '/a' },
          { name: 'repo', path: '/b' }
        ]
      })).toThrow('Duplicate repository name');
    });

    it('throws on duplicate repository paths', () => {
      expect(() => pm.createProject({
        id: 'proj',
        name: 'Proj',
        repositories: [
          { name: 'repo-a', path: '/same' },
          { name: 'repo-b', path: '/same' }
        ]
      })).toThrow('Duplicate repository path');
    });

    it('creates projects directory if it does not exist', () => {
      const projectsDir = path.join(tmpDir, 'projects');
      expect(fs.existsSync(projectsDir)).toBe(false);
      pm.createProject({ id: 'x', name: 'X', repositories: [] });
      expect(fs.existsSync(projectsDir)).toBe(true);
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      pm.createProject({
        id: 'update-me',
        name: 'Original Name',
        repositories: []
      });
    });

    it('updates project name', () => {
      pm.updateProject('update-me', { name: 'New Name' });
      const file = path.join(tmpDir, 'projects', 'update-me.yaml');
      const content = yaml.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.name).toBe('New Name');
    });

    it('updates description', () => {
      pm.updateProject('update-me', { description: 'New desc' });
      const file = path.join(tmpDir, 'projects', 'update-me.yaml');
      const content = yaml.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.description).toBe('New desc');
    });

    it('throws when project does not exist', () => {
      expect(() => pm.updateProject('ghost', { name: 'Ghost' }))
        .toThrow('not found');
    });

    it('throws on duplicate repository names during update', () => {
      expect(() => pm.updateProject('update-me', {
        repositories: [
          { name: 'repo', path: '/a' },
          { name: 'repo', path: '/b' }
        ]
      })).toThrow('Duplicate repository name');
    });
  });

  describe('deleteProject', () => {
    it('removes the YAML file', () => {
      pm.createProject({ id: 'del-me', name: 'Del Me', repositories: [] });
      pm.deleteProject('del-me');
      const file = path.join(tmpDir, 'projects', 'del-me.yaml');
      expect(fs.existsSync(file)).toBe(false);
    });

    it('throws when project does not exist', () => {
      expect(() => pm.deleteProject('ghost')).toThrow('not found');
    });
  });

  describe('getProjectFilePath', () => {
    it('returns expected path', () => {
      const filePath = pm.getProjectFilePath('my-proj');
      expect(filePath).toBe(path.join(tmpDir, 'projects', 'my-proj.yaml'));
    });
  });
});
