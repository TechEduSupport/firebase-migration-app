// public/js/teacher.js

/**
 * ページの読み込みが完了した際の初期化処理
 */
document.addEventListener('DOMContentLoaded', () => {
  const promptTable = document.getElementById('promptTable');
  if (promptTable) {
    promptTable.innerHTML = `<tr><td colspan="7" style="text-align: center;">年度・クラス・授業を選択してください。</td></tr>`;
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      window.currentTeacherId = user.uid;
      initializeFilterDropdowns();
    }
  });
});

/**
 * 絞り込み用ドロップダウンの初期設定を行う
 */
async function initializeFilterDropdowns() {
  const yearSelect = document.getElementById('year-select');
  if (!yearSelect) return;

  setupYearSelect(yearSelect);
  await loadClassesForYear(yearSelect.value);
}

/**
 * 年度選択ドロップダウンに、現在の年度から過去5年分の選択肢を生成する
 */
function setupYearSelect(yearSelect) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const academicYear = (currentMonth < 4) ? currentYear - 1 : currentYear;
  
  yearSelect.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const year = academicYear - i;
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year}年度`;
    if (year === academicYear) option.selected = true;
    yearSelect.appendChild(option);
  }
}

/**
 * 選択された年度に基づいて、担当クラス一覧を読み込む
 */
async function loadClassesForYear(year) {
  const classSelect = document.getElementById('class-select');
  const subjectSelect = document.getElementById('subject-select');
  
  classSelect.innerHTML = '<option value="">クラスを選択</option>';
  subjectSelect.innerHTML = '<option value="">授業を選択</option>';
  
  if (window.loadPromptTable) window.loadPromptTable(); 

  if (!year || !window.currentTeacherId) return;

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('year', '==', parseInt(year))
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    if (subjectsQuery.empty) return;

    const classIds = [...new Set(subjectsQuery.docs.map(doc => doc.data().classId))];
    const classPromises = classIds.map(id => db.collection('classes').doc(id).get());
    const classSnapshots = await Promise.all(classPromises);

    classSnapshots.forEach(doc => {
      if (doc.exists) {
        const classData = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = classData.name;
        classSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("クラスの読み込みに失敗しました:", error);
  }
}

/**
 * 選択されたクラスに基づいて、担当授業一覧を読み込む
 */
async function loadSubjectsForClass(classId) {
  const subjectSelect = document.getElementById('subject-select');
  subjectSelect.innerHTML = '<option value="">授業を選択</option>';
  
  if (window.loadPromptTable) window.loadPromptTable();

  if (!classId || !window.currentTeacherId) return;

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('classId', '==', classId)
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    subjectsQuery.forEach(doc => {
      const subjectData = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = subjectData.name;
      subjectSelect.appendChild(option);
    });
  } catch (error) {
    console.error("授業の読み込みに失敗しました:", error);
  }
}

/**
 * 選択された授業に基づいて、課題一覧を読み込む
 */
function loadPromptsForSubject(subjectId) {
  if (window.loadPromptTable) {
    window.loadPromptTable({ subjectId: subjectId });
  } else {
    console.error('loadPromptTable関数が見つかりません。prompttable.jsが正しく読み込まれているか確認してください。');
  }
}

/**
 * 新しい採点基準をFirestoreに登録する関数
 */
async function addPrompt() {
  // ページ上部のフィルターから選択された授業IDを取得
  const subjectId = document.getElementById('subject-select').value;
  if (!subjectId) {
    alert('採点基準を追加する授業を、上の「課題の絞り込み」から選択してください。');
    return;
  }

  // 現在ログインしている先生のIDを取得
  const teacherId = firebase.auth().currentUser.uid;
  if (!teacherId) {
    alert('ユーザー情報が取得できませんでした。再度ログインしてください。');
    return;
  }

  // フォームから各情報を取得
  const promptTitle = document.getElementById('newPromptNote').value;
  const promptCriteria = document.getElementById('newPromptText').value; // 変数名も分かりやすく変更
  const questionText = document.getElementById('newQuestion').value;
  const file = document.getElementById('newFileForPrompt').files[0];
  const deadline = document.getElementById('deadline').value;
  const visibilityValue = document.getElementById('newPromptVisibility').value;

  if (!promptTitle.trim() || !promptCriteria.trim()) {
    alert('タイトルと採点基準は必須です。');
    return;
  }

  const addButton = document.getElementById('addPromptButton');
  addButton.disabled = true;
  addButton.textContent = '追加中...';

  try {
    const db = firebase.firestore();
    const newPromptRef = db.collection('prompts').doc();

    let imageUrl = '';
    let uploadedFileName = '';

    if (file) {
      const storageRef = firebase.storage().ref(`prompts/${newPromptRef.id}/${file.name}`);
      const snapshot = await storageRef.put(file);
      imageUrl = await snapshot.ref.getDownloadURL();
      uploadedFileName = file.name;
    }

    // ▼▼▼ フィールド名を 'criteria' に修正した最終版 ▼▼▼
    await newPromptRef.set({
      subjectId: subjectId,
      teacherId: teacherId,
      title: promptTitle,
      criteria: promptCriteria,   // ★★★ 'subject' から 'criteria' に変更 ★★★
      question: questionText,
      questionImageUrl: imageUrl,
      fileName: uploadedFileName,
      isVisible: visibilityValue === '表示',
      deadline: deadline ? new Date(deadline) : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // ▲▲▲ フィールド名を 'criteria' に修正した最終版 ▲▲▲

    alert('新しい採点基準を追加しました。');
    
    // フォームをクリア
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newPromptText').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newFileForPrompt').value = '';
    document.getElementById('deadline').value = '';

    // 「課題一覧」タブに切り替えて、最新の一覧を再読み込み
    showTab('tab-list');
    loadPromptsForSubject(subjectId);

  } catch (error) {
    console.error("採点基準の追加に失敗しました: ", error);
    alert('エラーが発生しました。採点基準の追加に失敗しました。');
  } finally {
    addButton.disabled = false;
    addButton.textContent = '採点基準を追加';
  }
}

/**
 * 採点基準の矛盾・曖昧さチェックを実行する
 */
// public/js/teacher.js ファイルの checkPrompt 関数を、この内容に置き換えてください。

async function checkPrompt() {
  const checkButton = document.getElementById('checkPromptButton');
  const banner = document.getElementById('checkResultBanner');
  const modal = document.getElementById('contradictionModal');
  const modalBody = document.getElementById('modalBody');
  const modalActions = document.querySelector('.modal-actions');
  const closeModalButton = document.querySelector('.modal-close-button');

  // ▼▼▼ 足りなかった情報取得のコードを追加 ▼▼▼
  const promptText = document.getElementById('newPromptText').value;
  const promptNote = document.getElementById('newPromptNote').value;
  const promptVisibility = document.getElementById('newPromptVisibility').value === '表示';
  // ▲▲▲ 足りなかった情報取得のコードを追加 ▲▲▲

  if (!promptText.trim()) {
    alert('採点基準内容を入力してください。');
    return;
  }

  // UIをローディング状態に設定
  checkButton.disabled = true;
  checkButton.querySelector('span').innerText = '判定中...';
  banner.style.display = 'none';

  // モーダルを閉じるイベント
  const closeModal = () => {
    modal.classList.remove('is-open');
  };
  closeModalButton.onclick = closeModal;
  modal.onclick = (event) => {
    if (event.target === modal) {
      closeModal();
    }
  };

  try {
    const functions = firebase.app().functions('asia-northeast1');
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      functions.useEmulator('127.0.0.1', 5001);
    }
    const checkPromptConsistency = functions.httpsCallable('checkPromptConsistency', { timeout: 300000 });

    // ▼▼▼ AIへ送る情報に promptNote と promptVisibility を追加 ▼▼▼
    const response = await checkPromptConsistency({ promptText, promptNote, promptVisibility });
    // ▲▲▲ AIへ送る情報に promptNote と promptVisibility を追加 ▲▲▲
    const resultText = (response && response.data && response.data.result) ? response.data.result : '';
    const ok = resultText.includes('問題は見つかりませんでした');

    // 1. サマリーバナーの表示
    banner.className = 'check-result-banner ' + (ok ? 'success' : 'warning');
    banner.innerHTML = (ok ? '✅ 矛盾なし。基準は問題ありません。' : '⚠️ 要修正あり。詳細を確認してください。') +
                       ' <button id="toggleDetailBtn" class="src-btn">詳細を見る</button>';
    banner.style.display = 'block';

    // 2. モーダルに詳細結果を設定
    modalBody.textContent = resultText;
    modalBody.className = 'result-box ' + (ok ? 'success' : 'warning');
    modalActions.innerHTML = ''; // アクションボタンを初期化

    // 3. 「詳細を見る」ボタンにモーダル表示イベントを設定
    document.getElementById('toggleDetailBtn').onclick = () => {
      modal.classList.add('is-open');
    };

    // 4. 修正案があれば、モーダル内に「反映ボタン」を設置
    if (!ok) {
      const applyBtn = document.createElement('button');
      applyBtn.className = 'edit';
      applyBtn.textContent = '修正案を反映';
      applyBtn.onclick = () => {
        const m = resultText.match(/修正案[\s\S]*?[：:]\s*([\s\S]+)/);
        const fixed = m ? m[1].trim() : '';
        if (fixed) {
          document.getElementById('newPromptText').value = fixed;
          alert('修正案を採点基準に反映しました。内容を確認して保存してください。');
          closeModal();
        } else {
          alert('修正案の形式が見つかりませんでした。詳細を確認してください。');
        }
      };
      modalActions.appendChild(applyBtn);
    }

  } catch (error) {
    console.error('採点基準のチェックに失敗しました:', error);
    banner.className = 'check-result-banner error';
    banner.textContent = 'エラーが発生しました。もう一度お試しください。';
    banner.style.display = 'block';
  } finally {
    checkButton.disabled = false;
    checkButton.querySelector('span').innerText = 'チェック';
  }
}

/**
 * タブの表示を切り替える関数
 * @param {string} tabId 表示するタブコンテンツのID ('tab-list' or 'tab-create')
 */
function showTab(tabId) {
  // すべてのタブボタンから 'active' クラスを削除
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  // すべてのタブコンテンツを非表示に
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  // クリックされたボタンに 'active' クラスを追加
  const clickedButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
  clickedButton.classList.add('active');

  // 対応するタブコンテンツを表示
  const targetContent = document.getElementById(tabId);
  targetContent.classList.add('active');
}