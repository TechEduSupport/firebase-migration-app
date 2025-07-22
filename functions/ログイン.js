// 生徒用ログインチェック
function checkStudentLogin(studentLoginId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGIN_SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentLoginId) { // A列が生徒のログインID
      if (data[i][4] !== '有効') { // E列（インデックス4）をチェック
        // ログ出力: アカウント無効
        Logger.log(`生徒ログイン失敗: ID=${studentLoginId}, 理由=アカウント無効`);
        return { success: false, message: 'このアカウントは無効になっています。' };
      }
      const teacherEmail = data[i][3]; // 教員のメールアドレスを取得
      // ログ出力: 成功
      Logger.log(`生徒ログイン成功: ID=${studentLoginId}, 教員メール=${teacherEmail}`);
      return { success: true, teacherEmail: teacherEmail };
    }
  }

  // ログ出力: IDが存在しない
  Logger.log(`生徒ログイン失敗: ID=${studentLoginId}, 理由=IDが存在しない`);
  return { success: false, message: 'このIDは存在しません。' };
}



// 先生用ログインチェック
function checkTeacherLogin(teacherLoginId, teacherPassword) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGIN_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // 入力値をトリムして文字列に変換
    const trimmedLoginId = String(teacherLoginId).trim();
    const trimmedPassword = String(teacherPassword).trim();
    
    Logger.log(`ログインID: "${trimmedLoginId}", パスワード: "${trimmedPassword}"`);

    for (let i = 1; i < data.length; i++) { // 1行目をヘッダーと仮定
      const sheetLoginId = String(data[i][0]).trim();
      const sheetPassword = String(data[i][1]).trim();
      const status = String(data[i][4]).trim(); // E列（インデックス4）
      
      Logger.log(`シートのID: "${sheetLoginId}", パスワード: "${sheetPassword}", ステータス: "${status}"`);
      
      if (sheetLoginId === trimmedLoginId && sheetPassword === trimmedPassword) {
        if (status !== '有効') {
          return { 
            success: false, 
            message: 'このアカウントは無効になっています。管理者までお問合せください。tech@ai-eva.com' 
          };
        }
        
        const name = data[i][2]; // C列
        const prompts = getPrompts(trimmedLoginId);
        
        Logger.log(`ログイン成功: 名前="${name}"`);
        return { success: true, name: name, prompts: prompts };
      }
    }
    
    Logger.log('ログイン失敗: IDまたはパスワードが一致しません');
    return { success: false, message: 'ログインに失敗しました。' };
    
  } catch (error) {
    Logger.log(`エラーが発生しました: ${error}`);
    return { success: false, message: '内部エラーが発生しました。管理者に連絡してください。' };
  }
}