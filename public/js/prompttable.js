/**
 * プロンプトテーブルを生成する関数
 * (ボタンのスタイルをCSSクラスで制御するように修正)
 */
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

  prompts.forEach(function(prompt) {
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
    // ★ ボタンをdivで囲み、CSSクラスを適用
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'action-cell-buttons';
    
    // 編集ボタン
    const editButton = document.createElement('button');
    editButton.innerText = '編集';
    editButton.classList.add('edit');
    editButton.onclick = function() {
      editPrompt(prompt, row);
    };
    
    // 削除ボタン
    const deleteButton = document.createElement('button');
    deleteButton.innerText = '削除';
    deleteButton.classList.add('delete');
    deleteButton.onclick = function() { deletePrompt(prompt.id); };
    
    // 結果表示ボタン
    const resultButton = document.createElement('button');
    resultButton.innerText = '結果を表示';
    resultButton.classList.add('result');
    resultButton.onclick = function() { showResults(resultButton, prompt.id); };

    buttonContainer.appendChild(editButton);
    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(resultButton);
    actionCell.appendChild(buttonContainer);
  });
}

/**
 * テーブルの指定された行を編集モードに切り替える関数
 * (保存ボタンにスピナー機能を追加)
 */
function editPrompt(prompt, row) {
  const { id, text, note, visibility, question, imageFileId } = prompt;

  const safeNote = escapeHtml(note);
  const safeText = escapeHtml(text);
  const safeQuestion = escapeHtml(question);
  const safeImageFileId = escapeHtml(imageFileId);

  row.cells[1].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editNote${id}">${safeNote}</textarea>`;
  row.cells[2].innerHTML = `
    <select id="editVisibility${id}">
      <option value="表示" ${visibility === '表示' ? 'selected' : ''}>表示</option>
      <option value="非表示" ${visibility === '非表示' ? 'selected' : ''}>非表示</option>
    </select>`;
  row.cells[3].innerHTML = `<textarea style="height: 100px; width: 100%;" id="editQuestion${id}">${safeQuestion}</textarea>`;
  row.cells[4].innerHTML = `
    <textarea style="height: 100px; width: 100%;" id="editText${id}">${safeText}</textarea>
    <div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
        <label style="font-size: 14px; font-weight: bold;">問題の画像/PDFファイル (任意)</label>
        <div>現在のファイルID: ${safeImageFileId || 'なし'}</div>
        <input type="file" id="editFileForPrompt${id}" accept="image/*,application/pdf" style="margin-top: 5px; width: 100%;">
        <div style="font-size: 11px; color: #555;">ファイルを変更する場合のみ、新しいファイルを選択してください。</div>
    </div>`;

  // --- ボタンをbutton-groupで囲む ---
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  const saveButton = document.createElement('button');
  saveButton.className = 'edit';
  saveButton.textContent = '保存';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'cancel-button';
  cancelButton.textContent = '取り消し';
  
  saveButton.onclick = function() {
    // ★★★ スピナー表示処理を追加 ★★★
    saveButton.disabled = true;
    cancelButton.disabled = true;
    saveButton.innerHTML = '保存中...<span class="btn-spinner"></span>';

    const newText = document.getElementById(`editText${id}`).value;
    const newNote = document.getElementById(`editNote${id}`).value;
    const newVisibility = document.getElementById(`editVisibility${id}`).value;
    const newQuestion = document.getElementById(`editQuestion${id}`).value;
    const fileInput = document.getElementById(`editFileForPrompt${id}`);
    const file = fileInput.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = function() {
        const base64Data = reader.result.split(',')[1];
        const fileObject = { base64Data, fileName: file.name, mimeType: file.type };
        callServerToSavePrompt(id, newText, newNote, newVisibility, newQuestion, fileObject);
      };
      reader.onerror = function() {
        showMessage('ファイルの読み込みに失敗しました。');
        cancelEdit(); // 失敗したらUIを元に戻す
      };
      reader.readAsDataURL(file);
    } else {
      callServerToSavePrompt(id, newText, newNote, newVisibility, newQuestion, null);
    }
  };
  
  cancelButton.onclick = cancelEdit;
  
  buttonGroup.appendChild(saveButton);
  buttonGroup.appendChild(cancelButton);
  row.cells[5].innerHTML = '';  
  row.cells[5].appendChild(buttonGroup);
}

