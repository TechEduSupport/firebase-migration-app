
(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="gVj0mY9ip76Cl5QuzfMvM";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();


    function showTopPage() {
      document.getElementById('student-login').style.display = 'none';
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('student-page').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'none';
      document.getElementById('bulk-grading-page').style.display = 'none';
      document.getElementById('top-page').style.display = 'block';

      // トップページではログアウトボタンを非表示にする
      document.querySelectorAll('.logout-container').forEach(function(container) {
        container.style.display = 'none';
      });
    }

    function showStudentLogin() {
      document.getElementById('top-page').style.display = 'none';
      document.getElementById('student-login').style.display = 'block';
    }

    function showTeacherLogin() {
      document.getElementById('top-page').style.display = 'none';
      document.getElementById('teacher-login').style.display = 'block';
    }



    // 生徒用ログイン関数
function checkStudentLogin() {
  const studentLoginId = document.getElementById('studentLoginId').value;
  const loginButton = document.querySelector('#student-login .login-button');
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true; // 防止二重クリック
  google.script.run.withSuccessHandler(function(result) {
    if (result.success) {
      document.getElementById('student-login').style.display = 'none';
      document.getElementById('student-page').style.display = 'block';
      // ログアウトボタン表示
      document.querySelector('#student-page .logout-container').style.display = 'block';
      loadPromptIds(studentLoginId);
      // 利用回数を更新（生徒用は担当教員のIDを使用）
    } else {
      document.getElementById('studentLoginMessage').innerText = result.message || 'ログインに失敗しました。';
    }
    loginButton.innerText = 'ログイン';
    loginButton.disabled = false;
  }).checkStudentLogin(studentLoginId);
}


// グローバル変数として、先生のログインIDを保持する
let globalTeacherId = null;

/**
 * 【Firebase版】先生用ログイン関数
 */
function checkTeacherLogin() {
  const email = document.getElementById('teacherLoginId').value;
  const password = document.getElementById('teacherPassword').value;
  const loginButton = document.querySelector('#teacher-login .login-button');
  const messageElement = document.getElementById('teacherLoginMessage');

  messageElement.innerText = '';
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true;

  // Firebase Auth を使ってメール・パスワードでログイン
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // ログイン成功時の処理
      const user = userCredential.user;
      console.log('Firebaseログイン成功:', user.email);

      globalTeacherId = user.email;

      // 画面を先生用ページに切り替え
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'block';

      // ユーザー情報を表示（仮）
      document.getElementById('teacherName').innerText = `ようこそ、${user.email}さん`;
      document.getElementById('displayedLoginId').innerText = user.email;
      document.getElementById('displayedPassword').innerText = '********';

      // ログアウトボタンを表示
      document.querySelector('#teacher-page .logout-container').style.display = 'block';

      // TODO: 次のステップで、Firestoreからプロンプトやお知らせを取得する処理を追加します
      populatePromptTable([]); // 今は空のテーブルを表示
      document.getElementById('announcement-text').textContent = "現在お知らせはありません。";
      
    })
    .catch((error) => {
      // ログイン失敗時の処理
      console.error('Firebaseログインエラー:', error.code, error.message);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        messageElement.innerText = 'メールアドレスまたはパスワードが間違っています。';
      } else {
        messageElement.innerText = 'ログインに失敗しました。管理者に連絡してください。';
      }
    })
    .finally(() => {
      // 成功・失敗どちらの場合でもボタンの状態を元に戻す
      loginButton.innerText = 'ログイン';
      loginButton.disabled = false;
    });
}

/**
 * 指定の教員IDの利用回数情報をサーバ側から取得し、#usageCountDisplay に表示する
 */
function updateUsageCount(teacherId) {
  google.script.run.withSuccessHandler(function(result) {
    if (result) {
      // 上限が設定されていればその数値、空なら「無制限」と表示
      let usageLimitText = (result.usageLimit !== undefined && result.usageLimit !== null && result.usageLimit !== '')
                             ? result.usageLimit + "回" : "無制限";
      document.getElementById("usageCountDisplay").textContent =
        "現在の利用回数: " + result.usageCount + "／" + usageLimitText;
    }
  }).getUsageCount(teacherId);
}


// 問題マスタを保持
let problemDict = {};

// 生徒用プロンプト ID 読み込み
function loadPromptIds(loginId) {
  google.script.run.withSuccessHandler(function(prompts) {
    const sel = document.getElementById('promptId');
    sel.innerHTML = '';
    problemDict = {};

    prompts.forEach(p => {
      const opt   = document.createElement('option');
      opt.value   = p.id;
      opt.text    = `${p.id} - ${p.note}`;
      sel.add(opt);
      
      // ★question, fileData, fileTypeをセットで保存
      problemDict[p.id] = {
        question: p.question,
        fileData: p.fileData, // fileUrlからfileDataに変更
        fileType: p.fileType
      };
    });

    showProblemText();
  }).getPromptIdsForStudent(loginId); 
}

