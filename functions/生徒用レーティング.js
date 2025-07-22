// GPTモデル名の取得
function getGptModel() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GPT_MODEL_SHEET_NAME);
    if (!sheet) {
      console.error('Sheet not found:', GPT_MODEL_SHEET_NAME);
      return null;
    }
    const model = sheet.getRange(GPT_MODEL_CELL).getValue().trim();
    return model;
  } catch (error) {
    console.error('Error in getGptModel:', error);
    return null;
  }
}

// 採点用のGPTモデル名を取得する関数
function getGptModelForGrading() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GPT_MODEL_SHEET_NAME);
    if (!sheet) {
      console.error('Sheet not found:', GPT_MODEL_SHEET_NAME);
      return null;
    }
    const model = sheet.getRange(GPT_MODEL_CELL_FOR_GRADING).getValue().trim();
    return model;
  } catch (error) {
    console.error('Error in getGptModelForGrading:', error);
    return null;
  }
}