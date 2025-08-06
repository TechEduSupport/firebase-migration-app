
(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="gVj0mY9ip76Cl5QuzfMvM";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();




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

