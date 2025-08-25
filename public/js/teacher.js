// public/js/teacher.js

// グローバルスコープで選択中のIDを管理
let selectedYear = null;
let selectedTerm = null; // ★学期用の変数を追加
let selectedClassId = null;
let selectedSubjectId = null;

/**
 * ページの読み込みが完了した際の初期化処理
 */
document.addEventListener('DOMContentLoaded', () => {
  const promptTable = document.getElementById('promptTable');
  if (promptTable) {
    promptTable.innerHTML = `<tr><td colspan="7" style="text-align: center;">上のメニューから年度・学期・クラス・授業を選択してください。</td></tr>`;
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      window.currentTeacherId = user.uid;
      initializeFilterPanes();
    }
  });
});

/**
 * フィルターパネルの初期設定を行う
 */
function initializeFilterPanes() {
  setupYearPane();
}

/**
 * 年度パネルに、現在の年度から過去5年分の選択肢を生成する
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
  selectedTerm = null;
  selectedClassId = null;
  selectedSubjectId = null;
  document.getElementById('term-pane').innerHTML = '<li>年度を選択してください</li>';
  document.getElementById('class-pane').innerHTML = '<li>学期を選択してください</li>';
  document.getElementById('subject-pane').innerHTML = '<li>クラスを選択してください</li>';
  if (window.loadPromptTable) window.loadPromptTable();

  // ★★★ 次のステップとして学期を読み込む ★★★
  loadTermsForYear(year);
}

/**
 * ★★★ 新規追加 ★★★
 * 選択された年度に基づいて、担当授業の学期一覧を読み込む
 */
