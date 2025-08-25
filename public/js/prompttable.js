// public/js/prompttable.js

/**
 * onSnapshotリスナーを管理するためのグローバル変数
 */
let unsubscribeFromPrompts = null;
/**
 * グローバル変数として、現在選択されている授業IDを保持
 */
let currentSubjectId = null;

/**
 * 文字列に含まれるHTML特殊文字をエスケープ（無害化）する関数
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * 課題一覧テーブルをリアルタイムで読み込む唯一の関数
 * @param {object} options - { subjectId: '...' }
 */
window.loadPromptTable = function(options = {}) {
  const table = document.getElementById('promptTable');
  currentSubjectId = options.subjectId || null;

  // 以前のリスナーが設定されていれば、それを解除する
  if (unsubscribeFromPrompts) {
    unsubscribeFromPrompts();
    unsubscribeFromPrompts = null;
  }

  if (!table) return;

  // 授業が選択されていない場合は、メッセージを表示して処理を終了
  if (!currentSubjectId) {
    table.innerHTML = `
      <thead>
        <tr><th></th></tr>
      </thead>
      <tbody>
        <tr><td style="text-align: center;">上のメニューから授業を選択してください。</td></tr>
      </tbody>`;
    return;
  }
  
  // テーブルのヘッダーと読み込み中メッセージを先に表示
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 8%;">画像/PDF</th>
        <th style="width: 15%;">タイトル</th>
        <th style="width: 10%;">表示状態</th>
        <th style="width: 15%;">締め切り</th>
        <th style="width: 20%;">問題文</th>
        <th style="width: 22%;">採点基準</th>
        <th style="width: 10%;">操作</th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="7" style="text-align: center;">読み込み中...</td></tr>
    </tbody>`;

  const db = firebase.firestore();
  const query = db.collection('prompts')
                  .where('subjectId', '==', currentSubjectId)
                  .orderBy('createdAt', 'desc');

  // ★★★ リアルタイムリスナーを設定 ★★★
  unsubscribeFromPrompts = query.onSnapshot((querySnapshot) => {
    const prompts = [];
    querySnapshot.forEach((doc) => {
      prompts.push({ id: doc.id, ...doc.data() });
    });
    populatePromptTable(prompts); // テーブル描画関数を呼び出す
  }, (error) => {
    console.error("課題のリアルタイム読み込みに失敗しました:", error);
    if (table.querySelector('tbody')) {
      table.querySelector('tbody').innerHTML = `<tr><td colspan="7" style="text-align: center;">エラーが発生しました。</td></tr>`;
    }
  });
};

// ------------------------------
// テーブル描画 ★★★ 最重要修正点 ★★★
// ------------------------------
function populatePromptTable(prompts) {
  const table = document.getElementById('promptTable');
  const tbody = table.querySelector('tbody'); // 必ずtbody要素を取得する

  if (!tbody) return; // エラー防止

  tbody.innerHTML = ''; // tbodyの中身だけをクリアする

  if (prompts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">この授業の課題はまだ作成されていません。</td></tr>`;
    return;
  }

  prompts.forEach(function (prompt) {
    const row = tbody.insertRow(); // tbodyに新しい行を追加する
    row.id = 'promptRow' + prompt.id;

    // (これ以降のセル生成ロジックは変更なし)
    const fileCell = row.insertCell(0);
    const titleCell = row.insertCell(1);
    const visibilityCell = row.insertCell(2);
    const deadlineCell = row.insertCell(3);
    const questionCell = row.insertCell(4);
    const criteriaCell = row.insertCell(5);
    const actionCell = row.insertCell(6);
    
    if (prompt.questionImageUrl && typeof prompt.questionImageUrl === 'string') {
        const isPdf = prompt.questionImageUrl.toLowerCase().includes('.pdf');
        const icon = isPdf ? '📄' : '🖼️';
        fileCell.innerHTML = `<a href="${prompt.questionImageUrl}" target="_blank" class="file-icon">${icon}</a>`;
    } else {
        fileCell.innerText = 'なし';
    }
    fileCell.style.textAlign = 'center';
    titleCell.innerText = prompt.title || '(タイトルなし)';
    visibilityCell.innerText = prompt.isVisible ? '表示' : '非表示';
    if (prompt.deadline && prompt.deadline.toDate) {
      deadlineCell.innerText = prompt.deadline.toDate().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } else {
      deadlineCell.innerText = '未設定';
    }
    createTruncatedTextCell(questionCell, prompt.question);
    createTruncatedTextCell(criteriaCell, prompt.criteria);
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'action-cell-buttons';
    const editButton = document.createElement('button');
    editButton.innerText = '編集';
    editButton.classList.add('edit');
    editButton.onclick = () => editPrompt(prompt, row);
    const deleteButton = document.createElement('button');
    deleteButton.innerText = '削除';
    deleteButton.classList.add('delete');
    deleteButton.onclick = () => deletePrompt(prompt.id);
    const duplicateButton = document.createElement('button');
    duplicateButton.innerText = '複製';
    duplicateButton.classList.add('result');
    duplicateButton.onclick = () => openDuplicateModal(prompt);
    const resultButton = document.createElement('button');
    resultButton.innerText = '結果';
    resultButton.classList.add('result');
    resultButton.onclick = () => showResults(resultButton, prompt.id);
    buttonContainer.append(editButton, deleteButton, duplicateButton, resultButton);
    actionCell.appendChild(buttonContainer);
  });
}
// ------------
// ------------------
// 編集モードへの切り替え (変更なし)
// ------------------------------
function editPrompt(prompt, row) {
  const { id, criteria, title, isVisible, question, questionImageUrl, deadline } = prompt;
  
  const deadlineValue = deadline && deadline.toDate ? new Date(deadline.toDate().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '';

  row.innerHTML = '';
  const editCell = row.insertCell(0);
  editCell.colSpan = 7;
  editCell.style.padding = '20px 24px';

  editCell.innerHTML = `
    <div class="edit-form-grid">
        <label>タイトル:</label>
        <textarea id="editTitle${id}" class="edit-form-textarea">${escapeHtml(title || '')}</textarea>
        <label>表示状態:</label>
        <select id="editIsVisible${id}">
            <option value="true" ${isVisible ? 'selected' : ''}>表示</option>
            <option value="false" ${!isVisible ? 'selected' : ''}>非表示</option>
        </select>
        <label>締め切り:</label>
        <input type="datetime-local" id="editDeadline${id}" value="${deadlineValue}">
        <label>問題文:</label>
        <textarea id="editQuestion${id}" class="edit-form-textarea question">${escapeHtml(question || '')}</textarea>
        <label>採点基準:</label>
        <textarea id="editCriteria${id}" class="edit-form-textarea criteria">${escapeHtml(criteria || '')}</textarea>
        <label>画像/PDF:</label>
        <div>
           <div class="current-file">現在のファイル: ${questionImageUrl ? `<a href="${questionImageUrl}" target="_blank">表示</a>` : 'なし'}</div>
           <input type="file" id="editFileForPrompt${id}" accept="image/*,application/pdf" style="margin-top: 5px; width: 100%;">
           <div class="file-help-text">ファイルを変更する場合のみ選択してください。</div>
        </div>
        <label>操作:</label>
        <div id="edit-buttons-${id}" class="action-cell-buttons"></div>
    </div>
  `;
  
  const buttonContainer = editCell.querySelector(`#edit-buttons-${id}`);
  const saveButton = document.createElement('button');
  saveButton.innerText = '保存';
  saveButton.classList.add('edit');
  saveButton.onclick = () => savePrompt(prompt);

  const cancelButton = document.createElement('button');
  cancelButton.innerText = 'キャンセル';
  cancelButton.classList.add('cancel-button');
  cancelButton.onclick = cancelEdit;

  buttonContainer.append(saveButton, cancelButton);
}


// ------------------------------
// Firestoreへプロンプトを保存（更新）(変更なし)
// ------------------------------
async function savePrompt(originalPrompt) {
  const { id } = originalPrompt;
  const row = document.getElementById(`promptRow${id}`);
  const saveButton = row.querySelector('.edit');
  saveButton.disabled = true;
  saveButton.innerText = '保存中...';

  const newTitle = document.getElementById(`editTitle${id}`).value;
  const newIsVisible = document.getElementById(`editIsVisible${id}`).value === 'true';
  const newQuestion = document.getElementById(`editQuestion${id}`).value;
  const newCriteria = document.getElementById(`editCriteria${id}`).value;
  const newDeadlineValue = document.getElementById(`editDeadline${id}`).value;
  const fileInput = document.getElementById(`editFileForPrompt${id}`);
  const newFile = fileInput.files[0];

  try {
    const db = firebase.firestore();
    const updateData = {
      title: newTitle,
      isVisible: newIsVisible,
      question: newQuestion,
      criteria: newCriteria,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    
    if (newDeadlineValue) {
      updateData.deadline = firebase.firestore.Timestamp.fromDate(new Date(newDeadlineValue));
    } else {
      updateData.deadline = null;
    }

    if (newFile) {
      const storage = firebase.storage();
      const storageRef = storage.ref(`prompts/${window.currentTeacherId}/${id}/${newFile.name}`);
      const uploadTask = await storageRef.put(newFile);
      updateData.questionImageUrl = await uploadTask.ref.getDownloadURL();
    }

    await db.collection('prompts').doc(id).update(updateData);
    alert('保存しました。');
  } catch (error) {
    console.error('保存に失敗しました:', error);
    alert('保存に失敗しました。');
  }
}

// ------------------------------
// 編集の取り消し ★★★ 修正点 ★★★
// ------------------------------
function cancelEdit() {
  // onSnapshotはUIの変更を元に戻せないため、手動でテーブルを再描画する
  window.loadPromptTable({ subjectId: currentSubjectId });
}

// ------------------------------
// Firestoreからプロンプトを削除 (変更なし)
// ------------------------------
async function deletePrompt(id) {
  if (!confirm('削除すると元に戻せません。本当に削除しますか？')) return;

  try {
    const db = firebase.firestore();
    const storage = firebase.storage();
    await db.collection('prompts').doc(id).delete();
    
    const folderRef = storage.ref(`prompts/${window.currentTeacherId}/${id}`);
    const fileList = await folderRef.listAll();
    await Promise.all(fileList.items.map(fileRef => fileRef.delete()));
    
    alert('削除しました。');
  } catch (error) {
    console.error('削除に失敗しました:', error);
    alert('削除に失敗しました。');
  }
}

// ------------------------------
// 提出結果を表示 (変更なし)
// ------------------------------
async function showResults(button, promptId) {
    button.disabled = true;
    button.innerText = '読み込み中';

    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('submissions').where('promptId', '==', promptId).get();
        alert(`この課題への提出件数: ${snapshot.size}件`);
    } catch (error) {
        console.error('結果取得に失敗しました:', error);
        alert('結果の取得に失敗しました。');
    } finally {
        button.disabled = false;
        button.innerText = '結果';
    }
}

// ------------------------------
// 長いテキストを省略表示 (変更なし)
// ------------------------------
function createTruncatedTextCell(cell, text) {
  const fullText = text || '';
  const fullTextHtml = escapeHtml(fullText).replace(/\n/g, '<br>');

  if (fullText.length < 150 && (fullText.match(/\n/g) || []).length < 5) {
      cell.innerHTML = fullTextHtml;
      return;
  }

  cell.innerHTML = `
    <div class="truncated-text">${fullTextHtml}</div>
    <a href="#" class="toggle-link" onclick="togglePromptText(this); return false;">もっと見る</a>
  `;
}

function togglePromptText(linkElement) {
  const textDiv = linkElement.previousElementSibling;
  const isNowTruncated = textDiv.classList.toggle('truncated-text');
  linkElement.innerText = isNowTruncated ? 'もっと見る' : '閉じる';
}

// ------------------------------
// 複製モーダル関連 (変更なし)
// ------------------------------
let sourcePromptForDuplication = null;

async function openDuplicateModal(prompt) {
  sourcePromptForDuplication = prompt;
  document.getElementById('duplicate-prompt-title').innerText = prompt.title;
  await setupDuplicateFilters();
  document.getElementById('duplicate-modal').style.display = 'flex';
  document.getElementById('execute-duplicate-button').onclick = duplicatePrompt;
}

function closeDuplicateModal() {
  document.getElementById('duplicate-modal').style.display = 'none';
  sourcePromptForDuplication = null;
}

async function setupDuplicateFilters() {
    const db = firebase.firestore();
    const yearSelect = document.getElementById('duplicate-year-select');
    const classSelect = document.getElementById('duplicate-class-select');
    const subjectSelect = document.getElementById('duplicate-subject-select');
    
    const subjectsQuery = await db.collection('subjects').where('teacherIds', 'array-contains', window.currentTeacherId).get();
    const subjects = subjectsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const years = [...new Set(subjects.map(s => s.year))].sort((a, b) => b - a);
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}年度</option>`).join('');

    yearSelect.onchange = async () => {
        const selectedYear = parseInt(yearSelect.value);
        const classIds = [...new Set(subjects.filter(s => s.year === selectedYear).map(s => s.classId))];
        const classDocs = await Promise.all(classIds.map(id => db.collection('classes').doc(id).get()));
        classSelect.innerHTML = '<option value="">クラスを選択</option>' + classDocs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
        classSelect.onchange();
    };

    classSelect.onchange = () => {
        const selectedClassId = classSelect.value;
        const subjectsInClass = subjects.filter(s => s.classId === selectedClassId);
        subjectSelect.innerHTML = '<option value="">授業を選択</option>' + subjectsInClass.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    };

    if (years.length > 0) {
      yearSelect.onchange();
    }
}

async function duplicatePrompt() {
  const destinationSubjectId = document.getElementById('duplicate-subject-select').value;
  if (!destinationSubjectId) return alert('複製先の授業を選択してください。');
  if (sourcePromptForDuplication.subjectId === destinationSubjectId) return alert('同じ授業には複製できません。');

  const button = document.getElementById('execute-duplicate-button');
  button.disabled = true;
  button.innerText = '複製中...';

  try {
    const db = firebase.firestore();
    const newPromptData = {
        title: `(コピー) ${sourcePromptForDuplication.title}`,
        question: sourcePromptForDuplication.question,
        criteria: sourcePromptForDuplication.criteria,
        isVisible: false,
        teacherId: window.currentTeacherId,
        subjectId: destinationSubjectId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        deadline: null,
        questionImageUrl: sourcePromptForDuplication.questionImageUrl,
    };

    const docRef = await db.collection('prompts').add(newPromptData);

    if (sourcePromptForDuplication.questionImageUrl) {
      const storage = firebase.storage();
      const originalUrl = sourcePromptForDuplication.questionImageUrl;
      
      const response = await fetch(originalUrl);
      const fileBlob = await response.blob();
      
      const originalPath = decodeURIComponent(new URL(originalUrl).pathname.split('/o/')[1].split('?')[0]);
      const newFileName = originalPath.split('/').pop();
      const newPath = `prompts/${window.currentTeacherId}/${docRef.id}/${newFileName}`;
      
      const newFileRef = storage.ref(newPath);
      await newFileRef.put(fileBlob);
      const downloadURL = await newFileRef.getDownloadURL();
      await db.collection('prompts').doc(docRef.id).update({ questionImageUrl: downloadURL });
    }
    
    alert('課題を複製しました。');
    closeDuplicateModal();
  } catch (error) {
    console.error('課題の複製に失敗しました:', error);
    alert('複製に失敗しました。');
  } finally {
    button.disabled = false;
    button.innerText = 'この授業に複製する';
  }
}