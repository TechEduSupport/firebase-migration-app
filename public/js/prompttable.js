// public/js/prompttable.js

let unsubscribeFromPrompts = null;
let currentSubjectId = null;

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.loadPromptTable = function(options = {}) {
  // ★ 描画対象を<table>から<div>に変更
  const container = document.getElementById('prompt-card-list');
  currentSubjectId = options.subjectId || null;

  if (unsubscribeFromPrompts) {
    unsubscribeFromPrompts();
    unsubscribeFromPrompts = null;
  }
  if (!container) return;

  if (!currentSubjectId) {
    container.innerHTML = `<p class="info-box">上のメニューから授業を選択してください。</p>`;
    return;
  }
  
  container.innerHTML = `<p class="info-box">読み込み中...</p>`;

  const db = firebase.firestore();
  const query = db.collection('prompts')
                  .where('subjectId', '==', currentSubjectId)
                  .orderBy('createdAt', 'desc'); // タイムスタンプの降順で取得

  unsubscribeFromPrompts = query.onSnapshot((querySnapshot) => {
    const prompts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    populatePromptCards(prompts); // ★ 新しい描画関数を呼び出す
  }, (error) => {
    console.error("課題のリアルタイム読み込みに失敗しました:", error);
    container.innerHTML = `<p class="info-box error">エラーが発生しました。</p>`;
  });
};

/**
 * ★★★ 新規 ★★★
 * 課題カードを描画する
 */
function populatePromptCards(prompts) {
  const container = document.getElementById('prompt-card-list');
  if (!container) return;
  container.innerHTML = '';

  if (prompts.length === 0) {
    container.innerHTML = `<p class="info-box">この授業の課題はまだ作成されていません。「新規作成」タブから最初の課題を追加しましょう。</p>`;
    return;
  }

  prompts.forEach(prompt => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.id = `promptCard-${prompt.id}`;

    const deadlineText = prompt.deadline && prompt.deadline.toDate 
      ? prompt.deadline.toDate().toLocaleString('ja-JP') 
      : '未設定';
      
    let fileLink = 'なし';
    if (prompt.questionImageUrl) {
        const icon = prompt.questionImageUrl.toLowerCase().includes('.pdf') ? 'fas fa-file-pdf' : 'fas fa-file-image';
        fileLink = `<a href="${prompt.questionImageUrl}" target="_blank"><i class="${icon}"></i> ${prompt.fileName || 'ファイルを表示'}</a>`;
    }

    card.innerHTML = `
      <div class="prompt-card-header">
        <h4 class="prompt-title">${escapeHtml(prompt.title)}</h4>
        <div class="prompt-actions"></div>
      </div>
      <div class="prompt-card-body">
        <div class="prompt-card-info">
          <div class="info-item">
            <label>公開状態</label>
            <div class="toggle-switch-container"></div>
          </div>
          <div class="info-item">
            <label><i class="fas fa-calendar-alt"></i> 締め切り</label>
            <p>${deadlineText}</p>
          </div>
          <div class="info-item">
            <label><i class="fas fa-paperclip"></i> 添付ファイル</label>
            <p>${fileLink}</p>
          </div>
        </div>
        <div class="prompt-card-details">
          <div class="details-section">
            <h5>問題文</h5>
            <div class="content-text"></div>
          </div>
          <div class="details-section">
            <h5>採点基準</h5>
            <div class="content-text"></div>
          </div>
        </div>
      </div>
    `;

    // 「もっと見る」機能付きのテキストを挿入
    createTruncatedTextCell(card.querySelector('.prompt-card-details .details-section:nth-child(1) .content-text'), prompt.question, 5);
    createTruncatedTextCell(card.querySelector('.prompt-card-details .details-section:nth-child(2) .content-text'), prompt.criteria, 5);

    // 操作ボタンを生成
    const actionsContainer = card.querySelector('.prompt-actions');
    const createIconButton = (iconClass, btnClass, title, onClick) => {
        const button = document.createElement('button');
        button.className = `icon-action-button ${btnClass}`;
        button.title = title;
        button.innerHTML = `<i class="fas ${iconClass}"></i>`;
        button.onclick = (e) => { e.stopPropagation(); onClick(); };
        return button;
    };
    
    // ★★★ 編集ボタンは未実装のため、一旦コメントアウト ★★★
    // const editButton = createIconButton('fa-edit', 'edit', '編集', () => editPrompt(prompt, card));
    const deleteButton = createIconButton('fa-trash-alt', 'delete', '削除', () => deletePrompt(prompt.id));
    const duplicateButton = createIconButton('fa-copy', 'duplicate-button', '複製', () => openDuplicateModal(prompt));
    const resultButton = createIconButton('fa-chart-bar', 'result', '結果', () => showResults(prompt));
    actionsContainer.append(resultButton, duplicateButton, deleteButton); // editButton を除外

    // トグルスイッチを生成
    const toggleContainer = card.querySelector('.toggle-switch-container');
    const label = document.createElement('label');
    label.className = 'toggle-switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = prompt.isVisible;
    checkbox.onchange = () => toggleVisibility(prompt.id, checkbox.checked);
    const slider = document.createElement('span');
    slider.className = 'slider';
    label.append(checkbox, slider);
    toggleContainer.appendChild(label);

    container.appendChild(card);
  });
}