// 問題文とファイル（画像/PDF）の表示
function showProblemText() {
  const pid   = document.getElementById('promptId').value;
  const problemData = problemDict[pid] || { question: '', fileData: '', fileType: '' };

  const questionArea = document.getElementById('problem-area');
  const questionText = document.getElementById('problem-text');
  const questionImage = document.getElementById('problem-image');
  // ★PDFの表示/非表示は、iframe本体ではなくコンテナ(div)を制御する
  const questionPdfContainer = document.getElementById('pdf-container'); 
  const questionPdf = document.getElementById('problem-pdf');

  const hasText = problemData.question && problemData.question.trim() !== '';
  const hasFile = problemData.fileData && problemData.fileData.trim() !== '';

  if (!hasText && !hasFile) {
    questionArea.style.display = 'none';
    return;
  }
  
  questionArea.style.display = 'block';

  questionText.style.display = hasText ? 'block' : 'none';
  if (hasText) {
    questionText.innerHTML = escapeHtml(problemData.question).replace(/\n/g,'<br>');
  }
  
  // ファイルの種類に応じた処理
  if (hasFile && problemData.fileType === 'image') {
    questionImage.src = "data:image/jpeg;base64," + problemData.fileData;
    questionImage.style.display = 'block';
    questionPdfContainer.style.display = 'none'; // PDFコンテナは非表示
  } else if (hasFile && problemData.fileType === 'pdf') {
    questionPdf.src = problemData.fileData;
    questionPdfContainer.style.display = 'block'; // ★PDFコンテナを表示
    questionImage.style.display = 'none';
  } else {
    questionImage.style.display = 'none';
    questionPdfContainer.style.display = 'none'; // PDFコンテナは非表示
  }
}
/**
 * 文字列に含まれるHTML特殊文字をエスケープ（無害化）する関数
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
}

    function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file || !['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        document.getElementById('studentMessage').innerText = 'JPG、JPEG、PNG形式の画像のみがアップロード可能です。';
        document.getElementById('submit-button').disabled = true;
        return;
      } else {
        document.getElementById('studentMessage').innerText = '';
        document.getElementById('submit-button').disabled = false;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const grayscale = r * 0.3 + g * 0.59 + b * 0.11;
            data[i] = grayscale;
            data[i + 1] = grayscale;
            data[i + 2] = grayscale;
          }

          ctx.putImageData(imageData, 0, 0);

          // 70%の圧縮率で画像をデータURLに変換
          window.grayscaleImageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }



  // 解答ソースの選択
let answerMode = 'image';   // 'image' or 'text'

function selectAnswerMode(mode) {
  answerMode = mode;

  // ボタン見た目
  document.getElementById('btn-image')
          .classList.toggle('active', mode === 'image');
  document.getElementById('btn-text')
          .classList.toggle('active', mode === 'text');

  // 入力エリア切替
  document.getElementById('image-input-area').style.display    = (mode === 'image' ? 'block' : 'none');
  document.getElementById('text-input-area').style.display     = (mode === 'text' ? 'block' : 'none');
  document.getElementById('image-instructions').style.display  = (mode === 'image' ? 'block' : 'none');

  enableSubmitButton();
}


function enableSubmitButton() {
  const hasNameOrNumber = (
    document.getElementById('studentName').value.trim()   !== '' ||
    document.getElementById('studentNumber').value.trim() !== ''
  );
  const hasImage = (answerMode === 'image' && window.grayscaleImageData);
  const hasText  = (answerMode === 'text' && 
                    document.getElementById('textAnswer').value.trim() !== '');
  document.getElementById('submit-button').disabled = !(
    hasNameOrNumber && (answerMode === 'image' ? hasImage : hasText)
  );
}



// ————————————————
// 課題送信ボタン処理
// ————————————————
function submitReport() {
  const studentName   = document.getElementById('studentName').value.trim();
  const studentNumber = document.getElementById('studentNumber').value.trim();
  const promptId      = document.getElementById('promptId').value;
  const teacherId     = document.getElementById('studentLoginId').value;

  // 氏名 or 出席番号が必須
  if (!studentName && !studentNumber) {
    showMessage('氏名または出席番号を入力してください。');
    return;
  }

  // モード別入力チェック
  if (answerMode === 'image' && !window.grayscaleImageData) {
    showMessage('画像をアップロードしてください。');
    return;
  }
  if (answerMode === 'text' &&
      document.getElementById('textAnswer').value.trim() === '') {
    showMessage('テキストを入力してください。');
    return;
  }

  // ローディング表示 & ボタン無効化
  document.getElementById('loading-overlay').style.display = 'flex';
  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;

  // 送信パラメータ
  const imageData    = (answerMode === 'image') ? window.grayscaleImageData : '';
  const textAnswer   = (answerMode === 'text')  ? document.getElementById('textAnswer').value.trim() : '';
  const problemText  = document.getElementById('problem-text').innerText.trim(); // ★ 問題文を取得

  // Apps Script 実行
  google.script.run
    .withSuccessHandler(function(response) {
      // Markdown を HTML に変換して表示
      document.getElementById('studentMessage').innerHTML = parseMarkdown(response.message);
      document.getElementById('studentMessage').style.display = 'block';

      // ボタン・オーバーレイ制御
      submitButton.style.display = 'none';
      document.getElementById('loading-overlay').style.display = 'none';

      // 評価セクション表示
      document.getElementById('rating-section').style.display = 'block';
      document.getElementById('rating').value = '5';
      document.getElementById('submit-rating-button').disabled = false;
    })
    .withFailureHandler(function(error) {
      console.error(error);
      document.getElementById('studentMessage').innerText = 'エラーが発生しました。もう一度お試しください。';
      document.getElementById('studentMessage').style.display = 'block';
      document.getElementById('loading-overlay').style.display = 'none';
      submitButton.disabled = false;
    })
    .submitReport(
      teacherId,
      imageData,
      studentName,
      promptId,
      studentNumber,
      textAnswer,
      problemText // ★ 取得した問題文を引数に追加
    );
}

/**
 * Markdown文字列をHTMLに変換する関数（クライアントサイド）
 * 実装例：
 *  - marked.js（CDN読み込み）を使う場合: return marked(text);
 *  - あるいは自力で簡易的にパースする場合は独自実装
 */
