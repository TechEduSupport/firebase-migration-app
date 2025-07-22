/**
 * 【修正】saveRating で G列(7番目) に評価を保存
 */
function saveRating(rating) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  // G列=7番目
  sheet.getRange(lastRow, 7).setValue(rating);
  return { success: true };
}

// 一意の8桁IDを生成する関数
function generateUniqueId(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}