/**
 * ★★★ 新規 ★★★
 * 課題の公開状態を切り替える
 */
async function toggleVisibility(promptId, isVisible) {
  const db = firebase.firestore();
  try {
    await db.collection('prompts').doc(promptId).update({ isVisible: isVisible });
    // リアルタイム更新なのでUIは自動で追従するが、念のためフィードバック
    console.log(`課題 ${promptId} の表示状態を ${isVisible} に変更しました。`);
  } catch (error) {
    console.error("表示状態の更新に失敗しました:", error);
    alert("エラーが発生し、表示状態を更新できませんでした。");
    // 失敗した場合はUIを元に戻す
    const checkbox = document.querySelector(`#promptCard-${promptId} input[type="checkbox"]`);
    if(checkbox) checkbox.checked = !isVisible;
  }
}


// ------------------------------
// 編集機能はカードレイアウトに合わせて再実装が必要なため、一旦コメントアウト
// ------------------------------
// function editPrompt(prompt, card) { ... }
// async function savePrompt(originalPrompt) { ... }
// function cancelEdit() { ... }

// ------------------------------
// 削除機能 (変更なし)
// ------------------------------
async function deletePrompt(id) {
  if (!confirm('削除すると元に戻せません。本当に削除しますか？')) return;
  try {
    const db = firebase.firestore();
    await db.collection('prompts').doc(id).delete();
    alert('削除しました。');
  } catch (error) {
    console.error('削除に失敗しました:', error);
    alert('削除に失敗しました。');
  }
}

// ===================================
// 結果表示モーダル関連の機能 (変更なし)
// ===================================
async function showResults(prompt) {
  const modal = document.getElementById('results-modal');
  const modalTitle = document.getElementById('results-modal-title');
  const tableBody = document.getElementById('resultsTableBody');

  modalTitle.textContent = `「${prompt.title}」の提出結果`;
  tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">読み込み中...</td></tr>`;
  modal.style.display = 'flex';

  try {
    const db = firebase.firestore();
    const subjectDoc = await db.collection('subjects').doc(currentSubjectId).get();
    if (!subjectDoc.exists) throw new Error("授業情報が見つかりません。");
    
    const studentIds = subjectDoc.data().studentIds;
    if (!Array.isArray(studentIds)) {
      throw new Error("この授業に生徒が登録されていません。");
    }

    const studentPromises = studentIds.map(id => db.collection('users').doc(id).get());
    const studentSnapshots = await Promise.all(studentPromises);
    const students = studentSnapshots
      .filter(doc => doc.exists)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    const submissionsQuery = await db.collection('submissions').where('promptId', '==', prompt.id).get();
    const submissions = submissionsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const submissionMap = new Map();
    submissions.forEach(sub => {
      const existing = submissionMap.get(sub.studentId);
      if (!existing || (sub.submittedAt && existing.submittedAt && sub.submittedAt.toMillis() > existing.submittedAt.toMillis())) {
        submissionMap.set(sub.studentId, sub);
      }
    });

    const mergedData = students.map(student => ({
      ...student,
      submission: submissionMap.get(student.id) || null,
    }));
    
    mergedData.sort((a, b) => {
      const numA = parseInt(a.number, 10) || Infinity;
      const numB = parseInt(b.number, 10) || Infinity;
      return numA - numB;
    });

    populateResultsTable(mergedData);

  } catch (error) {
    console.error('結果の取得に失敗しました:', error);
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">エラーが発生しました: ${error.message}</td></tr>`;
  }
}

