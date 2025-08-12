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
 * 【Firebase版】Googleアカウントでのログイン関数
 */
function signInWithGoogle() {
  // Google認証プロバイダのインスタンスを作成
  const provider = new firebase.auth.GoogleAuthProvider();
  const messageElement = document.getElementById('teacherLoginMessage');

  // ポップアップウィンドウでGoogleログインを実行
  auth.signInWithPopup(provider)
    .then((result) => {
      // ログイン成功時の処理
      const user = result.user;
      console.log('Googleログイン成功:', user.email);
      messageElement.innerText = '';

      // checkTeacherLogin と同じ画面遷移処理を実行
      globalTeacherId = user.email;
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'block';
      document.getElementById('teacherName').innerText = `ようこそ、${user.displayName || user.email}さん`;
      document.getElementById('displayedLoginId').innerText = user.email;
      document.getElementById('displayedPassword').innerText = '（Googleログイン）';
      document.querySelector('#teacher-page .logout-container').style.display = 'block';

      fetchTeacherPrompts(user.uid);　 // Firestoreから先生の課題を取得
      document.getElementById('announcement-text').textContent = "現在お知らせはありません。";
    })
    .catch((error) => {
      // ログイン失敗時の処理
      console.error('Googleログインエラー:', error);
      messageElement.innerText = 'Googleログインに失敗しました。ポップアップがブロックされていないか確認してください。';
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