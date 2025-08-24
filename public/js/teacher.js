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
 * 採点基準の矛盾・曖昧さチェックを実行する
 */
async function checkPrompt() {
  const checkButton = document.getElementById('checkPromptButton');
  const resultBox = document.getElementById('promptCheckResult');

  const promptText = document.getElementById('newPromptText').value;
  const promptNote = document.getElementById('newPromptNote').value;
  const promptVisibility = document.getElementById('newPromptVisibility').value === '表示';

  if (!promptText.trim()) {
    alert('採点基準内容を入力してください。');
    return;
  }

  checkButton.disabled = true;
  checkButton.innerText = '判定中...';
  resultBox.style.display = 'block';
  resultBox.className = 'result-box loading';
  resultBox.innerText = 'AIが採点基準をチェックしています...';

  try {
    // ▼▼▼ ここを修正 ▼▼▼
    // 'asia-northeast1'リージョンを明示的に指定してFunctionsインスタンスを取得
    const functions = firebase.app().functions('asia-northeast1');
    const checkPromptConsistency = functions.httpsCallable('checkPromptConsistency');
    // ▲▲▲ 修正ここまで ▲▲▲
    
    const response = await checkPromptConsistency({
      promptText,
      promptNote,
      promptVisibility
    });

    const resultText = response.data.result;
    resultBox.innerText = resultText;
    
    if (resultText.includes('問題は見つかりませんでした')) {
      resultBox.className = 'result-box success';
    } else {
      resultBox.className = 'result-box warning';
    }

  } catch (error) {
    console.error('採点基準のチェックに失敗しました:', error);
    resultBox.className = 'result-box error';
    resultBox.innerText = 'エラーが発生しました。コンソールログを確認してください。\n' + error.message;
  } finally {
    checkButton.disabled = false;
    checkButton.innerText = '矛盾をチェック';
  }
}