function parseMarkdown(text) {
  // marked.jsが読み込まれている想定であれば:
  if (window.marked) {
    return marked.parse(text);
  } else {
    // marked.jsがない場合はそのままプレーンテキストを返す（暫定的な例）
    // 可能であればCDN等でmarked.jsを読み込んで利用してください。
    return text
      .replace(/\n/g, '<br>'); // 簡易的に改行だけHTML変換
  }
}

    function submitRating() {
      const rating = document.getElementById('rating').value;

      google.script.run.withSuccessHandler(function(response) {
        alert('採点精度の評価が送信されました。');
        document.getElementById('rating-section').style.display = 'none'; // 評価セクションを非表示にする
      }).saveRating(rating);
    }

// 生徒用ページフォームのリセット
function resetForm() {
  document.getElementById('promptId').selectedIndex = 0;
  document.getElementById('uploadImage').value = '';
  window.grayscaleImageData = null;
  document.getElementById('studentMessage').innerText = '';
  document.getElementById('textAnswer').value = ''; // ★解答テキストエリアをリセット

  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;
  submitButton.style.display = 'block'; 
  submitButton.innerText = '送信'; // ボタンテキストを「送信」に戻す

  const ratingButton = document.getElementById('submit-rating-button');
  ratingButton.disabled = true; // 評価ボタンを無効化
  ratingButton.style.backgroundColor = '#d3d3d3'; 
  ratingButton.style.color = '#999'; 

  document.getElementById('rating-section').style.display = 'none'; // 評価セクションを非表示にする

  // ★問題IDが先頭に戻ったことに伴い、問題文表示も更新する
  showProblemText();
}

    function showMessage(message) {
      const messageElement = document.createElement('div');
      messageElement.innerText = message;
      messageElement.style.position = 'fixed';
      messageElement.style.top = '20px';
      messageElement.style.left = '50%';
      messageElement.style.transform = 'translateX(-50%)';
      messageElement.style.backgroundColor = '#333';
      messageElement.style.color = '#fff';
      messageElement.style.padding = '10px 20px';
      messageElement.style.borderRadius = '5px';
      messageElement.style.zIndex = '3000';
      document.body.appendChild(messageElement);
      setTimeout(function() {
        document.body.removeChild(messageElement);
      }, 3000);
    }


