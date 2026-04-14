// ============================================
// InfoRadar GAS バックエンド
// ============================================
// スプレッドシートに紐づく Apps Script プロジェクトに
// このコード全体を貼り付けてください。
// ============================================

const SHEET_NAME = "シート1"; // スプレッドシートのシート名

// RSS 情報源の定義
const RSS_FEEDS = [
  // 助成金・補助金
  { url: "https://www.chusho.meti.go.jp/rss/index.rdf", category: "grants", label: "中小企業庁" },
  { url: "https://www.meti.go.jp/rss/index.rdf",        category: "grants", label: "経済産業省" },

  // 理容美容業界
  { url: "https://www.mhlw.go.jp/stf/news.rdf",         category: "beauty", label: "厚生労働省" },

  // 税金
  { url: "https://www.nta.go.jp/rss/index.rdf",         category: "tax", label: "国税庁" },

  // 法改正
  { url: "https://www.moj.go.jp/hisho/kouhou/RSS_hisho01.xml", category: "guardianship", label: "法務省" },
];

// ============================================
// メイン：RSS 取得してスプレッドシートに保存
// ============================================
function fetchAllRSS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    Logger.log("エラー：シート '" + SHEET_NAME + "' が見つかりません");
    return;
  }

  // 既存 URL を一括取得（重複チェック用）
  const lastRow = sheet.getLastRow();
  const existingUrls = lastRow > 1
    ? sheet.getRange(2, 5, lastRow - 1, 1).getValues().flat()
    : [];
  const urlSet = new Set(existingUrls);

  let newItemsCount = 0;

  RSS_FEEDS.forEach(feed => {
    try {
      const xml = UrlFetchApp.fetch(feed.url, { muteHttpExceptions: true }).getContentText();
      const items = parseRSSItems(xml, feed.category, feed.label);

      items.forEach(item => {
        if (!urlSet.has(item.url)) {
          sheet.appendRow([
            item.date,
            item.category,
            item.title,
            item.summary,
            item.url,
            item.importance
          ]);
          urlSet.add(item.url);
          newItemsCount++;
        }
      });

      Logger.log(feed.label + " から " + items.length + " 件取得");

    } catch (e) {
      Logger.log("エラー [" + feed.label + "]: " + e.message);
    }
  });

  Logger.log("完了：新規 " + newItemsCount + " 件を追加");
}

// ============================================
// RSS の XML をパースして配列に変換
// ============================================
function parseRSSItems(xml, category, source) {
  const items = [];

  try {
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) || [];

    itemMatches.slice(0, 5).forEach(itemXml => { // 最新 5 件のみ
      const title       = extractTag(itemXml, "title");
      const link        = extractTag(itemXml, "link");
      const description = extractTag(itemXml, "description") || extractTag(itemXml, "summary") || "";
      const pubDate     = extractTag(itemXml, "pubDate") || extractTag(itemXml, "dc:date") || "";

      if (title && link) {
        items.push({
          date:       formatDate(pubDate),
          category:   category,
          title:      cleanText(title),
          summary:    cleanText(description).slice(0, 200),
          url:        link.trim(),
          importance: detectImportance(title, description),
        });
      }
    });

  } catch (e) {
    Logger.log("XML パースエラー: " + e.message);
  }

  return items;
}

// ============================================
// XML タグから値を抽出
// ============================================
function extractTag(xml, tagName) {
  const regex = new RegExp("<" + tagName + "[^>]*>([\\s\\S]*?)<\\/" + tagName + ">", "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

// ============================================
// HTML/XML タグを除去してクリーンなテキストに
// ============================================
function cleanText(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// 日付をフォーマット
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString("ja-JP");

  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString("ja-JP");
    return d.toLocaleDateString("ja-JP");
  } catch (e) {
    return new Date().toLocaleDateString("ja-JP");
  }
}

// ============================================
// タイトル・要約から重要度を判定
// ============================================
function detectImportance(title, description) {
  const text = (title + " " + description).toLowerCase();

  const highKeywords   = ["重要", "改正", "新制度", "締切", "受付開始", "廃止", "変更"];
  const mediumKeywords = ["更新", "追加", "公開", "発表", "お知らせ"];

  if (highKeywords.some(kw => text.includes(kw))) return "high";
  if (mediumKeywords.some(kw => text.includes(kw))) return "medium";
  return "low";
}

// ============================================
// API：データを JSON 形式で返す（doGet）
// ============================================
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  const emptyResult = {
    grants:        { items: [] },
    beauty:        { items: [] },
    tax:           { items: [] },
    guardianship:  { items: [] },
  };

  if (!sheet) {
    return jsonResponse({ error: "シートが見つかりません" });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(emptyResult);
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const result = emptyResult;

  data.forEach(row => {
    const [date, category, title, summary, url, importance] = row;

    if (result[category]) {
      result[category].items.push({
        date:       typeof date === "string" ? date : new Date(date).toLocaleDateString("ja-JP"),
        title:      title,
        summary:    summary,
        url:        url,
        importance: importance,
        source:     "公式RSS"
      });
    }
  });

  // 日付降順にソートして最新 10 件に絞る
  Object.keys(result).forEach(key => {
    result[key].items.sort((a, b) => new Date(b.date) - new Date(a.date));
    result[key].items = result[key].items.slice(0, 10);
  });

  return jsonResponse(result);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 手動実行用：古いデータを削除（30 日以上前）
// ============================================
function cleanOldData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const today = new Date();
  const thresholdDays = 30;

  for (let i = data.length - 1; i >= 0; i--) {
    const rowDate = new Date(data[i][0]);
    const daysDiff = (today - rowDate) / (1000 * 60 * 60 * 24);

    if (daysDiff > thresholdDays) {
      sheet.deleteRow(i + 2); // ヘッダー分 +1
    }
  }

  Logger.log("古いデータを削除しました");
}
