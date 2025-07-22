/**
 * 一括採点シートから指定プロンプトIDに一致する行を抽出
 *   C 列（index 2）: プロンプト番号
 *   B ～ I 列を拾う
 * @param {string|number} promptId - セレクトボックスで選ばれた値
 * @return {Array<Object>} 結果配列
 */
function getBulkResults(promptId) {
  const sheet = SpreadsheetApp
    .openById(RESULT_SPREADSHEET_ID)
    .getSheetByName(RESULT_SHEET_NAME);

  if (!sheet) throw new Error('対象シートが見つかりません');

  const data   = sheet.getDataRange().getValues();
  const target = String(promptId).trim();
  const out    = [];

  Logger.log('[BulkExport]  Search target = "%s"', target);

  for (let i = 1; i < data.length; i++) {
    const pidCell = data[i][2];          // C 列
    const pid     = String(pidCell).trim();

    // ---- デバッグ行 ----
    if (i <= 10) {                       // 最初の 10 行だけログ
      Logger.log('[BulkExport] row %s pid = "%s"', i + 1, pid);
    }
    // -------------------

    if (pid == target) {                 // ← ここを緩い比較に
      out.push({
        timestamp     : data[i][1]
          ? Utilities.formatDate(new Date(data[i][1]), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
          : '',
        promptId      : pid,
        imageUrl      : data[i][3],
        studentNumber : data[i][4],
        name          : data[i][5],
        response      : data[i][6],
        totalScore    : data[i][7],
        resultAll     : data[i][8]
      });
    }
  }

  Logger.log('[BulkExport] matched rows = %s', out.length);
  return out;
}

/**
 * 一括採点：Excel ファイルを生成してダウンロード URL を返す
 * @param {string} promptId - C 列のプロンプト番号
 * @return {string} ダウンロード URL（エラー時はエラーメッセージ）
 */
function exportBulkExcelFromResults(promptId) {
  try {
const resultsArray = getBulkResults(promptId);   // ← parse 不要
if (!resultsArray.length) return 'Error: No data to export';

const sheetId = createBulkGoogleSheet(resultsArray);
    if (!sheetId) return 'Error: Unable to generate Google Sheet';

    const fileUrl = downloadBulkSheetAsExcel(sheetId);
    return fileUrl || 'Error: Unable to generate Excel file';
  } catch (err) {
    Logger.log('exportBulkExcelFromResults: ' + err);
    return 'Error: Unable to export Excel';
  }
}

/**
 * 一括採点：結果を新規スプレッドシートに書き込む
 * @param {Array<Object>} results - getBulkResults() で作った配列
 * @return {string|null} 新シートのスプレッドシート ID
 */
function createBulkGoogleSheet(results) {
  try {
    const ss = SpreadsheetApp.create('Bulk Results');
    const sheet = ss.getActiveSheet();

    // ヘッダー行
    const header = [
      'タイムスタンプ', '出席番号', '氏名',
      'プロンプトID', '画像URL', '採点結果', '点数', '結果全体'
    ];
    const data = [header];

    results.forEach(r => data.push([
      r.timestamp,
      r.studentNumber,
      r.name,
      r.promptId,
      r.imageUrl,
      r.response,
      r.totalScore,
      r.resultAll
    ]));

    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    sheet.getRange(1, 1, data.length, data[0].length)
   .setValues(sheet.getRange(1, 1, data.length, data[0].length).getDisplayValues());

    SpreadsheetApp.flush(); // 明示的フラッシュ
    
    return ss.getId();
  } catch (err) {
    Logger.log('createBulkGoogleSheet: ' + err);
    return null;
  }
}

/**
 * 一括採点：Google Sheet → Excel(.xlsx) に変換しフォルダへ保存
 * @param {string} sheetId - createBulkGoogleSheet() が返す ID
 * @return {string|null} 共有 URL
 */
function downloadBulkSheetAsExcel(sheetId) {
  try {
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd-HH:mm');
    const fileName = `一括採点結果（${now}）.xlsx`;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const token = ScriptApp.getOAuthToken();

    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const blob = resp.getBlob().setName(fileName);
    const folder = DriveApp.getFolderById(Export_Reault_Folder_For_Bulk);
    const file = folder.createFile(blob);

    // 誰でも閲覧可
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 元のスプレッドシートはゴミ箱へ
    DriveApp.getFileById(sheetId).setTrashed(true);

    // 1 時間後に自動削除
    scheduleExcelFileDeletion(file.getId());

    return file.getDownloadUrl();
  } catch (err) {
    Logger.log('downloadBulkSheetAsExcel: ' + err);
    return null;
  }
}

/* ---------- 既存の scheduleExcelFileDeletion() がそのまま使える場合は流用 ---------- */
/**
 * 指定ファイル ID を 1 時間後に自動削除
 * @param {string} fileId
 */
function scheduleExcelFileDeletion(fileId) {
  ScriptApp.newTrigger('deleteTempExcelFile')
           .timeBased()
           .after(60 * 60 * 1000) // 1 時間後
           .create();

  PropertiesService.getScriptProperties().setProperty('tempExcelFileId', fileId);
}

function deleteTempExcelFile() {
  const id = PropertiesService.getScriptProperties().getProperty('tempExcelFileId');
  if (id) {
    try {
      DriveApp.getFileById(id).setTrashed(true);
    } catch (e) {
      Logger.log('deleteTempExcelFile: ' + e);
    }
    PropertiesService.getScriptProperties().deleteProperty('tempExcelFileId');
  }
}
