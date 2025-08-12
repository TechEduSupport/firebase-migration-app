/**
 * プロンプト管理用のテーブル操作
 * Firestoreを直接操作して課題を追加・編集・削除する
 */

// ------------------------------
// テーブル描画
// ------------------------------
function populatePromptTable(prompts) {
  const table = document.getElementById('promptTable');
  table.innerHTML = `
    <tr>
      <th style="width: 5%;">ID</th>
      <th style="width: 15%;">タイトル</th>
      <th style="width: 8%;">表示</th>
      <th style="width: 30%;">問題文</th>
      <th style="width: 30%;">採点基準</th>
      <th style="width: 12%;">操作</th>
    </tr>`;

  prompts.forEach(function (prompt) {
    const row = table.insertRow();
    row.id = 'promptRow' + prompt.id;

    row.insertCell(0).innerText = prompt.id;
    row.insertCell(1).innerText = prompt.note;
    row.insertCell(2).innerText = prompt.visibility || '表示';

    const questionCell = row.insertCell(3);
    createTruncatedTextCell(questionCell, prompt.question, 80);

    const criteriaCell = row.insertCell(4);
    createTruncatedTextCell(criteriaCell, prompt.text, 80);

    const actionCell = row.insertCell(5);
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'action-cell-buttons';

    const editButton = document.createElement('button');
    editButton.innerText = '編集';
    editButton.classList.add('edit');
    editButton.onclick = function () {
      editPrompt(prompt, row);
    };

    const deleteButton = document.createElement('button');
    deleteButton.innerText = '削除';
    deleteButton.classList.add('delete');
    deleteButton.onclick = function () {
      deletePrompt(prompt.id);
    };

    const resultButton = document.createElement('button');
    resultButton.innerText = '結果を表示';
    resultButton.classList.add('result');
    resultButton.onclick = function () {
      showResults(resultButton, prompt.id);
    };

    buttonContainer.appendChild(editButton);
    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(resultButton);
    actionCell.appendChild(buttonContainer);
  });
}

// ------------------------------
// 編集モードへの切り替え
// ------------------------------
function editPrompt(prompt, row) {
  const { id, text, note, visibility, question } = prompt;
  const safeNote = escapeHtml(note);
  const safeText = escapeHtml(text);
  const safeQuestion = escapeHtml(question);

  row.cells[1].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editNote${id}">${safeNote}</textarea>`;
  row.cells[2].innerHTML = `
    <select id="editVisibility${id}">
      <option value="表示" ${visibility === '表示' ? 'selected' : ''}>表示</option>
      <option value="非表示" ${visibility === '非表示' ? 'selected' : ''}>非表示</option>
    </select>`;
  row.cells[3].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editQuestion${id}">${safeQuestion}</textarea>`;
  row.cells[4].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editText${id}">${safeText}</textarea>`;

  const buttonGroup = document.createElement('div');
  const saveButton = document.createElement('button');
  saveButton.innerText = '保存';
  saveButton.onclick = function () {
    savePrompt(id);
  };
  const cancelButton = document.createElement('button');
  cancelButton.innerText = 'キャンセル';
  cancelButton.onclick = cancelEdit;

  buttonGroup.appendChild(saveButton);
  buttonGroup.appendChild(cancelButton);
  row.cells[5].innerHTML = '';
  row.cells[5].appendChild(buttonGroup);
}

// ------------------------------
// 編集の取り消し
// ------------------------------
function cancelEdit() {
  fetchTeacherPrompts(globalTeacherId);
}

// ------------------------------
// Firestoreへプロンプトを保存（更新）
// ------------------------------
async function savePrompt(id) {
  const text = document.getElementById(`editText${id}`).value;
  const note = document.getElementById(`editNote${id}`).value;
  const visibility = document.getElementById(`editVisibility${id}`).value;
  const question = document.getElementById(`editQuestion${id}`).value;

  try {
    await db.collection('prompts').doc(id).update({
      title: note,
      subject: text,
      question: question,
      isVisible: visibility === '表示',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    fetchTeacherPrompts(globalTeacherId);
    showMessage('保存しました。');
  } catch (error) {
    console.error('保存に失敗しました:', error);
    showMessage('保存に失敗しました。');
  }
}

// ------------------------------
// Firestoreからプロンプトを削除
// ------------------------------
async function deletePrompt(id) {
  if (!confirm('削除すると元に戻せません。本当に削除しますか？')) return;
  try {
    await db.collection('prompts').doc(id).delete();
    fetchTeacherPrompts(globalTeacherId);
    showMessage('削除しました。');
  } catch (error) {
    console.error('削除に失敗しました:', error);
    showMessage('削除に失敗しました。');
  }
}

// ------------------------------
// 新しいプロンプトを追加
// ------------------------------
async function addPrompt() {
  const text = document.getElementById('newPromptText').value;
  const note = document.getElementById('newPromptNote').value;
  const question = document.getElementById('newQuestion').value;
  const visibility = document.getElementById('newPromptVisibility').value === '表示';

  try {
    await db.collection('prompts').add({
      title: note,
      subject: text,
      question: question,
      teacherId: globalTeacherId,
      classId: '',
      questionImageUrl: '',
      isVisible: visibility,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    document.getElementById('newPromptText').value = '';
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newPromptVisibility').value = '表示';

    fetchTeacherPrompts(globalTeacherId);
    showMessage('追加しました。');
  } catch (error) {
    console.error('追加に失敗しました:', error);
    showMessage('追加に失敗しました。');
  }
}

// ------------------------------
// 提出結果を表示
// ------------------------------
async function showResults(button, promptId) {
  button.disabled = true;
  const originalHTML = button.innerHTML;
  button.innerHTML = '読み込み中';

  try {
    const snapshot = await db
      .collection('submissions')
      .where('promptId', '==', promptId)
      .orderBy('submittedAt', 'desc')
      .get();

    const results = [];
    snapshot.forEach((doc) => {
      results.push(doc.data());
    });

    // 表示処理（元の実装を簡略化）
    alert(`結果件数: ${results.length}`);
  } catch (error) {
    console.error('結果取得に失敗しました:', error);
    alert('結果の取得に失敗しました。');
  } finally {
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

// ------------------------------
// 長いテキストを省略表示
// ------------------------------
function createTruncatedTextCell(cell, text, maxLength) {
  const fullText = text || '';
  if (fullText.length <= maxLength) {
    cell.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>');
    return;
  }
  const shortText = fullText.substring(0, maxLength) + '...';
  cell.innerHTML = `
    <span class="short-text">${escapeHtml(shortText)}</span>
    <span class="full-text" style="display:none;">${escapeHtml(fullText).replace(/\n/g, '<br>')}</span>
    <a class="toggle-link" onclick="togglePromptText(this); return false;">もっと見る</a>
  `;
}

function togglePromptText(linkElement) {
  const cell = linkElement.parentElement;
  const shortTextSpan = cell.querySelector('.short-text');
  const fullTextSpan = cell.querySelector('.full-text');
  const isHidden = fullTextSpan.style.display === 'none';
  shortTextSpan.style.display = isHidden ? 'none' : 'inline';
  fullTextSpan.style.display = isHidden ? 'inline' : 'none';
  linkElement.innerText = isHidden ? '閉じる' : 'もっと見る';
}
