// 一括採点システムの機能を追加
function processTestImagesSequentially(folderId, promptId, teacherLoginId, emailAddress) {
  Logger.log('Teacher ID: ' + teacherLoginId);
  Logger.log('送信先メールアドレス: ' + emailAddress);

  if (!teacherLoginId) {
    Logger.log('エラー: 教員IDが見つかりません。ログインしてください。');
    return {
      success: false,
      message: '教員IDが見つかりません。ログインしてください。'
    };
  }

  // --- (2) 月間利用上限チェック ---
  const loginSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGIN_SHEET_NAME);
  const loginData = loginSheet.getDataRange().getValues();
  Logger.log('ログイン情報シート取得成功。データ件数: ' + loginData.length);
  Logger.log('渡された教員ID: ' + teacherLoginId);

  let targetRow = -1;
  let usageCount = 0;
  let usageLimit = null;  // R列（上限）が空の場合は制限なし

  // 教員ID（A列）を検索して usageCount(L列) と usageLimit(R列) を取得
  for (let i = 1; i < loginData.length; i++) {
    if (loginData[i][0] === teacherLoginId) {
      targetRow   = i;
      usageCount  = loginData[i][11] || 0;  // L列 (index 11)
      usageLimit  = loginData[i][17];       // R列 (index 17)
      Logger.log(`教員IDが見つかりました。行: ${i + 1}, 現在の利用回数: ${usageCount}, 上限: ${usageLimit}`);
      break;
    }
  }

  // 教員IDが見つからない場合
  if (targetRow === -1) {
    Logger.log('エラー: 教員IDがログイン情報シートに存在しません。');
    return {
      success: false,
      message: 'ログイン情報シートにこの教員IDが存在しません。'
    };
  }

  // アップロードされたファイルを取得（ソート含む）
  const childFolder = DriveApp.getFolderById(folderId);
  const filesArray = [];
  const filesIter = childFolder.getFiles();
  while (filesIter.hasNext()) {
    filesArray.push(filesIter.next());
  }
  filesArray.sort((a, b) => a.getName().toLowerCase().localeCompare(b.getName().toLowerCase()));

  const totalFiles = filesArray.length;
  Logger.log(`アップロードされたファイル数: ${totalFiles}`);

  // 上限が設定されている場合のみチェック
  if (usageLimit !== undefined && usageLimit !== null && usageLimit !== '') {
    if (usageCount + totalFiles > usageLimit) {
      Logger.log(`利用上限チェックエラー: 現在${usageCount}回 + ファイル数${totalFiles} > 上限${usageLimit}`);
      return {
        success: false,
        message: `このアカウントは月間の利用上限（${usageLimit}回）を超えるため、一括採点を実施できません。`
      };
    }
  }

  // 利用回数を加算して更新
  usageCount += totalFiles;
  loginSheet.getRange(targetRow + 1, 12).setValue(usageCount); // シートは1-indexed
  Logger.log(`利用回数を加算しました。新しい利用回数: ${usageCount}`);
  
  // --- (3) APIキー等を取得し、採点処理を続行 ---
  const apiKey      = PropertiesService.getScriptProperties().getProperty('OPENAI_KEY');
  const visionApiKey= PropertiesService.getScriptProperties().getProperty('VISION_API_KEY');
  const results     = [];
  
  // このバッチ処理の一意ID(ログ管理やファイル管理に使用)
  const batchId = generateUniqueId(8);
  
  // 教員が登録した採点基準（プロンプト）を取得
  // ※ getPromptText(promptId) で PROMPT_SHEET_NAME を検索し、C列などにある基準文を取得
  const teacherPrompt = getPromptText(promptId);
  
  // 一括採点用に、JSON形式でのスキーマを案内するデフォルトプロンプト
  const defaultPrompt = `
次は生徒の答案用紙をOCRで書き起こしたものです。**以下の採点基準に厳格に従って**JSON形式で採点結果を出力してください。
出力形式は以下のようにしてください。前置きは不要です。
採点結果に日本人学生向けの解説を含めてください。

{
  "出席番号": クラスや出席番号（クラス名が漢字の場合や、出席番号のみの場合もあります）,
  "氏名": "テキスト",
  "採点結果": "テキストベースの採点詳細",
  "最終スコア": 整数
}

採点基準:
${teacherPrompt}
  `;
  
  // 結果書き込み用スプレッドシート
  const resultSheet = SpreadsheetApp.openById(RESULT_SPREADSHEET_ID).getSheetByName(RESULT_SHEET_NAME);
  if (resultSheet.getLastRow() === 0) {
    // 初回ヘッダーがない場合のみ追加
    resultSheet.appendRow([
      'ID',              // A
      'タイムスタンプ',  // B
      'プロンプト番号',  // C
      '画像URL',         // D
      '出席番号',        // E
      '氏名',            // F
      '採点結果',        // G
      '点数',            // H
      '全体の結果',      // I
      '文字起こし',      // J
      'OCRテキスト'      // K
    ]);
  }
  
  // DOCXエクスポート用フォルダを生成
  const docFolderId = createDocFolder(batchId);
  
  Logger.log('一括採点を開始します...');
  Logger.log(`Batch ID: ${batchId}, 教員ID: ${teacherLoginId}`);
  
  // ─────────────────────────────────────
  // ステップ1: Google Vision で OCR
  // ─────────────────────────────────────
  const ocrResults = [];
  const ocrErrors  = [];
  
  for (let i = 0; i < totalFiles; i++) {
    const file = filesArray[i];
    try {
      const imageBlob = file.getBlob();
      const text = getTextFromImage(imageBlob, visionApiKey);  // Vision API呼び出し（別途定義の関数）
      ocrResults.push(text);
      ocrErrors.push(false);
    } catch (e) {
      Logger.log(`OCRエラー (${i+1}/${totalFiles}): ${file.getName()} - ${e.message}`);
      ocrResults.push('');
      ocrErrors.push(true);
    }
  }
  
  // ─────────────────────────────────────
  // ステップ2: GPTに文字起こしを並列依頼
  // ─────────────────────────────────────
  const transcriptionRequests = [];
  for (let i = 0; i < totalFiles; i++) {
    if (ocrErrors[i]) {
      transcriptionRequests.push(null); // OCR失敗の場合はスキップ
      continue;
    }
    
    const file = filesArray[i];
    const imageBlob = file.getBlob();
    const base64Image = Utilities.base64Encode(imageBlob.getBytes());
    
    // 文字起こしGPT用プロンプト
const transcriptionPrompt = `
次の手書き文字を文字起こししてください。

- **スペリング**：***誤字の補正は絶対に行わず***、以下に示す Google Cloud Vision の文字起こし結果のスペリングをそのまま使用してください。  
- **文脈と構造**：文章の構造や文脈の理解はあなたの能力を活用し、適切に再現してください。不要な改行は削除してください。

**Google Cloud Vision の文字起こし結果：**

\`\`\`
${ocrResults[i]}
\`\`\`
`;
    
    const transcriptionRequestBody = {
      "model": getGptModel(),
      "messages": [
        {
          "role": "user",
          "content": [
            { "type": "text", "text": transcriptionPrompt },
            { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      "max_tokens": 15000,
      "temperature": 0
    };
    
    const transcriptionOption = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': { 'Authorization': 'Bearer ' + apiKey },
      'payload': JSON.stringify(transcriptionRequestBody),
      'muteHttpExceptions': true
    };
    
    transcriptionRequests.push({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'post',
      headers: transcriptionOption.headers,
      payload: transcriptionOption.payload,
      muteHttpExceptions: true,
      contentType: transcriptionOption.contentType
    });
  }
  
  // fetchAll で一括送信（並列実行）
  const transcriptionResponses = UrlFetchApp.fetchAll(
    transcriptionRequests.map(req => req ? req : { url:'', muteHttpExceptions:true })
  );
  
  const transcriptionResults = [];
  const transcriptionErrors  = [];
  
  for (let i = 0; i < totalFiles; i++) {
    if (ocrErrors[i] || transcriptionRequests[i] === null) {
      transcriptionResults.push('');
      transcriptionErrors.push(true);
      continue;
    }
    
    const response    = transcriptionResponses[i];
    const responseCode= response.getResponseCode();
    const responseText= response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log(`文字起こしエラー (${i+1}/${totalFiles}): ${filesArray[i].getName()} - ${responseCode} - ${responseText}`);
      transcriptionResults.push('');
      transcriptionErrors.push(true);
      continue;
    }
    
    try {
      const transcriptionResponseBody = JSON.parse(responseText);
      if (!transcriptionResponseBody.choices || !transcriptionResponseBody.choices[0]) {
        Logger.log(`文字起こしエラー (${i+1}/${totalFiles}): ${filesArray[i].getName()} - 応答形式不正`);
        transcriptionResults.push('');
        transcriptionErrors.push(true);
        continue;
      }
      // 結果テキスト
      const transcription = transcriptionResponseBody.choices[0].message.content.trim();
      transcriptionResults.push(transcription);
      transcriptionErrors.push(false);
    } catch (parseError) {
      Logger.log(`文字起こしパースエラー (${i+1}/${totalFiles}): ${filesArray[i].getName()} - ${parseError.message}`);
      transcriptionResults.push('');
      transcriptionErrors.push(true);
    }
  }
  
  // ─────────────────────────────────────
  // ステップ3: GPTで採点を並列依頼
  // ─────────────────────────────────────
  const gradingRequests = [];
  for (let i = 0; i < totalFiles; i++) {
    if (ocrErrors[i] || transcriptionErrors[i]) {
      gradingRequests.push(null);
      continue;
    }
    
    const transcription = transcriptionResults[i];
    const systemMessage = {
      "role": "system",
      "content": "あなたは優秀な採点者です。出力は指定のJSON形式で行い、マークダウン記法は使用しないでください。"
    };
    const userMessage = {
      "role": "user",
      "content": defaultPrompt + "\n\n生徒の答案:\n" + transcription
    };
    
    const gradingRequestBody = {
      "model": getGptModelForGrading(),
      "messages": [systemMessage, userMessage],
      "max_completion_tokens": 15000,
      "reasoning_effort": 'high'
    };
    
    const gradingOption = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': { 'Authorization': 'Bearer ' + apiKey },
      'payload': JSON.stringify(gradingRequestBody),
      'muteHttpExceptions': true
    };
    
    gradingRequests.push({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'post',
      headers: gradingOption.headers,
      payload: gradingOption.payload,
      muteHttpExceptions: true,
      contentType: gradingOption.contentType
    });
  }
  
  const gradingResponses = UrlFetchApp.fetchAll(
    gradingRequests.map(req => req ? req : { url:'', muteHttpExceptions:true })
  );
  
  const gradingData = [];
  for (let i = 0; i < totalFiles; i++) {
    const file = filesArray[i];
    const count = i + 1;
    
    let gradingResults = '';
    let gptErrorMsg    = '';
    let rowData        = null;
    
    // もしOCR or 文字起こしで失敗していたら、その時点で採点不能
    if (ocrErrors[i]) {
      gptErrorMsg = 'OCRに失敗しました。';
    } else if (transcriptionErrors[i]) {
      gptErrorMsg = '文字起こしに失敗しました。';
    } else {
      // GPT採点APIのレスポンスチェック
      const response = gradingRequests[i] ? gradingResponses[i] : null;
      if (!response || response.getResponseCode() !== 200) {
        gptErrorMsg = response
          ? `OpenAI API Error: ${response.getResponseCode()} - ${response.getContentText()}`
          : '採点要求が行われませんでした。';
      } else {
        const responseText = response.getContentText();
        try {
          const gradingResponseBody = JSON.parse(responseText);
          if (!gradingResponseBody.choices || !gradingResponseBody.choices[0]) {
            gptErrorMsg = '採点の応答が不正です。';
          } else {
            let gradingContent = gradingResponseBody.choices[0].message.content.trim();
            // マークダウンを除去
            gradingContent = removeMarkdown(gradingContent);
            
            // JSON形式を抽出
            const firstBraceIndex = gradingContent.indexOf('{');
            const lastBraceIndex  = gradingContent.lastIndexOf('}');
            if (firstBraceIndex === -1 || lastBraceIndex === -1) {
              gptErrorMsg = 'JSON形式が確認できません。';
            } else {
              const jsonString = gradingContent.substring(firstBraceIndex, lastBraceIndex + 1);
              try {
  const gradingJson = JSON.parse(jsonString);
  
  // 整形済みの文字列を生成
  gradingResults = formatGradingResult(gradingJson);

  // スプレッドシート用データ取得
  const parsedResult = parseGptResult(gradingJson);

  rowData = [
    batchId,
    new Date(),
    promptId,
    file.getUrl(),
    parsedResult.studentNumber,
    parsedResult.studentName,
    parsedResult.gradingDetail,
    parsedResult.finalScore,
    gradingResults,             // 修正後の gradingResults
    transcriptionResults[i],
    ocrResults[i]
  ];
} catch (parseError) {
  Logger.log(`採点パースエラー (${i+1}/${totalFiles}): ${file.getName()} - ${parseError.message}`);
  gptErrorMsg = 'JSONパースに失敗しました。';
}

            }
          }
        } catch (parseError) {
          gptErrorMsg = `採点結果解析中にエラー: ${parseError.message}`;
        }
      }
    }
    
    // 結果を行に反映
    if (!gptErrorMsg && rowData) {
      // 成功
      resultSheet.appendRow(rowData);
      // DOCX 生成用の情報
      gradingData.push({
        imageUrl:       rowData[3],
        studentNumber:  rowData[4],
        studentName:    rowData[5],
        gradingResults: rowData[8],
        docFolderId:    docFolderId,
        uniqueId:       count
      });
      results.push({ fileName: file.getName(), message: '採点成功', progress: `${count}/${totalFiles}` });
    } else {
      // 失敗時
      const dataRow = [
        batchId,
        new Date(),
        promptId,
        file.getUrl(),
        '', // 出席番号
        '', // 氏名
        gptErrorMsg, // 採点結果欄にエラーメッセージ
        '', // 点数
        '', // 全体の結果
        transcriptionResults[i], // 文字起こし
        ocrResults[i]            // OCRテキスト
      ];
      resultSheet.appendRow(dataRow);
      results.push({ fileName: file.getName(), message: gptErrorMsg, progress: `${count}/${totalFiles}` });
    }
  }
  
  // ─────────────────────────────────────
  // ステップ4: DOCXエクスポート & ZIP化
  // ─────────────────────────────────────
  const zipResult = createDocumentsBatch(gradingData, docFolderId);

  if (zipResult.success) {
    // 採点結果のダウンロードリンクをメールで通知
    // ▼ 第4引数として入力された emailAddress を渡す
    sendResultEmail(teacherLoginId, zipResult.downloadUrl, false, emailAddress);
    return {
      success: true,
      downloadUrl: zipResult.downloadUrl,
      results: results,
      usageCount: usageCount,
      usageLimit: usageLimit
    };
  } else {
    Logger.log('全体処理エラー: ZIP作成に失敗');
    sendResultEmail(teacherLoginId, '', true, emailAddress);
    return {
      success: false,
      message: '採点処理中にエラーが発生しました。'
    };
  }
}