/**
 * サーバーのsavePrompt関数を呼び出すヘルパー関数
 * (失敗時にUIを元に戻すように修正)
 */
function callServerToSavePrompt(id, text, note, visibility, question, fileObject) {
  google.script.run.withSuccessHandler(function(result) {
    if (result.success) {
      populatePromptTable(result.prompts);
      showMessage(result.message);
    } else {
      showMessage(result.message || '保存に失敗しました。');
      cancelEdit(); // サーバー側で論理エラーがあってもUIを元に戻す
    }
  }).withFailureHandler(function(error) {
    showMessage('エラーが発生しました: ' + error.message);
    cancelEdit(); // 通信エラーでもUIを元に戻す
  }).savePrompt(id, text, note, visibility, question, fileObject);
}

/**
 * 編集の取り消し処理（テーブルを再描画する）
 */
function cancelEdit() {
  if (teacherData && teacherData.prompts) {
    populatePromptTable(teacherData.prompts);
  } else {
    // 念のためリロード
    location.reload();
  }
}

/**
 * 長いテキストを省略し「もっと見る」リンクを付与するセルを生成する関数
 * @param {HTMLTableCellElement} cell - 対象のセル
 * @param {string} text - 表示するテキスト
 * @param {number} maxLength - この文字数を超えたら省略する
 */
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

/**
 * 「もっと見る」クリック時に表示を切り替える関数
 * @param {HTMLElement} linkElement - クリックされた<a>要素
 */
function togglePromptText(linkElement) {
  const cell = linkElement.parentElement;
  const shortTextSpan = cell.querySelector('.short-text');
  const fullTextSpan = cell.querySelector('.full-text');

  const isHidden = fullTextSpan.style.display === 'none';
  shortTextSpan.style.display = isHidden ? 'none' : 'inline';
  fullTextSpan.style.display = isHidden ? 'inline' : 'none';
  linkElement.innerText = isHidden ? '閉じる' : 'もっと見る';
}


