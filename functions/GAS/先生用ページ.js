
//最新のお知らせを取得
function getAnnouncement() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('お知らせ');
  if (!sheet) return "";  // シートが存在しない場合は空文字を返す
  return sheet.getRange('A1').getValue(); // A1セルの内容を取得
}


// パスワードの変更
function changePassword(loginId, newPassword) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGIN_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === loginId) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return { success: true };
    }
  }
  return { success: false };
}

/**
 * 教員IDに対応する現在の利用回数(L列)と利用上限(R列)を返す関数
 * R列が空の場合は制限なし（無制限）として扱います
 */
function getUsageCount(teacherId) {
  const loginSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGIN_SHEET_NAME);
  const loginData = loginSheet.getDataRange().getValues();
  let usageCount = 0;
  let usageLimit = null; // 空なら無制限として扱う
  for (let i = 1; i < loginData.length; i++) {
    if (loginData[i][0] === teacherId) {
      usageCount = loginData[i][11] || 0; // L列（index 11）
      usageLimit = loginData[i][17];       // R列（index 17）
      break;
    }
  }
  return { usageCount, usageLimit };
}

// 先生用ページでプロンプトの一覧を取得
function getPrompts(loginId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROMPT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const prompts = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(loginId).trim()) {
      prompts.push({
        id:         data[i][1], // B列: プロンプトID
        text:       data[i][2], // C列: プロンプト（採点基準）
        note:       data[i][3], // D列: メモ（タイトル）
        visibility: data[i][4], // E列: 表示／非表示
        question:   data[i][5], // F列: 問題文
        imageFileId:data[i][6]  // ★ G列: 画像/PDF ID を追加
      });
    }
  }
  return prompts;
}