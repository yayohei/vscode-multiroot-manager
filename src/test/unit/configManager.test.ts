import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchNaming } from '../../models/types';

// vscode モジュールを ConfigManager のインポート前にモック
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined) // すべての設定を未設定扱い → デフォルト値を使用
    })
  }
}));

import { ConfigManager } from '../../config/configManager';

describe('ConfigManager.generateBranchName', () => {
  let cm: ConfigManager;

  beforeEach(() => {
    cm = new ConfigManager();
  });

  // ─── デフォルト設定での動作 ───────────────────────
  describe('デフォルト設定 (feature/{issue_id}, separator: -)', () => {
    it('基本的なブランチ名を生成する', () => {
      expect(cm.generateBranchName('SHOP-123')).toBe('feature/SHOP-123');
    });

    it('スペースをデフォルトセパレータ (-) で置換する', () => {
      expect(cm.generateBranchName('SHOP 123')).toBe('feature/SHOP-123');
    });

    it('連続するスペースを 1 つのセパレータに置換する', () => {
      expect(cm.generateBranchName('SHOP  123')).toBe('feature/SHOP-123');
    });

    it('タブ文字もセパレータで置換する', () => {
      expect(cm.generateBranchName('SHOP\t123')).toBe('feature/SHOP-123');
    });
  });

  // ─── カスタム branchNaming の適用 ────────────────
  describe('カスタム branchNaming を渡した場合', () => {
    it('カスタムパターンを使用する', () => {
      const naming: BranchNaming = { pattern: 'work/{issue_id}', separator: '-' };
      expect(cm.generateBranchName('SHOP-123', naming)).toBe('work/SHOP-123');
    });

    it('アンダースコアセパレータを使用する', () => {
      const naming: BranchNaming = { pattern: 'feature/{issue_id}', separator: '_' };
      expect(cm.generateBranchName('SHOP 123', naming)).toBe('feature/SHOP_123');
    });

    it('スラッシュセパレータを使用する', () => {
      const naming: BranchNaming = { pattern: '{issue_id}', separator: '/' };
      expect(cm.generateBranchName('SHOP 123', naming)).toBe('SHOP/123');
    });

    it('プレースホルダーなしのパターンはそのまま返す', () => {
      const naming: BranchNaming = { pattern: 'fixed-branch', separator: '-' };
      expect(cm.generateBranchName('SHOP-123', naming)).toBe('fixed-branch');
    });

    it('プレフィックスなしのパターン (issue_id だけ)', () => {
      const naming: BranchNaming = { pattern: '{issue_id}', separator: '-' };
      expect(cm.generateBranchName('SHOP-123', naming)).toBe('SHOP-123');
    });

    it('プロジェクト固有の branchNaming がグローバル設定より優先される', () => {
      const projectNaming: BranchNaming = { pattern: 'hotfix/{issue_id}', separator: '-' };
      expect(cm.generateBranchName('SHOP-123', projectNaming)).toBe('hotfix/SHOP-123');
    });
  });

  // ─── エッジケース ─────────────────────────────────
  describe('エッジケース', () => {
    it('スペースなしの Issue ID はそのまま使われる', () => {
      const naming: BranchNaming = { pattern: 'feature/{issue_id}', separator: '-' };
      expect(cm.generateBranchName('ABC-456', naming)).toBe('feature/ABC-456');
    });

    it('空文字の Issue ID でもクラッシュしない', () => {
      const naming: BranchNaming = { pattern: 'feature/{issue_id}', separator: '-' };
      expect(cm.generateBranchName('', naming)).toBe('feature/');
    });

    it('Issue ID が数字のみでも動作する', () => {
      const naming: BranchNaming = { pattern: 'feature/{issue_id}', separator: '-' };
      expect(cm.generateBranchName('123', naming)).toBe('feature/123');
    });
  });
});
