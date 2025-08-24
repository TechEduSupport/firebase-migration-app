// グローバルに保持する変数（ログイン中の先生のUID）
let globalTeacherId = null;

// ------------------------------
// 生徒用ログイン処理
// ------------------------------
function checkStudentLogin() {
  const email = document.getElementById('studentLoginId').value;
  const password = document.getElementById('studentPassword').value;
  const loginButton = document.querySelector('#student-login .login-button');
  const messageElement = document.getElementById('studentLoginMessage');

  messageElement.innerText = '';
  loginButton.innerText = 'ログイン中...';
  loginButton.disabled = true;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log('生徒としてFirebaseログイン成功:', userCredential.user.email);
      // ★ ログイン成功後、生徒用ページに遷移
      window.location.href = 'student.html';
    })
    .catch((error) => {
      console.error('生徒ログインエラー:', error);
      messageElement.innerText = 'メールアドレスまたはパスワードが間違っています。';
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

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log('Firebaseログイン成功:', userCredential.user.email);
      // ★ ログイン成功後、先生用ページに遷移
      window.location.href = 'teacher.html';
    })
    .catch((error) => {
      console.error('Firebaseログインエラー:', error.code, error.message);
      messageElement.innerText = 'メールアドレスまたはパスワードが間違っています。';
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
  auth.signInWithPopup(provider)
    .then((result) => {
      console.log('Googleログイン成功:', result.user.email);
      // ★ ログイン成功後、先生用ページに遷移
      window.location.href = 'teacher.html';
    })
    .catch((error) => {
      console.error('Googleログインエラー:', error);
      document.getElementById('teacherLoginMessage').innerText = 'Googleログインに失敗しました。';
    });
}

// ------------------------------
// ログアウト処理
// ------------------------------
function logout() {
  auth.signOut().then(() => {
    console.log('Firebaseからログアウトしました。');
    // ★ ログアウト後、トップページに遷移
    window.location.href = 'index.html';
  }).catch((error) => {
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