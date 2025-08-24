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


// ------------------------------
// Firestoreから課題を読み込み、テーブルを描画する (絞り込み機能付き)
// ------------------------------
async function loadPromptTable(filters = {}) {
  const table = document.getElementById('promptTable');
  const db = firebase.firestore();
  
  currentSubjectId = filters.subjectId || null;

  if (!currentSubjectId) {
    table.innerHTML = `<tr><td colspan="7" style="text-align: center;">授業を選択してください。</td></tr>`;
    return;
  }
  
  table.innerHTML = `<tr><td colspan="7" style="text-align: center;">読み込み中...</td></tr>`;
  
  try {
    const querySnapshot = await db.collection('prompts')
                                  .where('subjectId', '==', currentSubjectId)
                                  .orderBy('createdAt', 'desc')
                                  .get();

    if (querySnapshot.empty) {
        table.innerHTML = `<tr><td colspan="7" style="text-align: center;">この授業の課題はまだ作成されていません。</td></tr>`;
        return;
    }

    const prompts = [];
    querySnapshot.forEach((doc) => {
      prompts.push({ id: doc.id, ...doc.data() });
    });

    populatePromptTable(prompts);

  } catch (error) {
    console.error("課題の読み込みに失敗しました:", error);
    table.innerHTML = `<tr><td colspan="7" style="text-align: center;">課題の読み込みに失敗しました。</td></tr>`;
  }
}


