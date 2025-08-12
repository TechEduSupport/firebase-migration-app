/**
 * 先生関連の処理
 * Firebase SDKを使用し、Apps Scriptへの依存を無くす
 */

// ------------------------------
// 利用回数情報を取得して表示
// ------------------------------
async function updateUsageCount(teacherId) {
  try {
    const doc = await db.collection('users').doc(teacherId).get();
    if (doc.exists) {
      const data = doc.data();
      const usageLimitText = data.usageLimit ? data.usageLimit + '回' : '無制限';
      document.getElementById('usageCountDisplay').textContent =
        `現在の利用回数: ${data.usageCount || 0}／${usageLimitText}`;
    }
  } catch (error) {
    console.error('利用回数の取得に失敗しました:', error);
  }
}

// ------------------------------
// パスワード変更モーダルの制御
// ------------------------------
function openChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'flex';
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

// ------------------------------
// Firebase Authでパスワード変更
// ------------------------------
function submitNewPassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

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

  auth.currentUser
    .updatePassword(newPassword)
    .then(() => {
      closeChangePasswordModal();
      document.getElementById('displayedPassword').innerText = '*'.repeat(newPassword.length);
      displayNotification('パスワードが変更されました。');
    })
    .catch((error) => {
      console.error('パスワード変更エラー:', error);
      displayNotification('パスワードの変更に失敗しました。');
    });
}

// ------------------------------
// 先生の課題をFirestoreから取得
// ------------------------------
async function fetchTeacherPrompts(teacherUid) {
  try {
    console.log(`Firestoreから先生 (UID: ${teacherUid}) の課題を取得します...`);

    const querySnapshot = await db
      .collection('prompts')
      .where('teacherId', '==', teacherUid)
      .orderBy('createdAt', 'desc')
      .get();

    const prompts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      prompts.push({
        id: doc.id,
        note: data.title,
        visibility: data.isVisible ? '表示' : '非表示',
        question: data.question,
        text: data.subject,
      });
    });

    populatePromptTable(prompts);
  } catch (error) {
    console.error('課題の取得中にエラーが発生しました:', error);
    alert('課題一覧の読み込みに失敗しました。');
    populatePromptTable([]);
  }
}