/**
 * 採点結果のJSONを整形済みテキストに変換する関数（出席番号と氏名は含めない）
 * @param {Object} gradingJson - 採点結果のJSONオブジェクト
 * @return {String} 読みやすい採点結果の文字列
 */
function formatGradingResult(gradingJson) {
  if (!gradingJson || typeof gradingJson !== 'object') {
    return "採点結果がありません。";
  }

  const gradingDetail = gradingJson['採点結果'] || 'なし';
  const finalScore    = gradingJson['最終スコア'] || 'なし';

  return `【採点結果】
${gradingDetail}

最終スコア：${finalScore} 点`;
}


// JSON前提のparseGptResult関数
function parseGptResult(gradingJson) {
    const studentNumber = gradingJson['出席番号'] || '';
    const studentName = gradingJson['氏名'] || '';
    const gradingDetail = gradingJson['採点結果'] || '';
    const finalScore = gradingJson['最終スコア'] || '';

    Logger.log(`Parsed Data - Student Number: ${studentNumber}, Name: ${studentName}, Grading Detail: ${gradingDetail}, Final Score: ${finalScore}`);
    return {
        studentNumber: studentNumber,
        studentName: studentName,
        gradingDetail: gradingDetail,
        finalScore: finalScore
    };
}

// スプレッドシートに結果を記録する関数
function recordResultInSpreadsheet(resultArray, promptId, imageUrl, batchId) {
    const sheet = SpreadsheetApp.openById(RESULT_SPREADSHEET_ID).getSheetByName(RESULT_SHEET_NAME);
    const timestamp = new Date();  // タイムスタンプ

    // シートにヘッダーがない場合は追加（既にprocessTestImagesSequentially内で追加しているため不要かもしれません）
    /*
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID', 'タイムスタンプ', 'プロンプト番号', '画像URL', '出席番号', '氏名', '採点結果', '点数', '全体の結果']);
    }
    */

    // resultArrayには {studentNumber, studentName, gradingDetail, finalScore} が含まれる
    // また、gptResultFull は JSON 文字列
    const rowData = [
        batchId,
        timestamp,
        promptId,
        imageUrl,
        resultArray.studentNumber,
        resultArray.studentName,
        resultArray.gradingDetail,
        resultArray.finalScore,
        resultArray.gptResultFull,
        resultArray.transcription,
        resultArray.ocrText
    ];

    Logger.log('Writing row to spreadsheet: ' + rowData.join(', '));  // 書き込むデータのログを確認

    resultSheet.appendRow(rowData);

    return rowData;
}