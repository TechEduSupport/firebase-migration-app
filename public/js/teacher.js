// public/js/teacher.js

// グローバルスコープで選択中のIDを管理
let selectedYear = null;
let selectedClassId = null;
let selectedSubjectId = null;

/**
 * ページの読み込みが完了した際の初期化処理
 */
document.addEventListener('DOMContentLoaded', () => {
  const promptTable = document.getElementById('promptTable');
  if (promptTable) {
    promptTable.innerHTML = `<tr><td colspan="7" style="text-align: center;">上のメニューから年度・クラス・授業を選択してください。</td></tr>`;
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      window.currentTeacherId = user.uid;
      initializeFilterPanes();
    }
  });
});

/**
 * 3ペインUIの初期設定を行う
 */
function initializeFilterPanes() {
  setupYearPane();
}

/**
 * 年度ペインに、現在の年度から過去5年分の選択肢を生成する
 */
function setupYearPane() {
  const yearPane = document.getElementById('year-pane');
  if (!yearPane) return;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const academicYear = (currentMonth < 4) ? currentYear - 1 : currentYear;
  
  yearPane.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const year = academicYear - i;
    const li = document.createElement('li');
    li.textContent = `${year}年度`;
    li.dataset.year = year;
    li.onclick = () => handleYearSelection(year, li);
    yearPane.appendChild(li);
  }
}

/**
 * 年度選択時の処理
 */
function handleYearSelection(year, element) {
  selectedYear = year;
  updateActiveState(document.getElementById('year-pane'), element);
  
  // 後続の選択をリセット
  selectedClassId = null;
  selectedSubjectId = null;
  document.getElementById('subject-pane').innerHTML = '<li>クラスを選択してください</li>';
  if (window.loadPromptTable) window.loadPromptTable();

  loadClassesForYear(year);
}

/**
 * 選択された年度に基づいて、担当クラス一覧を読み込み、クラスペインに表示する
 */
async function loadClassesForYear(year) {
  const classPane = document.getElementById('class-pane');
  classPane.innerHTML = '<li>読み込み中...</li>';

  if (!year || !window.currentTeacherId) {
    classPane.innerHTML = '<li>年度を選択してください</li>';
    return;
  }

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('year', '==', parseInt(year))
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    if (subjectsQuery.empty) {
      classPane.innerHTML = '<li>担当クラスがありません</li>';
      return;
    }

    const classIds = [...new Set(subjectsQuery.docs.map(doc => doc.data().classId))];
    const classPromises = classIds.map(id => db.collection('classes').doc(id).get());
    const classSnapshots = await Promise.all(classPromises);

    classPane.innerHTML = ''; // ペインをクリア
    classSnapshots.forEach(doc => {
      if (doc.exists) {
        const classData = doc.data();
        const li = document.createElement('li');
        li.textContent = classData.name;
        li.dataset.classId = doc.id;
        li.onclick = () => handleClassSelection(doc.id, li);
        classPane.appendChild(li);
      }
    });
  } catch (error) {
    console.error("クラスの読み込みに失敗しました:", error);
    classPane.innerHTML = '<li>読み込みに失敗しました</li>';
  }
}

/**
 * クラス選択時の処理
 */
function handleClassSelection(classId, element) {
  selectedClassId = classId;
  updateActiveState(document.getElementById('class-pane'), element);

  // 後続の選択をリセット
  selectedSubjectId = null;
  if (window.loadPromptTable) window.loadPromptTable();

  loadSubjectsForClass(classId);
}

/**
 * 選択されたクラスに基づいて、担当授業一覧を読み込み、授業ペインに表示する
 */
async function loadSubjectsForClass(classId) {
  const subjectPane = document.getElementById('subject-pane');
  subjectPane.innerHTML = '<li>読み込み中...</li>';

  if (!classId || !window.currentTeacherId || !selectedYear) {
    subjectPane.innerHTML = '<li>クラスを選択してください</li>';
    return;
  }

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('classId', '==', classId)
      .where('year', '==', parseInt(selectedYear)) // 年度も条件に追加
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    subjectPane.innerHTML = ''; // ペインをクリア
    if (subjectsQuery.empty) {
        subjectPane.innerHTML = '<li>担当授業がありません</li>';
        return;
    }

    subjectsQuery.forEach(doc => {
      const subjectData = doc.data();
      const li = document.createElement('li');
      li.textContent = subjectData.name;
      li.dataset.subjectId = doc.id;
      li.onclick = () => handleSubjectSelection(doc.id, li);
      subjectPane.appendChild(li);
    });
  } catch (error) {
    console.error("授業の読み込みに失敗しました:", error);
    subjectPane.innerHTML = '<li>読み込みに失敗しました</li>';
  }
}

/**
 * 授業選択時の処理
 */
function handleSubjectSelection(subjectId, element) {
  selectedSubjectId = subjectId;
  updateActiveState(document.getElementById('subject-pane'), element);
  
  if (window.loadPromptTable) {
    window.loadPromptTable({ subjectId: subjectId });
  } else {
    console.error('loadPromptTable関数が見つかりません。');
  }
}

/**
 * ペイン内のアクティブな項目を更新するヘルパー関数
 */
function updateActiveState(pane, activeElement) {
  // すべてのliから 'active' クラスを削除
  pane.querySelectorAll('li').forEach(li => li.classList.remove('active'));
  // クリックされたliに 'active' クラスを追加
  activeElement.classList.add('active');
}


/**
 * 新しい採点基準をFirestoreに登録する関数
 */
async function addPrompt() {
  // ★★★ 変更点: グローバル変数から選択された授業IDを取得 ★★★
  if (!selectedSubjectId) {
    alert('採点基準を追加する授業を、上の「課題の絞り込み」から選択してください。');
    return;
  }
  // 選択された授業IDを、以降の処理で使う変数に代入します
  const subjectId = selectedSubjectId;

  // 現在ログインしている先生のIDを取得
  const teacherId = firebase.auth().currentUser.uid;
  if (!teacherId) {
    alert('ユーザー情報が取得できませんでした。再度ログインしてください。');
    return;
  }

  // フォームから各情報を取得
  const promptTitle = document.getElementById('newPromptNote').value;
  const promptCriteria = document.getElementById('newPromptText').value;
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
    
    await newPromptRef.set({
      subjectId: subjectId, // ★★★ ここで3ペインで選択した授業IDが使われます ★★★
      teacherId: teacherId,
      title: promptTitle,
      criteria: promptCriteria,
      question: questionText,
      questionImageUrl: imageUrl,
      fileName: uploadedFileName,
      isVisible: visibilityValue === '表示',
      deadline: deadline ? new Date(deadline) : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('新しい採点基準を追加しました。');
    
    // フォームをクリア
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newPromptText').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newFileForPrompt').value = '';
    document.getElementById('deadline').value = '';

    await new Promise(resolve => setTimeout(resolve, 500));

    // 「課題一覧」タブに切り替えて、最新の一覧を再読み込み
    showTab('tab-list');
    
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