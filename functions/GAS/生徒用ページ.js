function getTeacherPrompts(loginId) {
   if (!loginId) return { success: false };
   const prompts = getPrompts(loginId);
   return { success: true, loginId: loginId, prompts: prompts };
}

// 生徒用ページに渡すプロンプト一覧を取得する関数
function getPromptIdsForStudent(loginId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROMPT_SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const list  = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(loginId).trim() && data[i][4] !== '非表示') {
      
      const fileId = data[i][6]; // G列からファイルIDを取得
      let fileData = ''; // 画像のBase64データまたはPDFのURLを格納
      let fileType = ''; // 'image' または 'pdf'

      if (fileId) {
        try {
          const file = DriveApp.getFileById(fileId);
          const mimeType = file.getMimeType();

          if (mimeType.startsWith('image/')) {
            // ★ファイルが画像の場合、Base64文字列に変換
            fileType = 'image';
            fileData = Utilities.base64Encode(file.getBlob().getBytes());
          } else if (mimeType === MimeType.PDF) {
            // ★ファイルがPDFの場合、プレビュー用URLを生成（PDFはBase64にすると重すぎるため）
            fileType = 'pdf';
            fileData = 'https://drive.google.com/file/d/' + fileId + '/preview';
          }
        } catch (e) {
          console.error('DriveAppでのファイル取得/変換に失敗: ' + e.toString());
        }
      }

      list.push({
        id:       data[i][1],
        note:     data[i][3],
        question: data[i][5],
        fileData: fileData, // ★URLではなく、Base64データまたはPDF用URLを渡す
        fileType: fileType
      });
    }
  }
  return list;
}