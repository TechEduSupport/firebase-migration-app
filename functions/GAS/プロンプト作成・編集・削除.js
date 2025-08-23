/**
 * 【修正】getResults関数で列をズラし、promptId が D列(index 3) の場合を取得
 * 出席番号(studentNumber)は B列(index 1)
 * 氏名(name)は C列(index 2)
 * 回答(response=gradingResults)は F列(index 5)
 * 合計点(totalScore)は J列(index 9)
 */
function getResults(promptId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    // D列( index = 3 ) が指定の promptId に一致する行だけ抽出
    if (data[i][3] == promptId) {
      results.push({
        timestamp: data[i][0]
          ? Utilities.formatDate(new Date(data[i][0]), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss")
          : "",
        studentNumber: data[i][1],   // B列
        name: data[i][2],           // C列
        promptId: data[i][3],       // D列
        imageUrl: data[i][4],       // E列
        response: data[i][5],       // F列
        rating: data[i][6],         // G列
        transcription: data[i][7],  // H列
        ocrText: data[i][8],        // I列
        totalScore: data[i][9]      // J列 (合計点)
      });
    }
  }

  return JSON.stringify(results);
}

// エクセルファイルを生成してURLを返す
function exportExcelFromResults(promptId) {
  try {
    const results = getResults(promptId);               // JSON文字列
    const parsedResults = JSON.parse(results);          // 配列に変換
    if (!parsedResults || parsedResults.length === 0) {
      return 'Error: No data to export';
    }
    const sheetId = createGoogleSheet(parsedResults);   // Googleスプレッドシートを生成
    if (sheetId) {
      const excelFile = downloadSheetAsExcel(sheetId);  // スプレッドシートをExcel形式でDL
      if (excelFile) {
        return excelFile; // URLを返す
      } else {
        return 'Error: Unable to generate Excel file';
      }
    } else {
      return 'Error: Unable to generate Google Sheet';
    }
  } catch (error) {
    Logger.log('Error in exportExcelFromResults: ' + error.message);
    return 'Error: Unable to export Excel';
  }
}

function createGoogleSheet(results) {
  try {
    const spreadsheet = SpreadsheetApp.create('Results');
    const sheet = spreadsheet.getActiveSheet();

    // ヘッダー行に「合計点」を追加
    const data = [
      ["タイムスタンプ", "出席番号", "氏名", "プロンプトID", "画像URL", "採点結果", "合計点"]
    ];
    
    results.forEach(function(row) {
      data.push([
        row.timestamp,
        row.studentNumber,
        row.name,
        row.promptId,
        row.imageUrl,
        row.response,
        row.totalScore || ""   // 合計点が空の場合は空文字
      ]);
    });

    if (data.length > 1) {
      // シートに書き込み
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      // DisplayValuesを再設定（文字列形式を保つための措置: 不要なら省略可）
      sheet.getRange(1, 1, data.length, data[0].length).setValues(
        sheet.getRange(1, 1, data.length, data[0].length).getDisplayValues()
      );
    }

    return spreadsheet.getId(); 
  } catch (error) {
    Logger.log('Error in createGoogleSheet: ' + error.message);
    return null;
  }
}

// Google Sheets をExcelファイルとしてエクスポートする
function downloadSheetAsExcel(sheetId) {
  try {
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd-HH:mm');
    const fileName = `レポート自動採点システム結果（${formattedDate}）.xlsx`;

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const token = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const excelBlob = response.getBlob().setName(fileName);
    
    // ▼▼▼ ここを変更 ▼▼▼
    const folder = DriveApp.getFolderById('1haAv1_M1b4ZRryP_FNsfvQbhLCVI5pGS'); // 指定されたフォルダIDに保存
    const file = folder.createFile(excelBlob);

    // 誰でも閲覧できるように共有
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 一時的に作ったスプレッドシートをゴミ箱へ
    DriveApp.getFileById(sheetId).setTrashed(true);

    return file.getDownloadUrl();
  } catch (error) {
    Logger.log('Error in downloadSheetAsExcel: ' + error.message);
    return null;
  }
}