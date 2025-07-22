
/**
 * 採点基準の矛盾・曖昧さチェックを行うサーバーサイド関数
 * @param {Object} data - クライアントから送信されたデータ（promptText, promptNote, promptVisibility）
 * @return {string} チェック結果のテキスト
 */
function checkPromptServer(data) {
  // OpenAIのAPIキー取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_KEY');
  if (!apiKey) {
    throw new Error("OPENAI_KEY が設定されていません。");
  }
  
  // 採点基準のチェックに特化したシステムメッセージを定義
  const systemMessage = {
    "role": "system",
    "content": "あなたは採点基準の矛盾や曖昧さを検出する専門家です。以下の採点基準は、OCRで書き起こした答案テキストに基づいて採点するためのものです。そのため、文字の外観的な特徴（例：トメ、ハネ、ハライ）や、グラフ、図、イラストなどの視覚的要素は一切採点不可となります。もし、採点基準にそれらの視覚的要素に関する記述が含まれている場合は、ユーザーにそれらを除外するよう指示し、基準を修正するよう促してください（視覚的要素に関する部分は完全に削除しても構いません）。採点基準に問題がなければ「矛盾や曖昧さはありません」と回答し、問題がある場合は具体的な箇所を指摘した上で、最後に修正案（完全版）を提示してください。また、「この画像は～」などの前置きがあれば削除してください。"
  };
  
  // ユーザーから受け取った採点基準情報を含むユーザーメッセージ
  const userMessage = {
    "role": "user",
    "content": "【採点基準タイトル】\n" + data.promptNote + "\n\n" +
               "【生徒用ページでの表示】\n" + data.promptVisibility + "\n\n" +
               "【採点基準内容】\n" + data.promptText
  };

  // Chat API へのリクエストボディ
  const requestBody = {
    "model": getGptModelForGrading(),
    "messages": [systemMessage, userMessage],
    "max_completion_tokens": 15000,
    "reasoning_effort": "high"
  };

  // リクエストオプション設定
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': { 'Authorization': 'Bearer ' + apiKey },
    'payload': JSON.stringify(requestBody),
    'muteHttpExceptions': true
  };

  // OpenAI Chat API へリクエスト送信
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = UrlFetchApp.fetch(url, options);

  // ステータスコードが200の場合、結果を返す
  if (response.getResponseCode() === 200) {
    const json = JSON.parse(response.getContentText());
    // 応答が複数候補の場合、最初の候補のメッセージを返す
    return json.choices[0].message.content;
  } else {
    // エラー時はエラーメッセージを投げる
    throw new Error("OpenAI API Error: " + response.getContentText());
  }
}