// ------------------------------
// テーブル描画
// ------------------------------
function populatePromptTable(prompts) {
  const table = document.getElementById('promptTable');
  table.innerHTML = `
    <tr>
      <th style="width: 8%;">画像/PDF</th>
      <th style="width: 15%;">タイトル</th>
      <th style="width: 10%;">表示状態</th>
      <th style="width: 15%;">締め切り</th>
      <th style="width: 20%;">問題文</th>
      <th style="width: 22%;">採点基準</th>
      <th style="width: 10%;">操作</th>
    </tr>`;

  prompts.forEach(function (prompt) {
    const row = table.insertRow();
    row.id = 'promptRow' + prompt.id;

    // 列の生成
    const fileCell = row.insertCell(0);
    const titleCell = row.insertCell(1);
    const visibilityCell = row.insertCell(2);
    const deadlineCell = row.insertCell(3);
    const questionCell = row.insertCell(4);
    const criteriaCell = row.insertCell(5);
    const actionCell = row.insertCell(6);
    
    // 1. 画像/PDF
    if (prompt.questionImageUrl && typeof prompt.questionImageUrl === 'string') {
        const isPdf = prompt.questionImageUrl.toLowerCase().includes('.pdf');
        const icon = isPdf ? '📄' : '🖼️';
        fileCell.innerHTML = `<a href="${prompt.questionImageUrl}" target="_blank" class="file-icon">${icon}</a>`;
    } else {
        fileCell.innerText = 'なし';
    }
    fileCell.style.textAlign = 'center';
    
    // 2. タイトル
    titleCell.innerText = prompt.title || '(タイトルなし)';
    
    // 3. 表示状態
    visibilityCell.innerText = prompt.isVisible ? '表示' : '非表示';
    
    // 4. 締め切り
    if (prompt.deadline && prompt.deadline.toDate) {
      deadlineCell.innerText = prompt.deadline.toDate().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } else {
      deadlineCell.innerText = '未設定';
    }

    // 5. 問題文 & 6. 採点基準
    createTruncatedTextCell(questionCell, prompt.question);
    createTruncatedTextCell(criteriaCell, prompt.subject);

    // 7. 操作ボタン
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

// ------------------------------
// 編集モードへの切り替え
// ------------------------------
function editPrompt(prompt, row) {
  const { id, subject, title, isVisible, question, questionImageUrl, deadline } = prompt;
  
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
        <textarea id="editSubject${id}" class="edit-form-textarea criteria">${escapeHtml(subject || '')}</textarea>

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
// Firestoreへプロンプトを保存（更新）
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
  const newSubject = document.getElementById(`editSubject${id}`).value;
  const newDeadlineValue = document.getElementById(`editDeadline${id}`).value;
  const fileInput = document.getElementById(`editFileForPrompt${id}`);
  const newFile = fileInput.files[0];

  try {
    const db = firebase.firestore();
    const updateData = {
      title: newTitle,
      isVisible: newIsVisible,
      question: newQuestion,
      subject: newSubject,
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
    showMessage('保存しました。');
  } catch (error) {
    console.error('保存に失敗しました:', error);
    showMessage('保存に失敗しました。');
  } finally {
    loadPromptTable({ subjectId: currentSubjectId });
  }
}

// ------------------------------
// 編集の取り消し
// ------------------------------
function cancelEdit() {
  loadPromptTable({ subjectId: currentSubjectId });
}

// ------------------------------
// Firestoreからプロンプトを削除
// ------------------------------
async function deletePrompt(id) {
  if (!confirm('削除すると元に戻せません。本当に削除しますか？')) return;

  const row = document.getElementById(`promptRow${id}`);
  const deleteButton = row.querySelector('.delete');
  deleteButton.disabled = true;
  deleteButton.innerText = '削除中...';

  try {
    const db = firebase.firestore();
    const storage = firebase.storage();
    await db.collection('prompts').doc(id).delete();
    
    const folderRef = storage.ref(`prompts/${window.currentTeacherId}/${id}`);
    const fileList = await folderRef.listAll();
    await Promise.all(fileList.items.map(fileRef => fileRef.delete()));
    
    showMessage('削除しました。');
  } catch (error) {
    console.error('削除に失敗しました:', error);
    showMessage('削除に失敗しました。');
  } finally {
    loadPromptTable({ subjectId: currentSubjectId });
  }
}

// ------------------------------
// 新しいプロンプトを追加
// ------------------------------
async function addPrompt() {
  const selectedSubjectId = document.getElementById('subject-select').value;
  if (!selectedSubjectId) {
    alert('課題を追加する授業を選択してください。');
    return;
  }

  const addButton = document.getElementById('addPromptButton');
  addButton.disabled = true;
  addButton.innerText = '追加中...';

  const title = document.getElementById('newPromptNote').value;
  const question = document.getElementById('newQuestion').value;
  const subject = document.getElementById('newPromptText').value;
  const isVisible = document.getElementById('newPromptVisibility').value === '表示';
  const deadlineValue = document.getElementById('deadline').value;
  const file = document.getElementById('newFileForPrompt').files[0];

  try {
    const db = firebase.firestore();
    const newPromptData = {
      title, question, subject, isVisible,
      teacherId: window.currentTeacherId,
      subjectId: selectedSubjectId,
      questionImageUrl: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      deadline: deadlineValue ? firebase.firestore.Timestamp.fromDate(new Date(deadlineValue)) : null,
    };

    const docRef = await db.collection('prompts').add(newPromptData);

    if (file) {
      const storage = firebase.storage();
      const storageRef = storage.ref(`prompts/${window.currentTeacherId}/${docRef.id}/${file.name}`);
      const uploadTask = await storageRef.put(file);
      const downloadURL = await uploadTask.ref.getDownloadURL();
      await db.collection('prompts').doc(docRef.id).update({ questionImageUrl: downloadURL });
    }
    
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newPromptText').value = '';
    document.getElementById('deadline').value = '';
    document.getElementById('newFileForPrompt').value = '';
    
    showMessage('追加しました。');
  } catch (error) {
    console.error('追加に失敗しました:', error);
    showMessage('追加に失敗しました。');
  } finally {
    addButton.disabled = false;
    addButton.innerText = '採点基準を追加';
    loadPromptTable({ subjectId: currentSubjectId });
  }
}


// ------------------------------
// 提出結果を表示
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
// 長いテキストを省略表示 ★★★ここを修正★★★
// ------------------------------
function createTruncatedTextCell(cell, text) {
  // textがnullやundefinedの場合、空文字列として扱う
  const fullText = text || '';
  const fullTextHtml = escapeHtml(fullText).replace(/\n/g, '<br>');
  const lineCount = (fullText.match(/\n/g) || []).length + 1;

  if (lineCount <= 5) {
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
// 複製モーダル関連
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
        classSelect.onchange(); // 授業のリストを更新
    };

    classSelect.onchange = () => {
        const selectedClassId = classSelect.value;
        const subjectsInClass = subjects.filter(s => s.classId === selectedClassId);
        subjectSelect.innerHTML = '<option value="">授業を選択</option>' + subjectsInClass.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    };

    if (years.length > 0) {
      yearSelect.onchange(); // 初期読み込み
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
        subject: sourcePromptForDuplication.subject,
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
      
      // CORSの問題を回避するためにfetchを使用
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
    
    showMessage('課題を複製しました。');
    closeDuplicateModal();
    loadPromptTable({ subjectId: currentSubjectId });
  } catch (error) {
    console.error('課題の複製に失敗しました:', error);
    showMessage('複製に失敗しました。');
  } finally {
    button.disabled = false;
    button.innerText = 'この授業に複製する';
  }
}