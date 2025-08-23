// プロンプトの追加（ファイルアップロード対応版）
function addPrompt(loginId, text, note, visibility, question, fileObject) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROMPT_SHEET_NAME);
  let imageFileId = ''; 

  if (fileObject) {
    try {
      const decodedData = Utilities.base64Decode(fileObject.base64Data);
      const blob = Utilities.newBlob(decodedData, fileObject.mimeType, fileObject.fileName);
      const folder = DriveApp.getFolderById(folderIdforPicandPdf);
      const newFile = folder.createFile(blob);
      imageFileId = newFile.getId();
    } catch (e) {
      console.error('ファイルのアップロードに失敗: ' + e.toString());
      return { success: false, message: 'ファイルのアップロード中にエラーが発生しました。' };
    }
  }

  const existingIds = sheet.getRange('B2:B' + sheet.getLastRow()).getValues().flat();
  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 10);
  } while (existingIds.includes(newId));

  sheet.appendRow([loginId, newId, text, note, visibility, question, imageFileId]);
  
  const prompts = getPrompts(loginId);

  // ★ ここに success: true を追加
  return { success: true, prompts: prompts, message: 'プロンプトの追加に成功しました。' };
}

// プロンプトの保存（ファイル差し替え対応版）
function savePrompt(id, text, note, visibility, question, fileObject) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROMPT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let loginId = null;
  let newImageFileId = null; 

  if (fileObject) {
    try {
      const decodedData = Utilities.base64Decode(fileObject.base64Data);
      const blob = Utilities.newBlob(decodedData, fileObject.mimeType, fileObject.fileName);
      const folder = DriveApp.getFolderById(folderIdforPicandPdf);
      const newFile = folder.createFile(blob);
      newImageFileId = newFile.getId();
    } catch (e) {
      console.error('編集時のファイルアップロードに失敗: ' + e.toString());
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == id) {
      sheet.getRange(i + 1, 3).setValue(text);
      sheet.getRange(i + 1, 4).setValue(note);
      sheet.getRange(i + 1, 5).setValue(visibility);
      sheet.getRange(i + 1, 6).setValue(question);
      
      if (newImageFileId) {
        sheet.getRange(i + 1, 7).setValue(newImageFileId);
      }
      
      loginId = data[i][0];
      break;
    }
  }

  if (loginId == null) {
    return { success: false, message: 'プロンプトが見つかりませんでした。' };
  }
  
  const prompts = getPrompts(loginId);
  // ★ ここに success: true を追加
    return { success: true, prompts: prompts, message: 'プロンプトの追加に成功しました。' };
}

// プロンプトの削除
function deletePrompt(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROMPT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  let loginId = null;
  let rowIndex = -1;
  let imageFileId = null; // ★削除するファイルのIDを格納する変数

  // 削除対象の行を探し、loginIdとfileIdを取得
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == id) {
      rowIndex = i;
      loginId = data[i][0];     // A列: ログインID
      imageFileId = data[i][6]; // G列: 画像/PDF ID
      break;
    }
  }
  
  // 対象行が見つかった場合のみ処理を実行
  if (rowIndex !== -1) {
    // ★ 関連ファイルがあれば、ゴミ箱に移動させる
    if (imageFileId) {
      try {
        DriveApp.getFileById(imageFileId).setTrashed(true);
        console.log('関連ファイル（ID: ' + imageFileId + '）をゴミ箱に移動しました。');
      } catch (e) {
        console.error('関連ファイルの削除中にエラーが発生しました: ' + e.toString());
        // ファイルが見つからない等のエラーでも、行の削除は続行する
      }
    }
    
    // スプレッドシートの行を削除
    sheet.deleteRow(rowIndex + 1);
  } else {
    // 対象が見つからなかった場合
    return { success: false, message: '削除対象のプロンプトが見つかりませんでした。' };
  }
  
  // 最新のプロンプトデータを取得
  const prompts = getPrompts(loginId);
  
  // ★ success: true を付けてクライアントに返す
  return { success: true, prompts: prompts, message: '削除に成功しました。' };
}