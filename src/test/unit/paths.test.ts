import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  expandTilde,
  getProjectsDir,
  getDataDir,
  getProjectDataDir,
} from '../../config/paths';

describe('expandTilde', () => {
  it('~ 単体をホームディレクトリに展開する', () => {
    expect(expandTilde('~')).toBe(os.homedir());
  });

  it('~/path をホームディレクトリ配下に展開する', () => {
    expect(expandTilde('~/foo/bar')).toBe(path.join(os.homedir(), 'foo/bar'));
  });

  it('絶対パスはそのまま返す', () => {
    expect(expandTilde('/absolute/path')).toBe('/absolute/path');
  });

  it('相対パスはそのまま返す', () => {
    expect(expandTilde('relative/path')).toBe('relative/path');
  });

  it('空文字列はそのまま返す', () => {
    expect(expandTilde('')).toBe('');
  });

  it('~ を含まないパスはそのまま返す', () => {
    expect(expandTilde('/home/user/tilde~in~name')).toBe('/home/user/tilde~in~name');
  });
});

describe('getProjectsDir', () => {
  it('configDir/projects を返す', () => {
    expect(getProjectsDir('/config')).toBe('/config/projects');
  });
});

describe('getDataDir', () => {
  it('configDir/data を返す', () => {
    expect(getDataDir('/config')).toBe('/config/data');
  });
});

describe('getProjectDataDir', () => {
  it('configDir/data/projectId を返す', () => {
    expect(getProjectDataDir('/config', 'my-project')).toBe('/config/data/my-project');
  });

  it('projectId にスラッシュが含まれる場合でも正しく結合する', () => {
    expect(getProjectDataDir('/config', 'org/project')).toBe('/config/data/org/project');
  });
});
