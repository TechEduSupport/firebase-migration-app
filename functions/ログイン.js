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



/**
 * 【Firebase版】先生用ログイン関数（修正版）
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
      
      // ▼▼▼ 問題のコードをコメントアウト（一時的に無効化） ▼▼
      // updateUsageCount(user.email); 

    })
    .catch((error) => {
      // ログイン失敗時の処理
      console.error('Firebaseログインエラー:', error.code, error.message);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
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