function populateResultsTable(data) {
  const tableBody = document.getElementById('resultsTableBody');
  tableBody.innerHTML = '';

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">この授業には生徒が登録されていません。</td></tr>`;
    return;
  }

  data.forEach(item => {
    const row = tableBody.insertRow();
    const submission = item.submission;
    
    const status = submission ? '<span class="status-chip submitted">提出済み</span>' : '<span class="status-chip not-submitted">未提出</span>';
    const submittedDate = submission && submission.submittedAt ? submission.submittedAt.toDate().toLocaleString('ja-JP') : '-';
    
    // ▼▼▼ 修正点 2 ▼▼▼
    // 評価点のフィールド名を `grade` から `score` に修正
    // 0点も表示できるように `!== undefined` でチェック
    const grade = submission && submission.score !== undefined ? escapeHtml(submission.score) : '-';
    // ▲▲▲ 修正点 2 ここまで ▲▲▲
    
    const answer = submission ? (submission.transcription || submission.textAnswer || '') : '-';
    const feedback = submission && submission.feedback ? escapeHtml(submission.feedback) : '-';
    
    let imageLink = '-';
    if (submission && submission.answerImageUrl) {
      imageLink = `<a href="${submission.answerImageUrl}" target="_blank" title="提出物を表示"><i class="fas fa-file-image"></i></a>`;
    }

    row.innerHTML = `
      <td>${escapeHtml(item.number || '')}</td>
      <td>${escapeHtml(item.name || '')}</td>
      <td>${status}</td>
      <td>${grade}</td>
      <td>${submittedDate}</td>
      <td></td>
      <td></td>
      <td style="text-align: center;">${imageLink}</td>
    `;
    
    createTruncatedTextCell(row.cells[5], answer, 5);
    createTruncatedTextCell(row.cells[6], feedback, 5);
  });
}

function closeResultsModal() {
  const modal = document.getElementById('results-modal');
  modal.style.display = 'none';
}

function createTruncatedTextCell(cell, text, lines) {
  const fullText = text || '';
  const fullTextHtml = escapeHtml(fullText).replace(/\n/g, '<br>');

  if (fullText.length < 150 && (fullText.match(/\n/g) || []).length < lines) {
      cell.innerHTML = fullTextHtml;
      return;
  }
  
  const truncatedDiv = document.createElement('div');
  truncatedDiv.className = 'truncated-text';
  truncatedDiv.innerHTML = fullTextHtml;
  truncatedDiv.style.webkitLineClamp = lines;

  const toggleLink = document.createElement('a');
  toggleLink.href = '#';
  toggleLink.className = 'toggle-link';
  toggleLink.textContent = 'もっと見る';
  toggleLink.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isNowTruncated = truncatedDiv.classList.toggle('truncated-text');
    toggleLink.textContent = isNowTruncated ? 'もっと見る' : '閉じる';
  };
  
  cell.appendChild(truncatedDiv);
  cell.appendChild(toggleLink);
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