// プロンプトテーブルを生成する関数
function populatePromptTable(prompts) {
  const table = document.getElementById('promptTable');
  // 7列のヘッダーを生成
  table.innerHTML = `
    <tr>
      <th style="width: 8%;">ID</th>
      <th style="width: 15%;">タイトル</th>
      <th style="width: 8%;">表示</th>
      <th style="width: 24%;">問題文</th>
      <th style="width: 20%;">採点基準</th>
      <th style="width: 10%;">画像/PDF ID</th>
      <th style="width: 15%;">操作</th>
    </tr>`;

  prompts.forEach(function(prompt) {
    const row = table.insertRow();
    row.id = 'promptRow' + prompt.id;

    // 6列分のデータを表示
    row.insertCell(0).innerText = prompt.id;
    row.insertCell(1).innerText = prompt.note;
    row.insertCell(2).innerText = prompt.visibility || '表示';
    row.insertCell(3).innerText = prompt.question || '';
    row.insertCell(4).innerText = prompt.text;
    row.insertCell(5).innerText = prompt.imageFileId || '';
    
    // 7列目に操作ボタンを配置
    const actionCell = row.insertCell(6);
    
    // 編集ボタン
    const editButton = document.createElement('button');
    editButton.innerText = '編集';
    editButton.classList.add('edit');
    editButton.onclick = function() {
      // ★デバッグ用ログ1：渡す直前のpromptオブジェクトの中身を確認
      console.log("「編集」ボタンクリック。渡す直前のpromptオブジェクト:", prompt);
      
      // promptオブジェクトが持つ全ての情報を引数として渡す
      editPrompt(
        prompt.id,
        prompt.text,
        prompt.note,
        prompt.visibility,
        prompt.question,
        prompt.imageFileId,
        row
      );
    };
    
    // 削除ボタン
    const deleteButton = document.createElement('button');
    deleteButton.innerText = '削除';
    deleteButton.classList.add('delete');
    deleteButton.onclick = function() { deletePrompt(prompt.id); };
    
    // 結果表示ボタン
    const resultButton = document.createElement('button');
    resultButton.innerText = '結果を表示';
    resultButton.classList.add('result');
    resultButton.onclick = function() { showResults(resultButton, prompt.id); };

    // セルに各ボタンを追加
    actionCell.appendChild(editButton);
    actionCell.appendChild(deleteButton);
    actionCell.appendChild(resultButton);
  });
}


  // 結果を表示する関数
  function showResults(button, promptId) {
    google.script.run.withSuccessHandler(function(results) {
      // results は JSON文字列。パースして配列に
      const parsed = JSON.parse(results);
      if (parsed && Array.isArray(parsed)) {
        // プロンプトの行を取得
        const promptRow = document.getElementById('promptRow' + promptId);

        // 既に結果の行が存在するか確認
        let resultsRow = document.getElementById('resultsRow' + promptId);
        if (!resultsRow) {
          // プロンプトの次の行に結果を表示する行を挿入
          resultsRow = promptRow.parentNode.insertRow(promptRow.rowIndex + 1);
          resultsRow.id = 'resultsRow' + promptId;
          const cell = resultsRow.insertCell(0);

          // テーブルの列数に合わせてcolSpanを修正
          // 今回、表示列が6列(タイムスタンプ, 出席番号+氏名, プロンプトID, 合計点, 画像URL, 回答)なので6
          cell.colSpan = 6;

          const resultDisplay = document.createElement('div');
          resultDisplay.classList.add('result-display');

          // 表を作成
          const table = document.createElement('table');
          table.style.width = '100%';

          // テーブルヘッダー
          const thead = document.createElement('thead');
          thead.innerHTML = `
            <tr>
              <th style="width: 15%;">タイムスタンプ</th>
              <th style="width: 15%;">出席番号 / 氏名</th>
              <th style="width: 10%;">採点基準ID</th>
              <th style="width: 10%;">合計点</th>
              <th style="width: 15%;">画像URL</th>
              <th style="width: 35%;">回答</th>
            </tr>
          `;
          table.appendChild(thead);

          // テーブルボディ
          const tbody = document.createElement('tbody');
          parsed.forEach(function(result) {
            const tr = document.createElement('tr');
            // 出席番号を氏名の左側にまとめて表示
            const displayName = (result.studentNumber ? result.studentNumber + ' ' : '') + (result.name || '');

            tr.innerHTML = `
              <td>${result.timestamp || ''}</td>
              <td>${displayName}</td>
              <td>${result.promptId || ''}</td>
              <td>${result.totalScore || ''}</td>
              <td><a href="${result.imageUrl || '#'}" target="_blank">画像リンク</a></td>
              <td>${result.response || ''}</td>
            `;
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          // 表を表示領域に追加
          resultDisplay.appendChild(table);

          // エクスポートボタンを追加
const exportButton = document.createElement('button');
exportButton.innerText = 'Excelファイルをエクスポート';
exportButton.classList.add('export-excel');
exportButton.onclick = function() {
  exportButton.innerText = 'Excelファイルを作成中...';
  exportButton.disabled = true;

  google.script.run.withSuccessHandler(function(url) {
    if (url && url.startsWith('http')) {
      // スタイリングしたダウンロードリンクを作成
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.innerText = 'ファイルの準備が完了しました。ダウンロードはこちら';
      downloadLink.style.display = 'inline-block';
      downloadLink.style.padding = '10px 15px';
      downloadLink.style.marginTop = '10px';
      downloadLink.style.backgroundColor = '#4CAF50';
      downloadLink.style.color = '#fff';
      downloadLink.style.textDecoration = 'none';
      downloadLink.style.borderRadius = '4px';
      downloadLink.style.fontSize = '16px';

      resultDisplay.appendChild(downloadLink);
      // ファイル準備完了後はエクスポートボタンを非表示にする
      exportButton.style.display = 'none';
    } else {
      alert('Excelファイルの生成に失敗しました。');
      exportButton.innerText = 'Excelファイルをエクスポート';
      exportButton.disabled = false;
    }
  }).exportExcelFromResults(promptId);
};
resultDisplay.appendChild(exportButton);


          cell.appendChild(resultDisplay);
        }

        // ボタンの文言を「結果を非表示」に変更
        button.innerText = '結果を非表示';
        button.style.backgroundColor = '#ccc'; // グレーに変更
        // クリック時に非表示にするよう変更
        button.onclick = function() {
          hideResults(button, promptId);
        };

      } else {
        console.error("Results are null or not an array");
      }
    }).getResults(promptId);
  }

    function hideResults(button, promptId) {
      // 結果の行を削除
      const resultsRow = document.getElementById('resultsRow' + promptId);
      if (resultsRow) {
        resultsRow.parentNode.removeChild(resultsRow);
      }
      // ボタンを「結果を表示」に戻す
      button.innerText = '結果を表示';
      // ボタンのスタイルを元に戻す
      button.style.backgroundColor = '#5bc0de'; // 元のライトブルーに戻す
      // クリックイベントを元に戻す
      button.onclick = function() {
        showResults(button, promptId);
      };
    }

/**
 * テーブルの指定された行を編集モードに切り替える関数
 */
function editPrompt(id, text, note, visibility, question, imageFileId, row) {
  // ★デバッグ用ログ2：関数が受け取った引数の中身を確認
  console.log("editPromptが受け取った引数:", {id, text, note, visibility, question, imageFileId});

  // HTMLエスケープ処理（グローバルスコープに別途定義されていること）
  const safeId = escapeHtml(id);
  const safeNote = escapeHtml(note);
  const safeText = escapeHtml(text);
  const safeVisibility = escapeHtml(visibility);
  const safeQuestion = escapeHtml(question);
  const safeImageFileId = escapeHtml(imageFileId);

  // テーブルの各セルを編集用の入力要素に置き換える
  row.cells[1].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editNote${safeId}">${safeNote}</textarea>`;
  row.cells[2].innerHTML = `
    <select id="editVisibility${safeId}">
      <option value="表示" ${safeVisibility === '表示' ? 'selected' : ''}>表示</option>
      <option value="非表示" ${safeVisibility === '非表示' ? 'selected' : ''}>非表示</option>
    </select>`;
  row.cells[3].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editQuestion${safeId}">${safeQuestion}</textarea>`;
  row.cells[4].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editText${safeId}">${safeText}</textarea>`;
  
  // 画像/PDF IDの編集エリア（ファイル選択ボタン）
  row.cells[5].innerHTML = `
    <div>現在のID: ${safeImageFileId || 'なし'}</div>
    <input type="file" id="editFileForPrompt${safeId}" accept="image/*,application/pdf" style="margin-top: 5px;">
    <div style="font-size:11px; color:#555;">ファイルを変更しない場合は空のまま</div>
  `;
  
  // 保存ボタンを作成
  const saveButton = document.createElement('button');
  saveButton.className = 'edit';
  saveButton.textContent = '保存';
  saveButton.addEventListener('click', () => savePrompt(safeId));
  
  // 操作ボタンのセルをクリアして保存ボタンを配置
  row.cells[6].innerHTML = ''; 
  row.cells[6].appendChild(saveButton);
}

/**
 * 　プロンプトを追加する際のメイン関数
 */
function addPrompt() {
  const text = document.getElementById('newPromptText').value.trim();
  const note = document.getElementById('newPromptNote').value.trim();
  const question = document.getElementById('newQuestion').value.trim();
  const visibility = document.getElementById('newPromptVisibility').value;
  const loginId = document.getElementById('displayedLoginId').innerText;
  
  const fileInput = document.getElementById('newFileForPrompt');
  const file = fileInput.files[0];

  if (!note || !text) {
    showMessage("タイトルと採点基準は必須項目です。入力してください。");
    return;
  }

  // ファイルが選択されている場合
  if (file) {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function() {
      const base64Data = reader.result.split(',')[1];
      const fileObject = {
        base64Data: base64Data,
        fileName: file.name,
        mimeType: file.type
      };
      // ★サーバー処理を呼び出す
      callServerToAddPrompt(loginId, text, note, visibility, question, fileObject);
    };
    reader.onerror = function() {
      showMessage('ファイルの読み込みに失敗しました。');
    };
  } else {
    // ファイルが選択されていない場合
    callServerToAddPrompt(loginId, text, note, visibility, question, null);
  }
}

/**
 * ★★★ この新しい関数を追加してください ★★★
 * サーバーのaddPrompt関数を呼び出し、UIのローディング表示を制御するヘルパー関数
 */
function callServerToAddPrompt(loginId, text, note, visibility, question, fileObject) {
  // ★UI改善：ボタンを無効化し、テキストを変更
  const addButton = document.getElementById('addPromptButton');
  addButton.disabled = true;
  addButton.innerText = '追加中...';

  google.script.run.withSuccessHandler(function(result) {
    if (result.success){
      populatePromptTable(result.prompts);
      // フォームをリセット
      document.getElementById('newPromptText').value = '';
      document.getElementById('newPromptNote').value = '';
      document.getElementById('newQuestion').value = '';
      document.getElementById('newFileForPrompt').value = '';
      document.getElementById('newPromptVisibility').value = '表示';
      showMessage(result.message);
    } else {
      showMessage(result.message || '追加に失敗しました。');
    }
    // ★UI改善：ボタンの状態を元に戻す
    addButton.disabled = false;
    addButton.innerText = '採点基準を追加';
  }).withFailureHandler(function(error){
    showMessage('エラーが発生しました: ' + error.message);
    // ★UI改善：ボタンの状態を元に戻す
    addButton.disabled = false;
    addButton.innerText = '採点基準を追加';
  }).addPrompt(loginId, text, note, visibility, question, fileObject);
}

/**
 * 「保存」ボタンが押されたときの処理
 * ファイルが選択されているかどうかで処理を分岐させる
 */
function savePrompt(id) {
  // テキスト入力された値を取得
  const text = document.getElementById(`editText${id}`).value;
  const note = document.getElementById(`editNote${id}`).value;
  const visibility = document.getElementById(`editVisibility${id}`).value;
  const question = document.getElementById(`editQuestion${id}`).value;
  
  // ファイル選択の情報を取得
  const fileInput = document.getElementById(`editFileForPrompt${id}`);
  const file = fileInput.files[0];

  // ★ファイルが選択されている場合（ファイルを変更する場合）
  if (file) {
    const reader = new FileReader();
    reader.readAsDataURL(file); // ファイルを非同期で読み込み

    // ファイルの読み込みが完了したら、サーバー処理を呼び出す
    reader.onload = function() {
      const base64Data = reader.result.split(',')[1];
      const fileObject = {
        base64Data: base64Data,
        fileName: file.name,
        mimeType: file.type
      };
      // ファイル情報(fileObject)を渡してサーバーのsavePromptを呼び出す
      callServerToSavePrompt(id, text, note, visibility, question, fileObject);
    };
    reader.onerror = function() {
      showMessage('ファイルの読み込みに失敗しました。');
    };
  } else {
    // ★ファイルが選択されていない場合（ファイルは変更しない場合）
    // ファイル情報にnullを渡してサーバーのsavePromptを呼び出す
    callServerToSavePrompt(id, text, note, visibility, question, null);
  }
}

/**
 * サーバーのsavePrompt関数を呼び出すためのヘルパー関数
 */
function callServerToSavePrompt(id, text, note, visibility, question, fileObject) {
  // ローディング中のUI処理など（必要に応じて）
  
  google.script.run.withSuccessHandler(function(result) {
    if (result.success) {
      populatePromptTable(result.prompts);
      showMessage(result.message);
    } else {
      showMessage(result.message || '保存に失敗しました。');
    }
  }).withFailureHandler(function(error) {
    showMessage('エラーが発生しました: ' + error.message);
  }).savePrompt(id, text, note, visibility, question, fileObject);
}

    function deletePrompt(id) {
      if (confirm('削除すると元に戻せません。本当に削除しますか？')) {
        google.script.run.withSuccessHandler(function(result) {
          populatePromptTable(result.prompts);
          showMessage(result.message);
        }).deletePrompt(id);
      }
    }

    // ログインID変更関連の関数はコメントアウト
    /*
    function showChangeLoginId() {
      document.getElementById('changeLoginIdForm').style.display = 'block';
    }

    function cancelChangeLoginId() {
      document.getElementById('changeLoginIdForm').style.display = 'none';
    }

    function changeLoginId() {
      const newLoginId = document.getElementById('newLoginId').value;
      const currentLoginId = document.getElementById('displayedLoginId').innerText;
      google.script.run.withSuccessHandler(function(result) {
        if (result.success) {
          document.getElementById('displayedLoginId').innerText = newLoginId;
          document.getElementById('changeLoginIdForm').style.display = 'none';
          showMessage('ログインIDが変更されました。');
        } else {
          showMessage('このIDは使用できません。');
        }
      }).changeLoginId(currentLoginId, newLoginId);
    }
    */

// パスワード変更モーダルを開く
function openChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'flex';
}

// パスワード変更モーダルを閉じる
function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
  // 入力値をリセット
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

// パスワード変更を実行（モーダル内のOKボタン）
function submitNewPassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const loginId = document.getElementById('displayedLoginId').innerText; // 画面上のログインID参照

  // 簡易バリデーション
  if (!newPassword || !confirmPassword) {
    displayNotification('パスワードを入力してください。');
    return;
  }
  if (newPassword !== confirmPassword) {
    displayNotification('確認用パスワードが一致しません。');
    return;
  }
  if (newPassword.length < 8) {
    displayNotification('パスワードは8文字以上で設定してください。');
    return;
  }

  // GAS側スクリプト呼び出し
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.success) {
        // モーダルを閉じる
        closeChangePasswordModal();
        // 画面上のパスワード表示をアスタリスクに置き換え
        document.getElementById('displayedPassword').innerText = '*'.repeat(newPassword.length);
        displayNotification('パスワードが変更されました。');
      } else {
        displayNotification('パスワードの変更に失敗しました。');
      }
    })
    .changePassword(loginId, newPassword);
}

