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
// テーブル描画
// ------------------------------
function populatePromptTable(prompts) {
  const table = document.getElementById('promptTable');
  table.innerHTML = `
    <tr>
      <th style="width: 8%;">画像/PDF</th>
      <th style="width: 15%;">タイトル</th>
      <th style="width: 8%;">表示</th>
      <th style="width: 27%;">問題文</th>
      <th style="width: 30%;">採点基準</th>
      <th style="width: 12%;">操作</th>
    </tr>`;

  prompts.forEach(function (prompt) {
    const row = table.insertRow();
    row.id = 'promptRow' + prompt.id;

    // 1. 画像/PDF列
    const fileCell = row.insertCell(0);
    // ▼▼▼ ここから修正 ▼▼▼
    // questionImageUrl が文字列型(string)である場合のみ、アイコン表示処理を行う
    if (prompt.questionImageUrl && typeof prompt.questionImageUrl === 'string') {
        const isPdf = prompt.questionImageUrl.toLowerCase().includes('.pdf');
        const icon = isPdf ? '📄' : '🖼️';
        fileCell.innerHTML = `<a href="${prompt.questionImageUrl}" target="_blank" class="file-icon">${icon}</a>`;
    } else {
        // 文字列でない場合や、空の場合は「なし」と表示
        fileCell.innerText = 'なし';
    }
    // ▲▲▲ ここまで修正 ▲▲▲
    fileCell.style.textAlign = 'center';

    // 2. タイトル列
    row.insertCell(1).innerText = prompt.note;
    // 3. 表示/非表示列
    row.insertCell(2).innerText = prompt.visibility || '表示';

    // ... (以降のコードは変更ありません) ...
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
  const { id, text, note, visibility, question, questionImageUrl } = prompt;
  const safeNote = escapeHtml(note);
  const safeText = escapeHtml(text);
  const safeQuestion = escapeHtml(question);

  // 既存のセルの内容をクリア
  row.innerHTML = '';

  // 1つのセルに全編集要素をまとめる
  const editCell = row.insertCell(0);
  editCell.colSpan = 6; // 6列分の幅を確保
  editCell.style.padding = '20px 24px'; // 内側の余白を調整して幅を揃える

  let fileSectionHtml = `
    <div class="current-file">
      現在のファイル: ${questionImageUrl ? `<a href="${questionImageUrl}" target="_blank">表示</a>` : 'なし'}
    </div>
    <input type="file" id="editFileForPrompt${id}" accept="image/*,application/pdf" style="margin-top: 5px; width: 100%;">
    <div class="file-help-text">ファイルを変更する場合のみ、新しいファイルを選択してください。</div>
  `;

  // ▼▼▼ textareaに新しいCSSクラスを追加 ▼▼▼
  editCell.innerHTML = `
    <div class="edit-form-grid">
        <label>タイトル:</label>
        <textarea id="editNote${id}" class="edit-form-textarea">${safeNote}</textarea>

        <label>表示:</label>
        <select id="editVisibility${id}">
            <option value="表示" ${visibility === '表示' ? 'selected' : ''}>表示</option>
            <option value="非表示" ${visibility === '非表示' ? 'selected' : ''}>非表示</option>
        </select>

        <label>問題文:</label>
        <textarea id="editQuestion${id}" class="edit-form-textarea question">${safeQuestion}</textarea>

        <label>採点基準:</label>
        <textarea id="editText${id}" class="edit-form-textarea criteria">${safeText}</textarea>

        <label>画像/PDF:</label>
        <div>${fileSectionHtml}</div>

        <label>操作:</label>
        <div id="edit-buttons-${id}" class="action-cell-buttons"></div>
    </div>
  `;
  // ▲▲▲ 修正ここまで ▲▲▲

  const buttonContainer = editCell.querySelector(`#edit-buttons-${id}`);
  const saveButton = document.createElement('button');
  saveButton.innerText = '保存';
  saveButton.classList.add('edit');
  saveButton.onclick = function () { savePrompt(prompt); };

  const cancelButton = document.createElement('button');
  cancelButton.innerText = 'キャンセル';
  cancelButton.classList.add('cancel-button');
  cancelButton.onclick = cancelEdit;

  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(cancelButton);
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

  const newNote = document.getElementById(`editNote${id}`).value;
  const newVisibility = document.getElementById(`editVisibility${id}`).value;
  const newQuestion = document.getElementById(`editQuestion${id}`).value;
  const newText = document.getElementById(`editText${id}`).value;
  const fileInput = document.getElementById(`editFileForPrompt${id}`);
  const newFile = fileInput.files[0];

  try {
    const updateData = {
      title: newNote,
      isVisible: newVisibility === '表示',
      question: newQuestion,
      subject: newText,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // 新しいファイルが選択された場合のみ、アップロード処理を行う
    if (newFile) {
      console.log('新しいファイルをアップロードします:', newFile.name);
      const storageRef = storage.ref(`prompts/${globalTeacherId}/${id}/${newFile.name}`);
      const uploadTask = await storageRef.put(newFile);
      const downloadURL = await uploadTask.ref.getDownloadURL();
      updateData.questionImageUrl = downloadURL;
      console.log('アップロード成功:', downloadURL);
    }

    await db.collection('prompts').doc(id).update(updateData);

    showMessage('保存しました。');
    setTimeout(() => {
      fetchTeacherPrompts(globalTeacherId);
    }, 500);

  } catch (error) {
    console.error('保存に失敗しました:', error);
    showMessage('保存に失敗しました。');
    // エラー時はUIを元に戻す
    cancelEdit();
  }
}


// ------------------------------
// 編集の取り消し
// ------------------------------
function cancelEdit() {
  fetchTeacherPrompts(globalTeacherId);
}

// ------------------------------
// Firestoreからプロンプトを削除
// ------------------------------
async function deletePrompt(id) {
  if (!confirm('削除すると元に戻せません。本当に削除しますか？')) {
    return;
  }

  // ★ UIフィードバックを追加
  const row = document.getElementById(`promptRow${id}`);
  const deleteButton = row.querySelector('.delete');
  const originalButtonText = deleteButton.innerText;
  deleteButton.disabled = true;
  deleteButton.innerText = '削除中...';


  try {
    // Firestoreからドキュメントを削除
    await db.collection('prompts').doc(id).delete();
    
    // 関連するファイルをStorageから削除
    // 注意：この処理はフォルダ内のファイルをすべて削除します。
    // 将来的に一つの課題に複数ファイルを添付する場合は、より丁寧な処理が必要です。
    const folderRef = storage.ref(`prompts/${globalTeacherId}/${id}`);
    const fileList = await folderRef.listAll();
    // 削除するファイルのPromiseを配列に格納
    const deletePromises = fileList.items.map(fileRef => fileRef.delete());
    // すべてのファイルの削除が完了するのを待つ
    await Promise.all(deletePromises);
    
    console.log('ドキュメントと関連ファイルの削除に成功しました。');
    
    showMessage('削除しました。');
    // テーブルを再描画（削除した項目が消える）
    fetchTeacherPrompts(globalTeacherId);

  } catch (error) {
    console.error('削除に失敗しました:', error);
    showMessage('削除に失敗しました。');
    // エラー時はボタンの状態を元に戻す
    deleteButton.disabled = false;
    deleteButton.innerText = originalButtonText;
  }
}

// ------------------------------
// 新しいプロンプトを追加
// ------------------------------
async function addPrompt() {
  const addButton = document.getElementById('addPromptButton');
  const originalButtonText = addButton.innerText;
  addButton.disabled = true;
  addButton.innerText = '追加中...';

  const text = document.getElementById('newPromptText').value;
  const note = document.getElementById('newPromptNote').value;
  const question = document.getElementById('newQuestion').value;
  const visibility = document.getElementById('newPromptVisibility').value === '表示';
  const file = document.getElementById('newFileForPrompt').files[0];

  try {
    const docRef = await db.collection('prompts').add({
      title: note,
      subject: text,
      question: question,
      teacherId: globalTeacherId,
      classId: '',
      questionImageUrl: '', // まずは空で作成
      isVisible: visibility,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    let downloadURL = '';
    // ファイルが選択されていれば、作成したドキュメントIDを使ってアップロード
    if (file) {
      const storageRef = storage.ref(`prompts/${globalTeacherId}/${docRef.id}/${file.name}`);
      const uploadTask = await storageRef.put(file);
      downloadURL = await uploadTask.ref.getDownloadURL();
      // ドキュメントに画像のURLを更新
      await db.collection('prompts').doc(docRef.id).update({ questionImageUrl: downloadURL });
    }

    document.getElementById('newPromptText').value = '';
    document.getElementById('newPromptNote').value = '';
    document.getElementById('newQuestion').value = '';
    document.getElementById('newPromptVisibility').value = '表示';
    document.getElementById('newFileForPrompt').value = ''; // ファイル選択をリセット

    showMessage('追加しました。');
    setTimeout(() => {
        fetchTeacherPrompts(globalTeacherId);
    }, 500);

  } catch (error) {
    console.error('追加に失敗しました:', error);
    showMessage('追加に失敗しました。');
  } finally {
    addButton.disabled = false;
    addButton.innerText = originalButtonText;
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

        // TODO: 結果をモーダルウィンドウで表示するなど、より詳細な表示方法を検討
        alert(`この課題への提出件数: ${results.length}件`);

    } catch (error) {
        console.error('結果取得に失敗しました:', error);
        alert('結果の取得に失敗しました。');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// public/js/prompttable.js

// ------------------------------
// 長いテキストを省略表示（5行基準に修正）
// ------------------------------
function createTruncatedTextCell(cell, text) {
  const fullText = text || '';
  const lineCount = (fullText.match(/\n/g) || []).length + 1;

  // 改行を<br>に変換した完全なHTMLテキスト
  const fullTextHtml = escapeHtml(fullText).replace(/\n/g, '<br>');

  // 5行以下の場合はそのまま表示
  if (lineCount <= 5) {
    cell.innerHTML = fullTextHtml;
    return;
  }

  // 5行を超える場合は、CSSで省略表示し「もっと見る」リンクを追加
  cell.innerHTML = `
    <div class="truncated-text">${fullTextHtml}</div>
    <a href="#" class="toggle-link" onclick="togglePromptText(this); return false;">もっと見る</a>
  `;
}

function togglePromptText(linkElement) {
  const cell = linkElement.parentElement;
  const textDiv = cell.querySelector('div'); // div要素を取得

  // 'truncated-text' クラスを付け外しすることで、CSSによる省略表示を切り替える
  const isNowTruncated = textDiv.classList.toggle('truncated-text');

  // リンクのテキストを切り替える
  linkElement.innerText = isNowTruncated ? 'もっと見る' : '閉じる';
}