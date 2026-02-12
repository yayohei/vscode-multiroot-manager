# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code Extension版の `mrm` (vscode-multiroot-manager)。複数リポジトリを横断するIssue開発をVS Code内で完結させる拡張機能。
Go CLI ツール `mrm` と同じ設定ディレクトリ (`~/.config/vscode-multiroot-manager/`) を共有し、CLIと併用可能。

## Build & Development Commands

```bash
npm run build          # esbuild で本番ビルド (→ dist/extension.js)
npm run watch          # esbuild watch モード
npm run lint           # eslint src --ext ts
npm test               # vscode-test (VS Code 統合テスト)
```

ビルドシステムは esbuild (`esbuild.js`) を使用。エントリポイントは `./dist/extension.js`。

## Architecture

### レイヤー構成

```
src/
├── extension.ts           # activate/deactivate エントリポイント
├── models/types.ts        # データ型定義 (Go types.go からの移植)
├── config/                # YAML設定読み書き、XDGパス解決
├── commands/              # コマンド実装
│   └── createProjectCommand.ts  # プロジェクト作成ウィザード
├── services/              # ビジネスロジック層
│   ├── gitService.ts      # git worktree 操作 (simple-git)
│   ├── githubService.ts   # GitHub API (@octokit/rest)
│   ├── workspaceService.ts # .code-workspace ファイル生成
│   ├── stateManager.ts    # Issue状態永続化 (YAML)
│   ├── issueService.ts    # Issue作成オーケストレーター
│   ├── projectManager.ts  # Project設定ファイル管理
│   └── prService.ts       # PR作成
├── statusBar/             # StatusBarItem (ステータスバー表示)
│   └── statusBarManager.ts # 現在のIssue表示
├── views/                 # TreeDataProvider (サイドバーUI)
│   └── projectTreeProvider.ts  # Project/Issue/Repoツリー
└── test/suite/            # VS Code 統合テスト
```

### 主要パターン

- **Service層分離**: git, GitHub, config, state, project管理は独立したサービスクラス
- **TreeDataProvider**: Project → Issue → Repo の階層ツリー表示
- **StatusBar統合**: 現在のIssueをステータスバーに表示（workspace pathから自動検出）
- **CLI互換**: `config.yaml`, `projects/*.yaml`, `data/*/issues.yaml` をCLIと共有
- **コマンド体系**: すべて `mrm.*` プレフィックス
  - 実装済み: `createProject`, `createIssue`, `openWorkspace`, `switchIssue`, `deleteIssue`, `refreshAll`, `showStatus`
  - 未実装（Phase 3以降）: `createPR`, `reviewCode`

### VS Code API

- View Container: `mrm-explorer` (Activity Bar)
- View: `mrmProjects` (サイドバーTreeView)
- Activation: `onView:mrmProjects`
- Configuration: `mrm.*` namespace で設定項目を提供

### 主要依存ライブラリ

| パッケージ | 用途 |
|---|---|
| `simple-git` | git/worktree操作 |
| `@octokit/rest` | GitHub API |
| `yaml` | YAML設定ファイル読み書き |

## VS Code Extension の制約と実装方針

### ✅ できること（制約ほぼなし）

VS Code ExtensionはNode.js APIフルアクセスが可能。以下すべて実装可能：

1. **ワークスペース外ファイルアクセス**: `~/.config/`, `~/workspaces/` への読み書き自由
2. **Git操作**: `simple-git` で任意ディレクトリのworktree/branch操作
3. **外部API呼び出し**: GitHub API制限なし
4. **外部プロセス実行**: シェルコマンド実行可能

### 重要な設計判断

**グローバルビュー戦略**
- Extension起動時に `~/.config/vscode-multiroot-manager/` から全プロジェクト読み込み
- TreeViewは現在のworkspaceに関係なく、全Issue表示
- 状態は `data/{project}/issues.yaml` にファイルシステム永続化（CLI互換）

**Workspace切り替え戦略**
- Issue作成時は `.code-workspace` を新Windowで開く（`forceNewWindow: true`）
- これはCLI `mrm open <id>` と同じUX
- Extension stateはファイルに永続化されるため、window切り替えで問題なし

**データフロー**
```
Extension起動（どのworkspaceでも）
  ↓
~/.config/vscode-multiroot-manager/ 読み込み
  ↓
TreeViewで全Project/Issue表示（グローバル）
  ↓
Issue作成コマンド
  ↓
各repoに worktree + branch 作成
  ↓
.code-workspace ファイル生成
  ↓
新Windowでworkspace開く
```

## Implementation Phases

**優先順位: コア機能を最初に完全実装**

### Phase 1: Foundation (現在)
- TypeScript設定 (tsconfig.json, esbuild.js, .eslintrc.json)
- 型定義 (models/types.ts)
- Config読み込み (config/)

### Phase 2: Core - Project/Issue作成・削除（✅ 実装済み）

**Project作成フロー** (Interactive Wizard):
1. ユーザーが `MRM: Create Project` コマンド実行
2. Quick Pick ウィザードで入力:
   - Project ID (ファイル名、バリデーション付き)
   - Project name (表示名)
   - Description (オプション)
   - Repositories（繰り返し追加）:
     - Repository name
     - Repository path（フォルダ選択ダイアログ）
     - Default branch
3. `~/.config/vscode-multiroot-manager/projects/{projectId}.yaml` に保存
4. TreeView自動更新

**Issue作成フロー**:
1. ユーザーがProject選択、Issue ID入力
2. 各リポジトリで:
   - `git worktree add ~/workspaces/{project}/{issue}/{repo} -b feature/{issue}`
   - branch作成（ブランチ名はパターンから生成）
3. `.code-workspace` ファイル生成（全リポジトリのworktreeをfoldersに追加）
4. `.claude.md` コンテキストファイル生成
5. `data/{project}/issues.yaml` に状態保存
6. TreeView更新
7. 新Windowでworkspace開く

**Issue削除フロー**:
1. TreeViewでIssue選択
2. 確認ダイアログ表示
3. 各リポジトリで:
   - `git worktree remove ~/workspaces/{project}/{issue}/{repo}`
   - `git branch -D feature/{issue}` (オプション)
4. `~/workspaces/{project}/{issue}/` ディレクトリ削除
5. `data/{project}/issues.yaml` から状態削除
6. TreeView更新

**実装ファイル**:
- `commands/createProjectCommand.ts` - Project作成ウィザード（Quick Pick）
- `services/projectManager.ts` - Project YAML管理（作成・更新・削除）
- `services/gitService.ts` - worktree/branch操作
- `services/workspaceService.ts` - .code-workspace生成
- `services/stateManager.ts` - issues.yaml読み書き（CLI互換形式変換含む）
- `services/issueService.ts` - Issue作成・削除オーケストレーション
- `statusBar/statusBarManager.ts` - StatusBar統合（現在Issue表示）
- `views/projectTreeProvider.ts` - TreeView表示（Project/Issue/Repo階層）

### Phase 3以降: 拡張機能（後回し）
- GitHub Issue fetch
- PR作成
- AI code review
- CI status表示

詳細は SPEC.md を参照。