// 画面上にメッセージを表示する関数（alert() の代わりに使用）
function displayNotification(msg) {
  alert(msg);
}

    // 先生用ページから一括採点ページを表示
    function showBulkGradingPage() {
      document.getElementById('teacher-page').style.display = 'none';
      document.getElementById('bulk-grading-page').style.display = 'block';

      // プロンプトの選択肢を読み込む
      loadTeacherPrompts();
    }

    // 一括採点ページから先生用ページに戻る
    function backToTeacherPage() {
      document.getElementById('bulk-grading-page').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'block';
    }

/**
 * 教員のプロンプトを読み込む関数
 * ※グローバル変数 globalTeacherId に保持したログインIDをサーバー呼び出し時に渡す
 */
function loadTeacherPrompts() {
  if (!globalTeacherId) {
    alert('ログインしてください。');
    return;
  }
  google.script.run.withSuccessHandler(function(response) {
    if (response.success) {
      var prompts = response.prompts;
      var promptSelect = document.getElementById('promptSelect');
      promptSelect.innerHTML = '';
      prompts.forEach(function(prompt) {
        var option = document.createElement('option');
        option.value = prompt.id;
        option.text = prompt.note + ' (ID: ' + prompt.id + ')';
        promptSelect.add(option);
      });
    } else {
      alert('プロンプトの取得に失敗しました。');
    }
  }).getTeacherPrompts(globalTeacherId);
}

