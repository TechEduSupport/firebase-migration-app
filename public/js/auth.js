// 認証とログイン関連の処理をまとめたスクリプト
// すべてFirebase SDKを利用し、Apps Scriptへの依存を排除する

// グローバルに保持する変数（ログイン中の先生のUID）
let globalTeacherId = null;

// ------------------------------
// 生徒用ログイン処理（メール/パスワード認証に変更）
// ------------------------------
function checkStudentLogin() {
  const email = document.getElementById('studentLoginId').value;
  const password = document.getElementById('studentPassword').value;
  const loginButton = document.querySelector('#student-login .login-button');
  const messageElement = document.getElementById('studentLoginMessage');

  messageElement.innerText = '';
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true;

  auth
    .signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log('生徒としてFirebaseログイン成功:', user.email);

      // ログインした生徒のUIDをグローバル変数に保持
      globalStudentId = user.uid; // ※後でstudent.jsで使う

      // 画面遷移
      document.getElementById('student-login').style.display = 'none';
      document.getElementById('student-page').style.display = 'block';
      document.querySelector('#student-page .logout-container').style.display = 'block';

      // 生徒の名前などをページに表示（任意）
      document.getElementById('studentName').value = user.displayName || '';


      // 生徒のクラス情報を基に課題一覧を読み込む
      loadPromptsForStudent(user.uid);
    })
    .catch((error) => {
      console.error('生徒ログインエラー:', error);
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        messageElement.innerText = 'メールアドレスまたはパスワードが間違っています。';
      } else {
        messageElement.innerText = 'ログインに失敗しました。';
      }
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

// ------------------------------
// 運営管理者用のログイン処理
// ------------------------------
function checkSuperAdminLogin() {
    const email = document.getElementById('superadminLoginId').value;
    const password = document.getElementById('superadminPassword').value;
    const loginButton = document.querySelector('#superadmin-login .login-button');
    const messageElement = document.getElementById('superadminLoginMessage');

    messageElement.innerText = '';
    loginButton.disabled = true;
    loginButton.innerText = 'ログイン中...';

    auth.signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;

            // Firestoreからユーザーのロール（役割）情報を取得
            const userDoc = await db.collection('users').doc(user.uid).get();

            // ▼▼▼ ここからデバッグ用のログを追加 ▼▼▼
            if (userDoc.exists) {
                console.log('Firestoreから取得したユーザー情報:', userDoc.data());
                console.log('取得したロール:', `'${userDoc.data().role}'`); // シングルクォートで囲んで表示
            } else {
                console.log('Firestoreに該当するユーザーのドキュメントが見つかりませんでした。UID:', user.uid);
            }
            // ▲▲▲ ここまで ▲▲▲

            if (!userDoc.exists || userDoc.data().role !== 'superadmin') {
                throw new Error('auth/unauthorized-access');
            }

            console.log('運営管理者としてログイン成功:', user.email);

            // ログインフォームを非表示にし、ダッシュボードを表示
            document.getElementById('superadmin-login').style.display = 'none';
            document.getElementById('superadmin-dashboard').style.display = 'block';
            document.querySelector('#superadmin-dashboard .logout-container').style.display = 'block';

            // 登録済みの学校一覧を読み込む
            loadSchools();

        })
        .catch(error => {
            console.error('運営管理者ログインエラー:', error);
            if (error.message === 'auth/unauthorized-access') {
                messageElement.innerText = 'このアカウントに運営管理者権限がありません。';
            } else {
                messageElement.innerText = 'ログインIDまたはパスワードが間違っています。';
            }
            auth.signOut();
        })
        .finally(() => {
            loginButton.disabled = false;
            loginButton.innerText = 'ログイン';
        });
}

// ------------------------------
// 学校管理者用のログイン処理
// ------------------------------
function checkSchoolAdminLogin() {
    const email = document.getElementById('schoolAdminLoginId').value;
    const password = document.getElementById('schoolAdminPassword').value;
    const loginButton = document.querySelector('#schooladmin-login .login-button');
    const messageElement = document.getElementById('schoolAdminLoginMessage');

    messageElement.innerText = '';
    loginButton.disabled = true;
    loginButton.innerText = 'ログイン中...';

    auth.signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            const userDoc = await db.collection('users').doc(user.uid).get();

            if (!userDoc.exists || userDoc.data().role !== 'schooladmin') {
                throw new Error('auth/unauthorized-access');
            }

            console.log('学校管理者としてログイン成功:', user.email);
            
            const schoolId = userDoc.data().schoolId;
            if (!schoolId) {
                throw new Error('auth/no-school-assigned');
            }

            // ログインフォームを非表示にし、ダッシュボードを表示
            document.getElementById('schooladmin-login').style.display = 'none';
            document.getElementById('schooladmin-dashboard').style.display = 'block';
            document.querySelector('#schooladmin-dashboard .logout-container').style.display = 'block';

            // admin-script.jsのログイン成功後処理を呼び出す
            onSchoolAdminLoginSuccess(schoolId);

        })
        .catch(error => {
            console.error('学校管理者ログインエラー:', error);
            if (error.message === 'auth/unauthorized-access') {
                messageElement.innerText = 'このアカウントに学校管理者権限がありません。';
            } else if (error.message === 'auth/no-school-assigned') {
                messageElement.innerText = 'この管理者アカウントは、どの学校にも紐付けられていません。';
            } else {
                messageElement.innerText = 'ログインIDまたはパスワードが間違っています。';
            }
            auth.signOut();
        })
        .finally(() => {
            loginButton.disabled = false;
            loginButton.innerText = 'ログイン';
        });
}