// 結果を表示する関数（【修正版】ローディング表示付き）
function showResults(button, promptId) {
  // --- ▼ ローディング表示開始 ▼ ---
  button.disabled = true;
  const originalHTML = button.innerHTML; // 元のボタン表示を保存
  button.innerHTML = '読み込み中<span class="btn-spinner"></span>';
  // --- ▲ ローディング表示ここまで ▲ ---

  google.script.run
    .withSuccessHandler(function(results) {
      // サーバーからの応答があったので、ボタンを操作可能に戻す
      button.disabled = false;

      // ↓↓↓ ここから下の処理は、元々動いていたコードと全く同じです ↓↓↓

      // results は JSON文字列。パースして配列に
      const parsed = JSON.parse(results);
      if (parsed && Array.isArray(parsed)) {
        // プロンプトの行を取得
        const promptRow = document.getElementById('promptRow' + promptId);

        // 既に結果の行が存在するか確認
        let resultsRow = document.getElementById('resultsRow' + promptId);
        if (!resultsRow) {
          // プロンプトの次の行に結果を表示する行を挿入
          resultsRow = promptRow.parentNode.insertRow(promptRow.rowIndex + 1);
          resultsRow.id = 'resultsRow' + promptId;
          const cell = resultsRow.insertCell(0);
          cell.colSpan = 6;

          const resultDisplay = document.createElement('div');
          resultDisplay.classList.add('result-display');

          // 表を作成
          const table = document.createElement('table');
          table.style.width = '100%';
          const thead = document.createElement('thead');
          thead.innerHTML = `
            <tr>
              <th style="width: 15%;">タイムスタンプ</th>
              <th style="width: 15%;">出席番号 / 氏名</th>
              <th style="width: 10%;">採点基準ID</th>
              <th style="width: 10%;">合計点</th>
              <th style="width: 15%;">画像URL</th>
              <th style="width: 35%;">回答</th>
            </tr>
          `;
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          parsed.forEach(function(result) {
            const tr = document.createElement('tr');
            const displayName = (result.studentNumber ? result.studentNumber + ' ' : '') + (result.name || '');
            tr.innerHTML = `
              <td>${result.timestamp || ''}</td>
              <td>${displayName}</td>
              <td>${result.promptId || ''}</td>
              <td>${result.totalScore || ''}</td>
              <td><a href="${result.imageUrl || '#'}" target="_blank">画像リンク</a></td>
              <td>${result.response || ''}</td>
            `;
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          resultDisplay.appendChild(table);

          // エクスポートボタンを追加
          const exportButton = document.createElement('button');
          exportButton.innerText = 'Excelファイルをエクスポート';
          exportButton.classList.add('export-excel');
          exportButton.onclick = function() {
            exportButton.innerText = 'Excelファイルを作成中...';
            exportButton.disabled = true;
            google.script.run.withSuccessHandler(function(url) {
              if (url && url.startsWith('http')) {
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.innerText = 'ファイルの準備が完了しました。ダウンロードはこちら';
                downloadLink.style.display = 'inline-block';
                downloadLink.style.padding = '10px 15px';
                downloadLink.style.marginTop = '10px';
                downloadLink.style.backgroundColor = '#4CAF50';
                downloadLink.style.color = '#fff';
                downloadLink.style.textDecoration = 'none';
                downloadLink.style.borderRadius = '4px';
                downloadLink.style.fontSize = '16px';
                resultDisplay.appendChild(downloadLink);
                exportButton.style.display = 'none';
              } else {
                alert('Excelファイルの生成に失敗しました。');
                exportButton.innerText = 'Excelファイルをエクスポート';
                exportButton.disabled = false;
              }
            }).exportExcelFromResults(promptId);
          };
          resultDisplay.appendChild(exportButton);
          cell.appendChild(resultDisplay);
        }

        // ボタンの文言を「結果を非表示」に変更
        button.innerText = '結果を非表示';
        button.style.backgroundColor = '#ccc';
        button.onclick = function() {
          hideResults(button, promptId);
        };

      } else {
        console.error("Results are null or not an array");
      }
    })
    // --- ▼ エラー発生時の処理を追加 ▼ ---
    .withFailureHandler(function(error) {
      console.error("結果の取得に失敗しました:", error);
      alert("結果の取得中にエラーが発生しました。");
      // ローディング表示を解除し、ボタンを元の状態に戻す
      button.innerHTML = originalHTML;
      button.disabled = false;
    })
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ これが抜けていた、実行したいサーバー関数を最後に記述 ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    .getResults(promptId);
}

    function hideResults(button, promptId) {
      // 結果の行を削除
      const resultsRow = document.getElementById('resultsRow' + promptId);
      if (resultsRow) {
        resultsRow.parentNode.removeChild(resultsRow);
      }
      // ボタンを「結果を表示」に戻す
      button.innerText = '結果を表示';
      // ボタンのスタイルを元に戻す
      button.style.backgroundColor = '#5bc0de'; // 元のライトブルーに戻す
      // クリックイベントを元に戻す
      button.onclick = function() {
        showResults(button, promptId);
      };
    }


/**
 * 　プロンプトを追加する際のメイン関数
 */
function addPrompt() {
  const text = document.getElementById('newPromptText').value.trim();
  const note = document.getElementById('newPromptNote').value.trim();
  const question = document.getElementById('newQuestion').value.trim();
  const visibility = document.getElementById('newPromptVisibility').value;
  const loginId = document.getElementById('displayedLoginId').innerText;
  
  const fileInput = document.getElementById('newFileForPrompt');
  const file = fileInput.files[0];

  if (!note || !text) {
    showMessage("タイトルと採点基準は必須項目です。入力してください。");
    return;
  }

  // ファイルが選択されている場合
  if (file) {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function() {
      const base64Data = reader.result.split(',')[1];
      const fileObject = {
        base64Data: base64Data,
        fileName: file.name,
        mimeType: file.type
      };
      // ★サーバー処理を呼び出す
      callServerToAddPrompt(loginId, text, note, visibility, question, fileObject);
    };
    reader.onerror = function() {
      showMessage('ファイルの読み込みに失敗しました。');
    };
  } else {
    // ファイルが選択されていない場合
    callServerToAddPrompt(loginId, text, note, visibility, question, null);
  }
}

/**
 * ★★★ この新しい関数を追加してください ★★★
 * サーバーのaddPrompt関数を呼び出し、UIのローディング表示を制御するヘルパー関数
 */
function callServerToAddPrompt(loginId, text, note, visibility, question, fileObject) {
  // ★UI改善：ボタンを無効化し、テキストを変更
  const addButton = document.getElementById('addPromptButton');
  addButton.disabled = true;
  addButton.innerText = '追加中...';

  google.script.run.withSuccessHandler(function(result) {
    if (result.success){
      populatePromptTable(result.prompts);
      // フォームをリセット
      document.getElementById('newPromptText').value = '';
      document.getElementById('newPromptNote').value = '';
      document.getElementById('newQuestion').value = '';
      document.getElementById('newFileForPrompt').value = '';
      document.getElementById('newPromptVisibility').value = '表示';
      showMessage(result.message);
    } else {
      showMessage(result.message || '追加に失敗しました。');
    }
    // ★UI改善：ボタンの状態を元に戻す
    addButton.disabled = false;
    addButton.innerText = '採点基準を追加';
  }).withFailureHandler(function(error){
    showMessage('エラーが発生しました: ' + error.message);
    // ★UI改善：ボタンの状態を元に戻す
    addButton.disabled = false;
    addButton.innerText = '採点基準を追加';
  }).addPrompt(loginId, text, note, visibility, question, fileObject);
}

/**
 * 「保存」ボタンが押されたときの処理
 * ファイルが選択されているかどうかで処理を分岐させる
 */
function savePrompt(id) {
  // テキスト入力された値を取得
  const text = document.getElementById(`editText${id}`).value;
  const note = document.getElementById(`editNote${id}`).value;
  const visibility = document.getElementById(`editVisibility${id}`).value;
  const question = document.getElementById(`editQuestion${id}`).value;
  
  // ファイル選択の情報を取得
  const fileInput = document.getElementById(`editFileForPrompt${id}`);
  const file = fileInput.files[0];

  // ★ファイルが選択されている場合（ファイルを変更する場合）
  if (file) {
    const reader = new FileReader();
    reader.readAsDataURL(file); // ファイルを非同期で読み込み

    // ファイルの読み込みが完了したら、サーバー処理を呼び出す
    reader.onload = function() {
      const base64Data = reader.result.split(',')[1];
      const fileObject = {
        base64Data: base64Data,
        fileName: file.name,
        mimeType: file.type
      };
      // ファイル情報(fileObject)を渡してサーバーのsavePromptを呼び出す
      callServerToSavePrompt(id, text, note, visibility, question, fileObject);
    };
    reader.onerror = function() {
      showMessage('ファイルの読み込みに失敗しました。');
    };
  } else {
    // ★ファイルが選択されていない場合（ファイルは変更しない場合）
    // ファイル情報にnullを渡してサーバーのsavePromptを呼び出す
    callServerToSavePrompt(id, text, note, visibility, question, null);
  }
}

/**
 * サーバーのsavePrompt関数を呼び出すためのヘルパー関数
 */
function callServerToSavePrompt(id, text, note, visibility, question, fileObject) {
  // ローディング中のUI処理など（必要に応じて）
  
  google.script.run.withSuccessHandler(function(result) {
    if (result.success) {
      populatePromptTable(result.prompts);
      showMessage(result.message);
    } else {
      showMessage(result.message || '保存に失敗しました。');
    }
  }).withFailureHandler(function(error) {
    showMessage('エラーが発生しました: ' + error.message);
  }).savePrompt(id, text, note, visibility, question, fileObject);
}

    function deletePrompt(id) {
      if (confirm('削除すると元に戻せません。本当に削除しますか？')) {
        google.script.run.withSuccessHandler(function(result) {
          populatePromptTable(result.prompts);
          showMessage(result.message);
        }).deletePrompt(id);
      }
    }