/**
 * 採点基準のチェック
 */
function checkPrompt() {
  // チェックボタンの取得と状態保存
  var checkBtn = document.querySelector('.check');
  var originalText = checkBtn.textContent;
  checkBtn.disabled = true;
  checkBtn.textContent = "採点基準をチェックしています…しばらくお待ちください";

  // 結果表示用ボックスの表示とメッセージ更新
  var resultBox = document.getElementById("checkResultBox");
  resultBox.style.display = "block";
  var resultContent = document.getElementById("checkResultContent");
  resultContent.style.opacity = "0.5";
  resultContent.innerHTML = "採点基準をチェックしています…しばらくお待ちください";

  // 入力内容の取得
  var promptText = document.getElementById("newPromptText").value;
  var promptNote = document.getElementById("newPromptNote").value;
  var promptVisibility = document.getElementById("newPromptVisibility").value;

  // サーバー側の処理（checkPromptServer）へ送信
  google.script.run
    .withSuccessHandler(function(response) {
      // 正常に結果が返った場合
      checkBtn.disabled = false;
      checkBtn.textContent = originalText;
      resultContent.style.opacity = "1";
      // サーバーからのレスポンスを Markdown→HTML 変換して表示
      resultContent.innerHTML = parseMarkdown(response);
    })
    .withFailureHandler(function(error) {
      // エラー発生時の処理
      checkBtn.disabled = false;
      checkBtn.textContent = originalText;
      resultContent.style.opacity = "1";
      resultContent.innerHTML = "エラーが発生しました: " + error.message;
    })
    .checkPromptServer({
      promptText: promptText,
      promptNote: promptNote,
      promptVisibility: promptVisibility
    });
}

// 一括採点の実行ボタン
function startBulkGrading() {
  var files = document.getElementById('uploadImages').files;
  var promptId = document.getElementById('promptSelect').value;
  
  // ▼ 追加：入力されたメールアドレスを取得
  var emailAddress = document.getElementById('emailAddress').value;

  if (files.length === 0) {
    alert('画像を選択してください。');
    return;
  }

  // ▼ 追加：メールアドレス未入力時のチェック
  if (!emailAddress) {
    alert('送信先メールアドレスを入力してください。');
    return;
  }

  if (!globalTeacherId) {
    alert('ログインが必要です。');
    return;
  }

  var progress = document.getElementById('progress');
  var resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  progress.innerHTML = 'ファイルをアップロード中...';

  var gradingButton = document.getElementById('gradingButton');
  gradingButton.disabled = true;
  gradingButton.style.backgroundColor = '#d3d3d3';
  gradingButton.style.color = '#fff';
  gradingButton.innerText = 'ファイルをアップロード中…';

  processAndUploadFilesToFolder(files, function(folderId) {
    // アップロード完了メッセージの表示
    progress.innerHTML = 'アップロードが完了しました。<br>' +
      '採点が完了したら入力されたメールアドレスにダウンロードリンクを通知しますので、このページは閉じることができます。<br>' +
      'また、追加で別のファイルをアップロードすることも可能です。<br>' +
      '採点には10分ほどかかる場合があります。<br>' +
      'ご利用環境によっては迷惑メールフォルダに振り分けられる可能性があるのでご注意ください。';

    // 採点開始ボタンとリセットボタンを有効化
    document.getElementById('uploadImages').value = '';
    gradingButton.disabled = false;
    gradingButton.style.backgroundColor = ''; // 元のスタイルに戻す（必要に応じて設定）
    gradingButton.style.color = '';
    gradingButton.innerText = '採点とZIP化の開始';

    // バックグラウンドで採点処理を実行（非同期実行のため、結果待ちせず即時リターン）
    google.script.run
      .withFailureHandler(function(err) {
        alert("採点処理の開始に失敗しました: " + err.message);
      })
      // ▼ 変更：パラメータに emailAddress を追加
      .processTestImagesSequentially(folderId, promptId, globalTeacherId, emailAddress);
  });
}

