// 認証とログイン関連の処理をまとめたスクリプト
// すべてFirebase SDKを利用し、Apps Scriptへの依存を排除する

// グローバルに保持する変数（ログイン中の先生のUID）
let globalTeacherId = null;

// ------------------------------
// 生徒用ログイン処理（匿名認証）
// ------------------------------
function checkStudentLogin() {
  const teacherLoginId = document.getElementById('studentLoginId').value.trim();
  const loginButton = document.querySelector('#student-login .login-button');
  const messageElement = document.getElementById('studentLoginMessage');

  messageElement.innerText = '';
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true;

  // 生徒は匿名認証でサインイン
  auth
    .signInAnonymously()
    .then(async () => {
      // usersコレクションから担当教員を検索
      const snapshot = await db
        .collection('users')
        .where('email', '==', teacherLoginId)
        .where('role', '==', 'teacher')
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('該当する教師が見つかりません。');
      }

      // 先生のUIDを保持
      globalTeacherId = snapshot.docs[0].id;

      // 画面遷移
      document.getElementById('student-login').style.display = 'none';
      document.getElementById('student-page').style.display = 'block';
      document.querySelector('#student-page .logout-container').style.display = 'block';

      // 教師IDを使って課題一覧を読み込む
      loadPromptIds(globalTeacherId);
    })
    .catch((error) => {
      console.error('生徒ログインエラー:', error);
      messageElement.innerText = 'ログインに失敗しました。担当教員のIDを確認してください。';
      auth.signOut();
    })
    .finally(() => {
      loginButton.innerText = 'ログイン';
      loginButton.disabled = false;
    });
}

// ------------------------------
// 先生用メール/パスワード認証
// ------------------------------
function checkTeacherLogin() {
  const email = document.getElementById('teacherLoginId').value;
  const password = document.getElementById('teacherPassword').value;
  const loginButton = document.querySelector('#teacher-login .login-button');
  const messageElement = document.getElementById('teacherLoginMessage');

  messageElement.innerText = '';
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true;

  auth
    .signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log('Firebaseログイン成功:', user.email);

      globalTeacherId = user.uid;

      // 画面を先生用ページに切り替え
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'block';
      document.getElementById('teacherName').innerText = `ようこそ、${user.email}さん`;
      document.getElementById('displayedLoginId').innerText = user.email;
      document.getElementById('displayedPassword').innerText = '********';
      document.querySelector('#teacher-page .logout-container').style.display = 'block';

      // Firestoreから課題を取得
      fetchTeacherPrompts(user.uid);
      document.getElementById('announcement-text').textContent = '現在お知らせはありません。';
    })
    .catch((error) => {
      console.error('Firebaseログインエラー:', error.code, error.message);
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        messageElement.innerText = 'メールアドレスまたはパスワードが間違っています。';
      } else {
        messageElement.innerText = 'ログインに失敗しました。管理者に連絡してください。';
      }
    })
    .finally(() => {
      loginButton.innerText = 'ログイン';
      loginButton.disabled = false;
    });
}

// ------------------------------
// Googleアカウントでのログイン
// ------------------------------
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const messageElement = document.getElementById('teacherLoginMessage');

  auth
    .signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      console.log('Googleログイン成功:', user.email);
      messageElement.innerText = '';

      globalTeacherId = user.uid;
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'block';
      document.getElementById('teacherName').innerText = `ようこそ、${user.displayName || user.email}さん`;
      document.getElementById('displayedLoginId').innerText = user.email;
      document.getElementById('displayedPassword').innerText = '（Googleログイン）';
      document.querySelector('#teacher-page .logout-container').style.display = 'block';

      fetchTeacherPrompts(user.uid); // Firestoreから先生の課題を取得
      document.getElementById('announcement-text').textContent = '現在お知らせはありません。';
    })
    .catch((error) => {
      console.error('Googleログインエラー:', error);
      messageElement.innerText = 'Googleログインに失敗しました。ポップアップがブロックされていないか確認してください。';
    });
}

// ------------------------------
// ログアウト処理
// ------------------------------
function logout() {
  auth
    .signOut()
    .then(() => {
      console.log('Firebaseからログアウトしました。');

      document.getElementById('teacher-page').style.display = 'none';
      document.getElementById('student-page').style.display = 'none';
      document.getElementById('bulk-grading-page').style.display = 'none';
      document.getElementById('top-page').style.display = 'block';
      document.getElementById('usageCountDisplay').textContent = '';

      document.querySelectorAll('.logout-container').forEach(function (container) {
        container.style.display = 'none';
      });

      globalTeacherId = null;

      document.getElementById('studentLoginId').value = '';
      document.getElementById('studentLoginMessage').innerText = '';
      document.getElementById('teacherLoginId').value = '';
      document.getElementById('teacherPassword').value = '';
      document.getElementById('teacherLoginMessage').innerText = '';
      document.getElementById('studentNumber').value = '';
      document.getElementById('studentName').value = '';
      document.getElementById('promptId').innerHTML = '';
      document.getElementById('uploadImage').value = '';
      document.getElementById('studentMessage').innerHTML = '';
      document.getElementById('textAnswer').value = '';
      document.getElementById('problem-text').innerHTML = '';
      document.getElementById('problem-area').style.display = 'none';
      document.getElementById('teacherName').innerText = '';
      document.getElementById('displayedLoginId').innerText = '';
      document.getElementById('displayedPassword').innerText = '';
      document.getElementById('announcement-text').innerHTML = '';
      document.getElementById('promptTable').innerHTML = '';
      document.getElementById('newPromptNote').value = '';
      document.getElementById('newPromptText').value = '';
      document.getElementById('newQuestion').value = '';
      document.getElementById('newPromptVisibility').value = '表示';
      document.getElementById('checkResultContent').innerHTML = '';
      document.getElementById('checkResultBox').style.display = 'none';
      document.getElementById('rating-section').style.display = 'none';
      document.getElementById('rating').value = '5';
      document.getElementById('submit-rating-button').disabled = true;

      showTopPage();
    })
    .catch((error) => {
      console.error('ログアウトエラー:', error);
      alert('ログアウト中にエラーが発生しました。');
    });
}
