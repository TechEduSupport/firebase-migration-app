// admin-script.js の完成版コード

document.addEventListener('DOMContentLoaded', () => {

  // --- 学校管理カードの処理 ---
  const schoolNameInput = document.getElementById('schoolName');
  const saveSchoolButton = document.querySelector('.admin-card:nth-child(1) .submit');

  saveSchoolButton.addEventListener('click', () => {
    const schoolName = schoolNameInput.value;
    if (!schoolName) {
      alert('学校名を入力してください。');
      return;
    }
    console.log(`「${schoolName}」をFirestoreに保存します...`);
    db.collection('schools').add({
      name: schoolName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then((docRef) => {
      console.log("ドキュメントの保存に成功しました。ID: ", docRef.id);
      alert(`「${schoolName}」を登録しました！`);
      schoolNameInput.value = '';
    })
    .catch((error) => {
      console.error("ドキュメントの保存に失敗しました: ", error);
      alert('学校情報の登録に失敗しました。');
    });
  });


  // --- クラス管理カードの処理 ---
  const classNameInput = document.getElementById('className');
  const classYearInput = document.getElementById('classYear');
  const createClassButton = document.querySelector('.admin-card:nth-child(2) .submit');

  createClassButton.addEventListener('click', () => {
    const className = classNameInput.value;
    const classYear = Number(classYearInput.value);

    if (!className || !classYear) {
      alert('クラス名と年度の両方を入力してください。');
      return;
    }
    
    // TODO: 将来的には、現在操作している学校のIDを動的に取得する
    const schoolId = "8uvIiOFli5snSPeQ1KYt";

    if (schoolId.startsWith('（')) {
        alert('コード内のschoolIdを、実際のschoolsコレクションのドキュメントIDに書き換えてください。');
        return;
    }

    console.log(`クラス「${className}」をFirestoreに保存します...`);
    db.collection('classes').add({
      name: className,
      year: classYear,
      schoolId: schoolId,
      teachers: {},
      studentIds: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then((docRef) => {
      console.log("クラスの作成に成功しました。ID: ", docRef.id);
      alert(`クラス「${className}」を作成しました！`);
      classNameInput.value = '';
      classYearInput.value = '';
    })
    .catch((error) => {
      console.error("クラスの作成に失敗しました: ", error);
      alert('クラスの作成に失敗しました。');
    });
  });

});

// HTMLから必要な要素を取得
const csvUploadArea = document.getElementById('csvUploadArea');
const csvFileInput = document.getElementById('csvFile');
const csvSelectBtn = document.getElementById('csvSelectBtn');
const csvUploadBtn = document.getElementById('csvUploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

let selectedFile = null; // 選択されたファイルを保持する変数

// 「ファイルを選択」ボタンがクリックされた時の処理
csvSelectBtn.addEventListener('click', () => {
  csvFileInput.click(); //隠れているファイル入力をクリックさせる
});

// ファイルが選択された時の処理
csvFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
});

// ドラッグ＆ドロップの処理
csvUploadArea.addEventListener('dragover', (event) => {
  event.preventDefault(); // デフォルトの動作を無効化
  csvUploadArea.classList.add('dragover');
});

csvUploadArea.addEventListener('dragleave', () => {
  csvUploadArea.classList.remove('dragover');
});

csvUploadArea.addEventListener('drop', (event) => {
  event.preventDefault(); // デフォルトの動作を無効化
  csvUploadArea.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

// ファイルが選択された後の共通処理
function handleFile(file) {
  if (file.type !== 'text/csv') {
    alert('CSVファイルを選択してください。');
    return;
  }
  
  selectedFile = file;
  csvUploadArea.querySelector('p').textContent = `選択中のファイル: ${file.name}`;
  csvUploadBtn.disabled = false; // アップロードボタンを有効化
  uploadStatus.innerHTML = ''; // 前回のステータスをクリア
}


// 「アップロードして登録を開始」ボタンがクリックされた時の処理
csvUploadBtn.addEventListener('click', () => {
  if (!selectedFile) {
    alert('ファイルが選択されていません。');
    return;
  }

  const functionUrl = "http://127.0.0.1:5001/tsa-0503/asia-northeast1/bulkCreateUsers";
  console.log(`ファイル「${selectedFile.name}」を ${functionUrl} にアップロードします...`);
  uploadStatus.innerHTML = `<p>ファイルをアップロード中です...</p>`;

  // --- ▼▼▼ ここから下が大きく変わります ▼▼▼ ---
  
  // FileReaderを使って、ファイルの中身をテキストとして読み込む
  const reader = new FileReader();
  reader.onload = (event) => {
    const csvText = event.target.result; // ファイルの中身（テキスト）

    // fetch APIを使って、CSVのテキストをそのままPOSTリクエストで送信
    fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv' // コンテンツタイプを'text/csv'に指定
      },
      body: csvText // bodyにはテキストデータをそのまま入れる
    })
    .then(response => {
        if (!response.ok) { // エラー応答の場合は、ここでエラーを投げる
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
      console.log('関数からの応答:', data);
      uploadStatus.innerHTML = `<p class="status-success">${data.message}</p>`;
    })
    .catch(error => {
      console.error('関数の呼び出しに失敗しました:', error);
      const errorMessage = error.error || "アップロード処理に失敗しました。";
      uploadStatus.innerHTML = `<p class="status-error">❌ ${errorMessage}</p>`;
    });
  };

  reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました。');
  };

  // ファイルの読み込みを開始
  reader.readAsText(selectedFile);
});