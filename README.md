# 灰縁の灯（はいべりのあかり）

RPG・育成シミュレーション・ノベルを融合した、スマートフォンのブラウザ向けWebゲーム（開発中）。

## 遊び方（ローカル）

```bash
npm install
npm run dev      # 開発サーバー
npm test         # 自動テスト（ランダムプレイのシミュレーション）
npm run build    # dist/ に静的ファイルを出力
```

## 公開（GitHub Pages）

`.github/workflows/deploy.yml` が `main` への push で自動デプロイします。
初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」にしてください。

## ドキュメント

- `docs/` … 要件定義・決定ログ・開発状況（ネタバレなし）
- `docs/spoilers/`・`src/content/` … **物語・人物の設定とシナリオ本体（ネタバレ注意）**

## 構成

| 場所 | 内容 |
|---|---|
| `src/engine/` | ゲームエンジン（成長モデル、時間、イベント、戦闘、人間関係、セーブ） |
| `src/content/` | 世界・行動・NPC・イベント・依頼のデータ（ネタバレ） |
| `src/ui/` | 画面（Preact） |
| `tests/` | 自動テスト |

## パズルゲーム「おまちどう」（`puzzle/`）

RPG とは別のアプリ。Bus Jam型のパズル（寿司屋テーマ）。公開先は `…/novel-game/puzzle/`。

```bash
npm run puzzle:dev   # 開発サーバー
npm test             # 単体テスト・全ステージ検証・自動プレイ（RPG のテストも含む）
npm run build && npm run puzzle:e2e   # UI テスト（Playwright）
npm run puzzle:gen   # ステージの再生成（puzzle/stages/queue.json）
```

設計書・決定ログ：`puzzle/docs/`
