import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from '../../services/gitService';

// Mock simple-git module
vi.mock('simple-git', () => ({
  default: vi.fn()
}));

import simpleGit from 'simple-git';

describe('GitService - getOrgFromRemote (URL parsing)', () => {
  let gitService: GitService;
  const mockGit = { raw: vi.fn() };

  beforeEach(() => {
    gitService = new GitService();
    vi.mocked(simpleGit).mockReturnValue(mockGit as any);
    mockGit.raw.mockReset();
  });

  async function parseUrl(url: string): Promise<string> {
    mockGit.raw.mockResolvedValue(url + '\n');
    return gitService.getOrgFromRemote('/fake/path');
  }

  describe('standard SSH format (git@host:org/repo.git)', () => {
    it('parses GitHub SSH URL', async () => {
      expect(await parseUrl('git@github.com:myorg/myrepo.git')).toBe('myorg');
    });

    it('parses enterprise GitHub SSH URL', async () => {
      expect(await parseUrl('git@github.mycompany.com:enterprise-org/myrepo.git')).toBe('enterprise-org');
    });

    it('parses GitLab SSH URL', async () => {
      expect(await parseUrl('git@gitlab.com:my-group/myrepo.git')).toBe('my-group');
    });
  });

  describe('SSH protocol format (ssh://git@host/org/repo.git)', () => {
    it('parses SSH protocol URL', async () => {
      expect(await parseUrl('ssh://git@github.com/myorg/myrepo.git')).toBe('myorg');
    });

    it('parses SSH protocol URL with port', async () => {
      expect(await parseUrl('ssh://git@github.com:22/myorg/myrepo.git')).toBe('myorg');
    });
  });

  describe('HTTPS format (https://host/org/repo.git)', () => {
    it('parses HTTPS URL', async () => {
      expect(await parseUrl('https://github.com/myorg/myrepo.git')).toBe('myorg');
    });

    it('parses HTTP URL', async () => {
      expect(await parseUrl('http://github.com/myorg/myrepo.git')).toBe('myorg');
    });

    it('parses HTTPS URL without .git suffix', async () => {
      expect(await parseUrl('https://github.com/myorg/myrepo')).toBe('myorg');
    });

    it('parses enterprise HTTPS URL', async () => {
      expect(await parseUrl('https://github.mycompany.com/my-org/myrepo.git')).toBe('my-org');
    });
  });

  describe('error handling', () => {
    it('throws on unrecognized URL format', async () => {
      mockGit.raw.mockResolvedValue('not-a-valid-remote-url\n');
      await expect(gitService.getOrgFromRemote('/fake/path')).rejects.toThrow(
        'Failed to parse org from remote URL'
      );
    });

    it('uses default remote "origin" when not specified', async () => {
      mockGit.raw.mockResolvedValue('git@github.com:myorg/myrepo.git\n');
      await gitService.getOrgFromRemote('/fake/path');
      expect(mockGit.raw).toHaveBeenCalledWith(['remote', 'get-url', 'origin']);
    });

    it('uses specified remote name', async () => {
      mockGit.raw.mockResolvedValue('git@github.com:myorg/myrepo.git\n');
      await gitService.getOrgFromRemote('/fake/path', 'upstream');
      expect(mockGit.raw).toHaveBeenCalledWith(['remote', 'get-url', 'upstream']);
    });
  });
});
