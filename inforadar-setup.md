# InfoRadar × GAS 連携 セットアップ手順

APIキー不要・完全無料で動く、GAS（Google Apps Script）からの自動RSS取得＋HTML表示の構成です。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `gas/inforadar-backend.gs` | GAS 側のコード（コピペ用） |
| `inforadar.html` | フロント（GAS API を叩いて表示） |

---

## ステップ1：スプレッドシート作成（2分）

1. https://sheets.google.com で新規スプレッドシートを作成
2. 名前を「InfoRadar データ」に変更
3. A1〜F1 にヘッダーを入力：

| A1 | B1 | C1 | D1 | E1 | F1 |
|---|---|---|---|---|---|
| 日付 | カテゴリID | タイトル | 要約 | URL | 重要度 |

4. シート名が「シート1」であることを確認（違う場合は `gas/inforadar-backend.gs` の `SHEET_NAME` を書き換え）

---

## ステップ2：GAS コード貼り付け（3分）

1. スプレッドシートの上部メニュー「拡張機能」→「Apps Script」
2. 既存コードを全削除
3. `gas/inforadar-backend.gs` の中身を全てコピペ
4. 保存（Ctrl+S）、プロジェクト名を「InfoRadar Backend」に変更

---

## ステップ3：初回実行＋トリガー設定（2分）

### 3-1. 手動で初回実行

1. 関数選択で `fetchAllRSS` を選び「実行」
2. 初回は権限の承認を求められる → 許可
3. スプレッドシートに行が追加されていれば成功

### 3-2. 毎日自動実行のトリガー

1. 左側の時計アイコン（トリガー）をクリック
2. 右下「＋トリガーを追加」
3. 以下のように設定：
   - 実行する関数: `fetchAllRSS`
   - イベントのソース: 時間主導型
   - 時間ベースのトリガー: 日付ベースのタイマー
   - 時刻: 午前7時〜8時
4. 保存

---

## ステップ4：ウェブアプリとしてデプロイ（2分）

1. スクリプトエディタ右上「デプロイ」→「新しいデプロイ」
2. 種類の選択: **ウェブアプリ**
3. 設定：
   - 説明: `InfoRadar API`
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
4. 「デプロイ」
5. 表示された **ウェブアプリ URL** をコピー（例: `https://script.google.com/macros/s/AKfycbx.../exec`）

---

## ステップ5：HTML に URL を設定（1分）

`inforadar.html` を開いて以下の行を編集：

```js
const GAS_API_URL = "";   // ← ここに ステップ4 でコピーした URL を貼り付け
```

↓

```js
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx.../exec";
```

---

## ステップ6：動作確認

1. ブラウザで `inforadar.html` を開く
2. カテゴリタブを切り替えて一覧を確認
3. 「🔄 データを再取得」で最新状態に更新

※ 一度取得したデータは `localStorage` にキャッシュされ、オフラインでも表示されます。

---

## カテゴリ／RSS の追加方法

`gas/inforadar-backend.gs` の `RSS_FEEDS` に追記するだけ：

```js
const RSS_FEEDS = [
  { url: "https://xxx.xx/rss.xml", category: "grants", label: "中小企業庁" },
  // ここに追加 ↓
  { url: "https://yyy.yy/rss.xml", category: "grants", label: "新しいソース" },
];
```

新カテゴリを追加する場合は：
1. `gas/inforadar-backend.gs` の `doGet` 内 `emptyResult` にキーを追加
2. `inforadar.html` の `CATEGORIES` 配列にラベルを追加

---

## メンテナンス

- **古いデータを削除**: GAS で `cleanOldData` を手動実行（30日以上前を削除）
- **スプレッドシート直接編集**: 行を直接編集／削除してもOK。次回の `fetchAllRSS` では URL で重複判定するため、同じニュースは再追加されません
- **GAS コード更新後**: 「デプロイ」→「デプロイを管理」→ 鉛筆アイコン → バージョンを「新しいバージョン」にして再デプロイ

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| データが表示されない | ブラウザの開発者ツール（F12）でエラー確認。`GAS_API_URL` が正しいか確認 |
| GAS で「このスクリプトは承認が必要」 | `fetchAllRSS` を手動実行して権限を許可 |
| RSS の項目が 0 件 | RSS URL が有効か、GAS の実行ログを確認 |
| 古いデータを消したい | GAS で `cleanOldData` を実行 |
