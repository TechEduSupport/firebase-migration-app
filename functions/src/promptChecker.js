// functions/src/promptChecker.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");

/**
 * AIが採点基準の矛盾・曖昧さをチェックする (v2形式)
 */
exports.checkPromptConsistency = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
  // 認証済みユーザーか確認
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'この機能の利用には認証が必要です。');
  }

  const { promptText, promptNote, promptVisibility } = request.data;
  const apiKey = process.env.OPENAI_KEY;

  if (!apiKey) {
    logger.error("OPENAI_KEYが設定されていません。");
    throw new HttpsError('internal', 'サーバー側でAPIキーが設定されていません。');
  }
  
  const systemMessage = {
    "role": "system",
    "content": `あなたは採点基準の品質を評価する専門家です。
以下の採点基準は、OCRで書き起こした答案テキストに基づいてAIが採点するためのものです。そのため、文字の外観的な特徴（例：トメ、ハネ、ハライ）や、グラフ、図、イラストなどの視覚的要素は一切採点できません。

以下の4つの観点で採点基準を厳しく評価してください。
1.  **【矛盾】**: 基準内に論理的な矛盾はありませんか？
2.  **【曖昧さ】**: 複数の解釈ができてしまう曖昧な表現はありませんか？
3.  **【視覚的要素】**: 採点不可能な「視覚的要素」に関する記述は含まれていませんか？含まれている場合は、その部分を採点基準から削除するように強く指示してください。
4.  **【具体性と十分性】**: 第三者が客観的に採点できるほど具体的ですか？また、採点基準として十分な情報量がありますか？意味をなさない文字列（例：「aa」「あいうえお」）や、内容が著しく乏しい場合は「不十分である」と判断してください。

評価の結果、すべての観点で問題がなければ「この採点基準に問題は見つかりませんでした。」とだけ回答してください。
一つでも問題がある場合は、どの観点で問題があるのかを具体的に指摘し、ユーザーが何をすべきかを明確に指示した上で、最後に修正案（完全版の採点基準）を提示してください。
また、「この画像は～」などの前置きがあれば削除してください。`
  };

  const userMessage = {
    "role": "user",
    "content": "【採点基準タイトル】\n" + promptNote + "\n\n" +
               "【生徒用ページでの表示】\n" + (promptVisibility ? '表示' : '非表示') + "\n\n" +
               "【採点基準内容】\n" + promptText
  };

  const requestBody = {
    "model": "gpt-5-2025-08-07",
    "messages": [systemMessage, userMessage],
    "max_completion_tokens": 1500,
    "reasoning_effort": "medium", 
    "verbosity": "medium" 
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return { result: response.data.choices[0].message.content };
    } else {
      throw new HttpsError('internal', 'AIからの応答が予期しない形式です。');
    }

  } catch (error) {
    logger.error("OpenAI API Error:", error.response ? error.response.data : error.message, error);
    throw new HttpsError('internal', 'AIとの通信に失敗しました。');
  }
});