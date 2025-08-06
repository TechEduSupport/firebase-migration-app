


// 問題マスタを保持
let problemDict = {};

// 生徒用プロンプト ID 読み込み
function loadPromptIds(loginId) {
    const sel = document.getElementById('promptId');

    // ▼▼▼ ここから修正 ▼▼▼
    // 処理開始時にドロップダウンを「読み込み中」表示にし、無効化する
    sel.innerHTML = ''; // 中身を一旦クリア
    const loadingOpt = document.createElement('option');
    loadingOpt.textContent = "課題を読み込み中...";
    sel.add(loadingOpt);
    sel.disabled = true;

    google.script.run
        .withSuccessHandler(function(prompts) {
            // 正常に取得できたら、ドロップダウンを再構築
            sel.innerHTML = ''; 
            problemDict = {};

            // 先頭に「未選択」状態のオプションを追加
            const firstOpt = document.createElement('option');
            firstOpt.value = ""; 
            firstOpt.textContent = "▼ ここから課題を選択してください";
            firstOpt.selected = true; 
            sel.add(firstOpt);

            prompts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.text = `${p.id} - ${p.note}`;
                sel.add(opt);
                
                problemDict[p.id] = {
                    question: p.question,
                    fileData: p.fileData,
                    fileType: p.fileType
                };
            });
            
            sel.disabled = false; // 最後にドロップダウンを有効化する
        })
        .withFailureHandler(function(error) {
            // 読み込みに失敗した場合の処理
            console.error("課題の読み込みに失敗しました:", error);
            sel.innerHTML = ''; // 中身をクリア
            const errorOpt = document.createElement('option');
            errorOpt.textContent = "課題の読み込みに失敗しました";
            sel.add(errorOpt);
            sel.disabled = true; // エラー時は操作不能のままにする
        })
        .getPromptIdsForStudent(loginId);
    // ▲▲▲ 修正ここまで ▲▲▲
}

// 問題文とファイル（画像/PDF）の表示
function showProblemText() {
  const pid   = document.getElementById('promptId').value;

  // ▼▼▼ ここから追加 ▼▼▼
  // promptIdが空（＝未選択）の場合は、問題エリアを非表示にして処理を終了
  if (!pid) {
    document.getElementById('problem-area').style.display = 'none';
    return;
  }
  // ▲▲▲ ここまで追加 ▲▲▲

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
enableSubmitButton();
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
        // ▼▼▼ 修正 ▼▼▼
        window.grayscaleImageData = null; // 選択が無効になったので画像データをクリア
        enableSubmitButton(); // ボタンの状態を更新
        // ▲▲▲ 修正ここまで ▲▲▲
        return;
    } else {
        document.getElementById('studentMessage').innerText = '';
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
            
            // ▼▼▼ ここに移動 ▼▼▼
            // 画像処理が完了したこの時点で、ボタンの状態を更新する
            enableSubmitButton();
            // ▲▲▲ 移動ここまで ▲▲▲
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
    document.getElementById('studentName').value.trim()   !== '' ||
    document.getElementById('studentNumber').value.trim() !== ''
  );

  // ▼▼▼ ここから追加 ▼▼▼
  // 課題が選択されているか（値が空でないか）をチェック
  const hasSelectedPrompt = document.getElementById('promptId').value.trim() !== '';
  // ▲▲▲ ここまで追加 ▲▲▲

  const hasImage = (answerMode === 'image' && window.grayscaleImageData);
  const hasText  = (answerMode === 'text' && 
                    document.getElementById('textAnswer').value.trim() !== '');

  // ▼▼▼ 条件に hasSelectedPrompt を追加 ▼▼▼
  document.getElementById('submit-button').disabled = !(
    hasNameOrNumber && hasSelectedPrompt && (answerMode === 'image' ? hasImage : hasText)
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