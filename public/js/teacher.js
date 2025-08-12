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

/**
 * 【Firebase版】ログインした先生の課題（プロンプト）をFirestoreから取得する関数
 * @param {string} teacherUid - ログインした先生のUID
 */
async function fetchTeacherPrompts(teacherUid) {
  try {
    console.log(`Firestoreから先生 (UID: ${teacherUid}) の課題を取得します...`);
    
    // 1. promptsコレクションに対して、teacherIdが一致するものを問い合わせる
    const querySnapshot = await db.collection('prompts')
                                  .where('teacherId', '==', teacherUid)
                                  .orderBy('createdAt', 'desc') // 新しい順に並べる
                                  .get();

    // 2. 取得したドキュメントを、prompttable.jsが理解できる形式に変換
    const prompts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      prompts.push({
        id: doc.id,         // ドキュメントID
        note: data.title,       // Firestoreの'title'を'note'としてマッピング
        visibility: data.isVisible ? '表示' : '非表示', // booleanを文字列に変換
        question: data.question,
        text: data.subject,     // Firestoreの'subject'を'text'（採点基準）としてマッピング
        // imageFileId: data.questionImageUrl // 必要であれば追加
      });
    });

    console.log(`${prompts.length}件の課題が見つかりました。`, prompts);

    // 3. 既存のテーブル描画関数を呼び出す！
    populatePromptTable(prompts);

  } catch (error) {
    console.error("課題の取得中にエラーが発生しました:", error);
    alert("課題一覧の読み込みに失敗しました。");
    // エラーが発生した場合も、空のテーブルを表示
    populatePromptTable([]);
  }
}