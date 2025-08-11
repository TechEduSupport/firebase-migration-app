// doGet 関数
function doGet(e) {
  const currentUrl = ScriptApp.getService().getUrl();
  const latestUrl = getLatestUrl();

  Logger.log('Current URL: ' + currentUrl);
  Logger.log('Latest URL: ' + latestUrl);

  if (!latestUrl) {
    Logger.log('Failed to retrieve latest URL');
    return HtmlService.createHtmlOutput('エラー: 最新URLの取得に失敗しました。管理者に連絡してください。');
  }

  // ドメイン部分を除去して比較
  const cleanCurrentUrl = currentUrl.replace('/a/ai-eva.com', '').trim();
  const cleanLatestUrl = latestUrl.replace('/a/ai-eva.com', '').trim();

  if (cleanCurrentUrl !== cleanLatestUrl) {
    Logger.log('URLs do not match');
    const warningMessage = `
      <html>
      <head>
        <title>最新のページをご利用ください</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          a { color: #007BFF; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>このページは最新ではありません</h1>
        <p>以下のリンクから最新のページにアクセスしてください。</p>
        <p><a href="${latestUrl}" target="_top">最新バージョンへ</a></p>
      </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(warningMessage)
      .setTitle('バージョン警告')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  Logger.log('URLs match, showing index page');
  try {
    const template = HtmlService.createTemplateFromFile('index');
    return template.evaluate()
      .setTitle('手書き採点アシスタント')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return HtmlService.createHtmlOutput('エラーが発生しました。管理者に連絡してください。');
  }
}

function getLatestUrl() {
  try {
    Logger.log('SPREADSHEET_ID: ' + SPREADSHEET_ID);
    Logger.log('Attempting to open spreadsheet...');
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('Spreadsheet opened successfully.');
    
    Logger.log('Trying to access sheet: ' + URL_SHEET_NAME);
    const sheet = spreadsheet.getSheetByName(URL_SHEET_NAME);
    if (!sheet) {
      Logger.log('Sheet not found: ' + URL_SHEET_NAME);
      return null;
    }
    
    Logger.log('Accessing cell: ' + URL_CELL);
    const range = sheet.getRange(URL_CELL);
    const url = range.getValue();
    Logger.log('Retrieved URL: ' + url);

    if (typeof url === 'string') {
      return url.trim() || null;
    } else {
      Logger.log('Invalid URL type: ' + typeof url);
      return null;
    }
  } catch (error) {
    Logger.log('Error in getLatestUrl: ' + error);
    return null;
  }
}




/**
 * Excelファイルの削除予約情報をプロパティに保存します。
 * ※ 新たにトリガーを作成せず、予約情報のみ登録するように変更。
 */
function scheduleExcelFileDeletion(fileId) {
  var props = PropertiesService.getScriptProperties();
  // 既存の予約情報を取得（JSON形式）
  var deletionDataJson = props.getProperty('excelDeletionData');
  var excelDeletionData = deletionDataJson ? JSON.parse(deletionDataJson) : {};
  
  // 1時間後のタイムスタンプ（ミリ秒）
  var deletionTime = new Date().getTime() + 3600000;
  
  // ファイルIDをキーに削除予定時刻を保存
  excelDeletionData[fileId] = deletionTime;
  
  // 更新した予約情報を再度保存
  props.setProperty('excelDeletionData', JSON.stringify(excelDeletionData));
}


/**
 * 定期トリガー（例：15分おきなど）で呼び出す関数。
 * プロパティに登録されたExcelファイルIDのうち、削除予定時刻を過ぎたものを削除します。
 */
function deleteScheduledExcelFiles() {
  var props = PropertiesService.getScriptProperties();
  var deletionDataJson = props.getProperty('excelDeletionData');
  if (!deletionDataJson) return; // 予約情報がない場合は何もしない
  
  var excelDeletionData = JSON.parse(deletionDataJson);
  var now = new Date().getTime();
  
  // 登録されている各ファイルについて、削除予定時刻をチェック
  for (var fileId in excelDeletionData) {
    var scheduledTime = excelDeletionData[fileId];
    if (now >= scheduledTime) {
      try {
        var file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        Logger.log('Excel file deleted: ' + file.getName());
      } catch (e) {
        Logger.log('Error deleting Excel file with ID ' + fileId + ': ' + e.message);
      }
      // 削除済みのファイルIDはオブジェクトから削除
      delete excelDeletionData[fileId];
    }
  }
  
  // 更新した予約情報を再度保存
  props.setProperty('excelDeletionData', JSON.stringify(excelDeletionData));
}

