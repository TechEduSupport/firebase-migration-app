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