// ファイルをモノクロに変換してサーバーにアップロードする関数
function processAndUploadFilesToFolder(files, callback) {
  var fileDataArray = [];

  // files を Array に変換してループ処理
  Array.from(files).forEach(function(file, index) {
    var reader = new FileReader();

    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        // キャンバスを作成し、画像を描画
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // モノクロ処理
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
          var r = data[i];
          var g = data[i + 1];
          var b = data[i + 2];
          // 輝度計算（0.3, 0.59, 0.11）
          var grayscale = r * 0.3 + g * 0.59 + b * 0.11;
          data[i]     = grayscale; // R
          data[i + 1] = grayscale; // G
          data[i + 2] = grayscale; // B
          // A (アルファ) はそのまま
        }
        ctx.putImageData(imageData, 0, 0);

        // JPEG形式で70%の圧縮率、データURLに変換（先頭 "data:image/jpeg;base64," 部分を除去）
        var base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

        fileDataArray.push({
          base64: base64Image,
          mimeType: file.type,
          fileName: file.name
        });

        // 全ファイルの処理が完了したらサーバーへ送信
        if (fileDataArray.length === files.length) {
          google.script.run
            .withSuccessHandler(function(folderId) {
              callback(folderId);
            })
            .withFailureHandler(function(err) {
              alert('アップロード処理に失敗しました: ' + err.message);
              // 必要に応じてボタンの再有効化などの処理をここに追加
            })
            .createChildFolderAndUpload(fileDataArray);
        }
      };

      img.onerror = function(error) {
        alert("画像の読み込みに失敗しました: " + error.message);
      };

      img.src = e.target.result;
    };

    reader.onerror = function(error) {
      alert("ファイルの読み込みに失敗しました: " + error.message);
    };

    reader.readAsDataURL(file);
  });
}

let completedFiles = 0; // 処理済みファイル数の初期化（必要に応じて利用）

    // 採点結果をPDFにエクスポート
    function exportResults() {
      var promptId = document.getElementById('promptSelect').value;

      const exportButton = document.getElementById('export-bulk-button');
      exportButton.innerText = 'ダウンロードファイルを作成中...';  // ボタンのテキストを変更
      exportButton.disabled = true;  // ボタンを無効化

      google.script.run.withSuccessHandler(function(result) {
        if (result.success) {
          // 自動的にダウンロードを開始
          window.location.href = result.downloadUrl;
gradingButton
          // ダウンロード開始後にフォルダとZIPファイルを非公開にする
          setTimeout(function() {
            google.script.run.revokeAccessAfterDownload(result.zipFileId, result.folderId);
          }, 5000); // 5秒後に非公開に変更（必要に応じて調整）
        } else {
          alert('エラー: ' + result.message);
        }
        exportButton.innerText = '一括採点結果をPDFで出力';  // ボタンのテキストを元に戻す
        exportButton.disabled = false;  // ボタンを再度有効化
      }).exportResults(promptId);
    }


    // 一括採点の結果をエクセルにエクスポート
    document.getElementById('exportExcelButton').addEventListener('click', exportExcelFile);

function exportExcelFile() {
  const btn   = document.getElementById('exportExcelButton');
  const label = document.getElementById('excelStatus');
  const promptId = document.getElementById('promptSelect').value;

  if (!promptId) {
    label.textContent = 'まず採点基準プロンプトを選択してください。';
    return;
  }

  // UI 更新
  btn.disabled = true;
  label.textContent = 'エクセルファイルを作成中…';

  // GAS 呼び出し
  google.script.run
    .withSuccessHandler(function (url) {
      if (url && url.startsWith('http')) {
        // ★ここからスタイル付きリンクの生成ロジック
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.innerText = 'ファイルの準備が完了しました。ダウンロードはこちら';
        downloadLink.style.display = 'inline-block';
        downloadLink.style.padding = '10px 15px';
        downloadLink.style.marginTop = '10px';
        downloadLink.style.backgroundColor = '#4CAF50';
        downloadLink.style.color = '#fff';
        downloadLink.style.textDecoration = 'none';
        downloadLink.style.borderRadius = '4px';
        downloadLink.style.fontSize = '16px';

        label.innerHTML = ''; // 「作成中…」のテキストをクリア
        label.appendChild(downloadLink);
        btn.style.display = 'none'; // 元のエクスポートボタンは非表示に
        // ★ここまで
      } else {
        label.textContent = 'エクスポートに失敗しました。';
        btn.disabled = false; // 失敗時はボタンを再度有効化
      }
    })
    .withFailureHandler(function (err) {
      console.error(err);
      label.textContent = 'エクスポートに失敗しました。';
      btn.disabled = false;
    })
    .exportBulkExcelFromResults(promptId);
}

