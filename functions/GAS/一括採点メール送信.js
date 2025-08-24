
/**
 * フォルダ削除を予約する関数。
 * フォルダIDと「今から1時間後の削除時刻」をプロパティに記録する。
 */
function scheduleFolderDeletion(folderId) {
  var props = PropertiesService.getScriptProperties();
  var folderDeletionDataJson = props.getProperty('folderDeletionData');
  var folderDeletionData = folderDeletionDataJson ? JSON.parse(folderDeletionDataJson) : {};

  // 24時間後のタイムスタンプ (ミリ秒)
  var deleteTime = new Date().getTime() + 24 * 60 * 60 * 1000;

  folderDeletionData[folderId] = deleteTime;
  props.setProperty('folderDeletionData', JSON.stringify(folderDeletionData));
}

/**
 * 定期トリガーで呼び出される関数。
 * folderDeletionData に登録されているフォルダIDをチェックし、
 * 「削除時刻を過ぎているもの」をまとめて削除（ゴミ箱へ移動）する。
 */
function deleteScheduledFolders() {
  var props = PropertiesService.getScriptProperties();
  var folderDeletionDataJson = props.getProperty('folderDeletionData');
  if (!folderDeletionDataJson) {
    return;  // 何も登録されていない
  }

  var folderDeletionData = JSON.parse(folderDeletionDataJson);
  var now = new Date().getTime();

  // folderDeletionDataは { folderId: deleteTime } の形
  for (var folderId in folderDeletionData) {
    var deleteTime = folderDeletionData[folderId];
    // 削除予定の時刻を過ぎていればゴミ箱へ
    if (now >= deleteTime) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        folder.setTrashed(true);
        Logger.log('Folder trashed: ' + folder.getName());
      } catch (error) {
        Logger.log('Error deleting folder with ID ' + folderId + ': ' + error.message);
      }
      // 削除が完了したフォルダIDはプロパティから削除
      delete folderDeletionData[folderId];
    }
  }

  // 更新した情報を再度保存
  props.setProperty('folderDeletionData', JSON.stringify(folderDeletionData));
}


function createChildFolderAndUpload(files) {
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const folderName = "Uploaded_Files_" + new Date().toISOString().replace(/[:.]/g, '-');
    const childFolder = parentFolder.createFolder(folderName);  // 子フォルダを作成

    // ファイルをアップロード
    files.forEach(function(fileData) {
        const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.mimeType, fileData.fileName);
        childFolder.createFile(blob);
    });

    return childFolder.getId();  // 子フォルダのIDを返す
}

// 一時的なGoogleスプレッドシートを作成
function createTemporarySheet(results) {
  try {
    const spreadsheet = SpreadsheetApp.create('Temporary_Results');
    const sheet = spreadsheet.getActiveSheet();

    // ヘッダーと結果データを設定
    const headers = ["ID", "タイムスタンプ", "プロンプトID", "画像URL", "出席番号", "氏名", "採点結果", "最終スコア"];
    sheet.appendRow(headers);

    // 結果データをシートに書き込む
    results.forEach(function(row) {
      sheet.appendRow(row);
    });
    Logger.log('createTemporarySheetで作成したスプレッドシートID: ' + spreadsheet.getId());

    return spreadsheet.getId();  // スプレッドシートIDを返す
  } catch (error) {
    Logger.log('エラーが発生しました (createTemporarySheet): ' + error.message);
    return null;
  }
}