async function loadTermsForYear(year) {
    const termPane = document.getElementById('term-pane');
    termPane.innerHTML = '<li>読み込み中...</li>';

    if (!year || !window.currentTeacherId) {
        termPane.innerHTML = '<li>年度を選択してください</li>';
        return;
    }

    const db = firebase.firestore();
    try {
        const subjectsQuery = await db.collection('subjects')
            .where('year', '==', parseInt(year))
            .where('teacherIds', 'array-contains', window.currentTeacherId)
            .get();

        if (subjectsQuery.empty) {
            termPane.innerHTML = '<li>担当授業がありません</li>';
            return;
        }
        
        // 取得した授業データから、重複しない学期名のリストを作成
        const terms = [...new Set(subjectsQuery.docs.map(doc => doc.data().term).filter(Boolean))];
        
        // 学期の順序を定義（例: 1学期, 2学期, 3学期, 通年）
        const termOrder = ["1学期", "2学期", "3学期", "前期", "後期", "通年"];
        terms.sort((a, b) => {
            const indexA = termOrder.indexOf(a);
            const indexB = termOrder.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        termPane.innerHTML = ''; // ペインをクリア
        if (terms.length === 0) {
            termPane.innerHTML = '<li>学期情報のある授業がありません</li>';
            return;
        }

        terms.forEach(term => {
            const li = document.createElement('li');
            li.textContent = term;
            li.dataset.term = term;
            li.onclick = () => handleTermSelection(term, li);
            termPane.appendChild(li);
        });

    } catch (error) {
        console.error("学期の読み込みに失敗しました:", error);
        termPane.innerHTML = '<li>読み込みに失敗しました</li>';
    }
}


/**
 * ★★★ 新規追加 ★★★
 * 学期選択時の処理
 */
function handleTermSelection(term, element) {
    selectedTerm = term;
    updateActiveState(document.getElementById('term-pane'), element);

    // 後続の選択をリセット
    selectedClassId = null;
    selectedSubjectId = null;
    document.getElementById('class-pane').innerHTML = '<li>学期を選択してください</li>';
    document.getElementById('subject-pane').innerHTML = '<li>クラスを選択してください</li>';
    if (window.loadPromptTable) window.loadPromptTable();

    loadClassesForTerm(term);
}


/**
 * ★★★ 修正 ★★★
 * 選択された年度と「学期」に基づいて、担当クラス一覧を読み込む
 */
async function loadClassesForTerm(term) {
  const classPane = document.getElementById('class-pane');
  classPane.innerHTML = '<li>読み込み中...</li>';

  // ★条件に selectedYear と term を追加
  if (!selectedYear || !term || !window.currentTeacherId) {
    classPane.innerHTML = '<li>学期を選択してください</li>';
    return;
  }

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('year', '==', parseInt(selectedYear))
      .where('term', '==', term) // ★学期の条件を追加
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    if (subjectsQuery.empty) {
      classPane.innerHTML = '<li>担当クラスがありません</li>';
      return;
    }

    const classIds = [...new Set(subjectsQuery.docs.map(doc => doc.data().classId))];
    const classPromises = classIds.map(id => db.collection('classes').doc(id).get());
    const classSnapshots = await Promise.all(classPromises);

    classPane.innerHTML = '';
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
 * クラス選択時の処理 (変更なし)
 */
function handleClassSelection(classId, element) {
  selectedClassId = classId;
  updateActiveState(document.getElementById('class-pane'), element);

  selectedSubjectId = null;
  if (window.loadPromptTable) window.loadPromptTable();

  loadSubjectsForClass(classId);
}

/**
 * ★★★ 修正 ★★★
 * 選択されたクラスに基づいて、担当授業一覧を読み込む
 */
async function loadSubjectsForClass(classId) {
  const subjectPane = document.getElementById('subject-pane');
  subjectPane.innerHTML = '<li>読み込み中...</li>';

  // ★条件に selectedYear と selectedTerm を追加
  if (!classId || !window.currentTeacherId || !selectedYear || !selectedTerm) {
    subjectPane.innerHTML = '<li>クラスを選択してください</li>';
    return;
  }

  const db = firebase.firestore();
  try {
    const subjectsQuery = await db.collection('subjects')
      .where('classId', '==', classId)
      .where('year', '==', parseInt(selectedYear))
      .where('term', '==', selectedTerm) // ★学期の条件を追加
      .where('teacherIds', 'array-contains', window.currentTeacherId)
      .get();
      
    subjectPane.innerHTML = '';
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
 * 授業選択時の処理 (変更なし)
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
 * ペイン内のアクティブな項目を更新するヘルパー関数 (変更なし)
 */
function updateActiveState(pane, activeElement) {
  pane.querySelectorAll('li').forEach(li => li.classList.remove('active'));
  activeElement.classList.add('active');
}


/**
 * 新しい採点基準をFirestoreに登録する関数 (変更なし)
 */
async function addPrompt() {
  if (!selectedSubjectId) {
    alert('採点基準を追加する授業を、上の「課題の絞り込み」から選択してください。');
    return;
  }
  const subjectId = selectedSubjectId;
  const teacherId = firebase.auth().currentUser.uid;
  if (!teacherId) {
    alert('ユーザー情報が取得できませんでした。再度ログインしてください。');
    return;
  }

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
      subjectId: subjectId,
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
    
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newPromptText').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newFileForPrompt').value = '';
    document.getElementById('deadline').value = '';

    await new Promise(resolve => setTimeout(resolve, 500));
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
async function checkPrompt() {
  const checkButton = document.getElementById('checkPromptButton');
  const banner = document.getElementById('checkResultBanner');
  const modal = document.getElementById('contradictionModal');
  const modalBody = document.getElementById('modalBody');
  const modalActions = document.querySelector('.modal-actions');
  const closeModalButton = document.querySelector('.modal-close-button');

  const promptText = document.getElementById('newPromptText').value;
  const promptNote = document.getElementById('newPromptNote').value;
  const promptVisibility = document.getElementById('newPromptVisibility').value === '表示';

  if (!promptText.trim()) {
    alert('採点基準内容を入力してください。');
    return;
  }

  checkButton.disabled = true;
  checkButton.querySelector('span').innerText = '判定中...';
  banner.style.display = 'none';

  const closeModal = () => {
    modal.classList.remove('is-open');
  };
  if(closeModalButton) closeModalButton.onclick = closeModal;
  
  if(modal) {
      modal.onclick = (event) => {
        if (event.target === modal) {
          closeModal();
        }
      };
  }


  try {
    const functions = firebase.app().functions('asia-northeast1');
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      functions.useEmulator('127.0.0.1', 5001);
    }
    const checkPromptConsistency = functions.httpsCallable('checkPromptConsistency', { timeout: 300000 });

    const response = await checkPromptConsistency({ promptText, promptNote, promptVisibility });
    const resultText = (response && response.data && response.data.result) ? response.data.result : '';
    const ok = resultText.includes('問題は見つかりませんでした');

    banner.className = 'check-result-banner ' + (ok ? 'success' : 'warning');
    banner.innerHTML = (ok ? '✅ 矛盾なし。基準は問題ありません。' : '⚠️ 要修正あり。詳細を確認してください。') +
                       ' <button id="toggleDetailBtn" class="src-btn">詳細を見る</button>';
    banner.style.display = 'block';

    if(modalBody) modalBody.textContent = resultText;
    if(modalBody) modalBody.className = 'result-box ' + (ok ? 'success' : 'warning');
    if(modalActions) modalActions.innerHTML = '';

    document.getElementById('toggleDetailBtn').onclick = () => {
      if(modal) modal.classList.add('is-open');
    };

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
      if(modalActions) modalActions.appendChild(applyBtn);
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
 * タブの表示を切り替える関数 (変更なし)
 */
function showTab(tabId) {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => button.classList.remove('active'));

  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => content.classList.remove('active'));

  const clickedButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
  clickedButton.classList.add('active');

  const targetContent = document.getElementById(tabId);
  targetContent.classList.add('active');
}