// 一括採点モードのリセット
function resetBulkGrading() {
  document.getElementById('promptSelect').selectedIndex = 0;
  document.getElementById('uploadImages').value = '';
  document.getElementById('progress').innerHTML = '';
  document.getElementById('results').innerHTML = '';

  // ★エクスポート関連の表示をリセット
  const exportButton = document.getElementById('exportExcelButton'); // IDを統一
  if (exportButton) {
      exportButton.style.display = 'inline-block'; // ボタンを再表示
      exportButton.disabled = false;               // ボタンを有効化
  }
  const excelStatusLabel = document.getElementById('excelStatus');
  if (excelStatusLabel) {
      excelStatusLabel.innerHTML = '';             // ダウンロードリンクやステータス表示をクリア
  }
  
  // 「採点を開始」ボタンを有効化
  const gradingButton = document.getElementById('gradingButton');
  gradingButton.disabled = false;
}

    // ファイル数をチェックする関数
    function checkFileCount() {
      const fileInput = document.getElementById('uploadImages');
      const gradingButton = document.getElementById('gradingButton');

      // ファイルが30を超えるかどうかをチェック
      if (fileInput.files.length > 30) {
        gradingButton.disabled = true;
        alert('30ファイル以上はアップロードできません。');
      } else {
        gradingButton.disabled = false;
      }
    }

    // 採点基準作成サポート用の画像アップロード処理
    let gradingSupportImageData = null;

    function handleGradingSupportImageUpload(event) {
      const file = event.target.files[0];
      if (!file || !['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        document.getElementById('gradingSupportMessage').innerText = 'JPG、JPEG、PNG形式の画像のみがアップロード可能です。';
        gradingSupportImageData = null;
        return;
      } else {
        document.getElementById('gradingSupportMessage').innerText = '';
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.getElementById('gradingSupportCanvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // モノクロ処理
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const grayscale = r * 0.3 + g * 0.59 + b * 0.11;
            data[i] = grayscale;
            data[i + 1] = grayscale;
            data[i + 2] = grayscale;
          }

          ctx.putImageData(imageData, 0, 0);

          // 70%の圧縮率で画像をデータURLに変換
          gradingSupportImageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // 採点基準作成サポートの送信
    function submitGradingSupport() {
      const teacherLoginId = document.getElementById('displayedLoginId').innerText;

      if (!gradingSupportImageData) {
        document.getElementById('gradingSupportMessage').innerText = '画像をアップロードしてください。';
        return;
      }

      document.getElementById('gradingSupportMessage').innerText = '作成中...';

      google.script.run.withSuccessHandler(function(response) {
        if (response.success) {
          document.getElementById('gradingSupportMessage').innerText = '採点基準が仮作成されました: ' + response.gradingCriteria;
        } else {
          document.getElementById('gradingSupportMessage').innerText = 'エラー: ' + response.message;
        }
      }).createGradingRubricFromImage({
        base64: gradingSupportImageData,
        mimeType: 'image/jpeg',
        fileName: 'grading_support_image.jpg'
      }, teacherLoginId);
    }

/**
 * 【Firebase版】ログアウト処理
 */
function logout() {
  // Firebaseからサインアウト
  auth.signOut().then(() => {
    console.log('Firebaseからログアウトしました。');
    
    // ------------ ここから下は元のコードと同じ（画面表示をリセットする処理） ------------

    // ページ表示の切り替え
    document.getElementById('teacher-page').style.display = 'none';
    document.getElementById('student-page').style.display = 'none';
    document.getElementById('bulk-grading-page').style.display = 'none';
    document.getElementById('top-page').style.display = 'block';
    document.getElementById("usageCountDisplay").textContent = "";
    
    // ログアウト後のログアウトボタンを非表示にする
    document.querySelectorAll('.logout-container').forEach(function(container) {
      container.style.display = 'none';
    });
    
    // グローバル変数をクリア
    globalTeacherId = null;
    
    // ログインページの入力欄・メッセージのリセット
    document.getElementById('studentLoginId').value = '';
    document.getElementById('studentLoginMessage').innerText = '';
    
    document.getElementById('teacherLoginId').value = '';
    document.getElementById('teacherPassword').value = '';
    document.getElementById('teacherLoginMessage').innerText = '';
    
    // 生徒用ページの入力欄・表示エリアのリセット
    document.getElementById('studentNumber').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('promptId').innerHTML = '';
    document.getElementById('uploadImage').value = '';
    document.getElementById('studentMessage').innerHTML = '';
    document.getElementById('textAnswer').value = '';
    document.getElementById('problem-text').innerHTML = '';
    document.getElementById('problem-area').style.display = 'none';
    
    // 先生用ページの内容リセット
    document.getElementById('teacherName').innerText = '';
    document.getElementById('displayedLoginId').innerText = '';
    document.getElementById('displayedPassword').innerText = '';
    document.getElementById('announcement-text').innerHTML = '';
    document.getElementById('promptTable').innerHTML = '';
    
    // 採点基準追加部分のリセット
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newPromptText').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newPromptVisibility').value = '表示';
    document.getElementById('checkResultContent').innerHTML = '';
    document.getElementById('checkResultBox').style.display = 'none';
    
    // その他必要なリセット処理があれば追加
    document.getElementById('rating-section').style.display = 'none';
    document.getElementById('rating').value = "5";
    document.getElementById('submit-rating-button').disabled = true;
    
    showTopPage();

  }).catch((error) => {
    console.error('ログアウトエラー:', error);
    alert('ログアウト中にエラーが発生しました。');
  });
}