// 一時的なGoogleスプレッドシートをExcelファイルとしてダウンロード
function downloadTemporarySheetAsExcel(sheetId) {
  try {
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd-HH:mm');
    const fileName = `レポート自動採点システム結果（${formattedDate}）.xlsx`;

    // GoogleスプレッドシートをExcel形式でエクスポート
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const token = ScriptApp.getOAuthToken();

    Logger.log('downloadTemporarySheetAsExcelのURL: ' + url);

    // Excelファイルを取得
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const excelBlob = response.getBlob().setName(fileName);
    const folder = DriveApp.getRootFolder();
    const file = folder.createFile(excelBlob);

    // ファイルを全体に共有する
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    Logger.log('ダウンロードURL: ' + file.getDownloadUrl());

    // スプレッドシートを削除する
    DriveApp.getFileById(sheetId).setTrashed(true);

    return file.getDownloadUrl(); // ダウンロードURLを返す
  } catch (error) {
    Logger.log('エラーが発生しました (downloadTemporarySheetAsExcel): ' + error.message);
    return null;
  }
}

// ドキュメント保存用のフォルダを作成する関数
function createDocFolder(batchId) {
    try {
        const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
        const folderName = '採点結果_' + batchId;
        const docFolder = parentFolder.createFolder(folderName);
        return docFolder.getId();
    } catch (error) {
        Logger.log('エラーが発生しました (createDocFolder): ' + error.message);
        return null;
    }
}

function createDownloadPage(folderUrl, pdfFolderId) {
    // WebアプリのURLを取得
    const webAppUrl = ScriptApp.getService().getUrl();
    // ダウンロードページのURLを生成（フォルダIDをパラメータとして渡す）
    const downloadPageUrl = `${webAppUrl}?action=download&folderUrl=${encodeURIComponent(folderUrl)}&folderId=${pdfFolderId}`;
    return downloadPageUrl;
}

function revokeFolderAccess(pdfFolderId) {
    try {
        const pdfFolder = DriveApp.getFolderById(pdfFolderId);
        pdfFolder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (error) {
        Logger.log('エラーが発生しました (revokeFolderAccess): ' + error.message);
    }
}

// 結果シートから該当するプロンプトIDのデータを取得する関数（既存の関数）
function getResultsFromSheet(promptId) {
  try {
    const sheet = SpreadsheetApp.openById(RESULT_SPREADSHEET_ID).getSheetByName(RESULT_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    Logger.log('シート全体のデータ: ' + JSON.stringify(data));

    const results = [];

    // C列（プロンプトID）を基に該当データを抽出
    for (let i = 1; i < data.length; i++) {
      Logger.log('行 ' + i + ' のデータ: ' + JSON.stringify(data[i]));

      // promptId と C列の値を文字列として比較する
      if (String(data[i][2]) === String(promptId)) {
        results.push(data[i]); // 該当する行を保存
      }
    }

    Logger.log('getResultsFromSheetで取得したデータ: ' + JSON.stringify(results));
    return results; // 抽出されたデータを返す
  } catch (error) {
    Logger.log('エラーが発生しました (getResultsFromSheet): ' + error.message);
    return null;
  }
}

// フォルダとその中のアイテム（ファイル、子フォルダ）を再帰的に削除する関数
function deleteOldItems(folder, threeMonthsAgo) {
  // フォルダ内のファイルをチェック
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const lastUpdated = file.getLastUpdated();
    
    // 最終更新日が3ヶ月前より前ならファイルを削除
    if (lastUpdated < threeMonthsAgo) {
      file.setTrashed(true);
      Logger.log('Deleted file: ' + file.getName());
    }
  }
  
  // フォルダ内の子フォルダをチェック
  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    const lastUpdated = subFolder.getLastUpdated();
    
    // 子フォルダの最終更新日が3ヶ月前より前ならフォルダを削除
    if (lastUpdated < threeMonthsAgo) {
      subFolder.setTrashed(true);
      Logger.log('Deleted folder: ' + subFolder.getName());
    } else {
      // 子フォルダの中身もチェックする（再帰呼び出し）
      deleteOldItems(subFolder, threeMonthsAgo);
    }
  }
}

//3カ月で削除する関数
function runDeleteOldItems() {
  const folderId = '1jz9aDtViGHFiO7FpzgGy8kHo5YsIJTPV'; // 対象フォルダのID
  const folder = DriveApp.getFolderById(folderId);
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  deleteOldItems(folder, threeMonthsAgo);
}