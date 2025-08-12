// 生徒向け機能をまとめたスクリプト
// Firestore/Storage を直接操作して課題取得と提出を行う

let problemDict = {};
let answerMode = 'image';
let selectedFile = null;
let lastSubmissionId = null;

// ------------------------------
// 課題IDの読み込み
// ------------------------------
function loadPromptIds(teacherUid) {
  const sel = document.getElementById('promptId');
  sel.innerHTML = '';
  const loadingOpt = document.createElement('option');
  loadingOpt.textContent = '課題を読み込み中...';
  sel.add(loadingOpt);
  sel.disabled = true;

  db.collection('prompts')
    .where('teacherId', '==', teacherUid)
    .where('isVisible', '==', true)
    .orderBy('createdAt', 'desc')
    .get()
    .then((snapshot) => {
      sel.innerHTML = '';
      problemDict = {};
      const firstOpt = document.createElement('option');
      firstOpt.value = '';
      firstOpt.textContent = '▼ ここから課題を選択してください';
      firstOpt.selected = true;
      sel.add(firstOpt);

      snapshot.forEach((doc) => {
        const data = doc.data();
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.text = `${doc.id} - ${data.title}`;
        sel.add(opt);
        problemDict[doc.id] = {
          question: data.question,
          questionImageUrl: data.questionImageUrl || '',
        };
      });
      sel.disabled = false;
    })
    .catch((error) => {
      console.error('課題の読み込みに失敗しました:', error);
      sel.innerHTML = '';
      const errorOpt = document.createElement('option');
      errorOpt.textContent = '課題の読み込みに失敗しました';
      sel.add(errorOpt);
    });
}

// ------------------------------
// 問題文の表示
// ------------------------------
function showProblemText() {
  const pid = document.getElementById('promptId').value;
  if (!pid) {
    document.getElementById('problem-area').style.display = 'none';
    return;
  }
  const data = problemDict[pid] || { question: '', questionImageUrl: '' };
  const questionArea = document.getElementById('problem-area');
  const questionText = document.getElementById('problem-text');
  const questionImage = document.getElementById('problem-image');
  const questionPdfContainer = document.getElementById('pdf-container');
  const questionPdf = document.getElementById('problem-pdf');

  questionText.innerText = data.question || '';
  if (data.questionImageUrl) {
    questionImage.src = data.questionImageUrl;
    questionImage.style.display = 'block';
    questionPdfContainer.style.display = 'none';
  } else {
    questionImage.style.display = 'none';
    questionPdfContainer.style.display = 'none';
  }
  questionArea.style.display = 'block';
}

// ------------------------------
// 画像アップロード時の処理
// ------------------------------
function handleImageUpload(event) {
  selectedFile = event.target.files[0];
  enableSubmitButton();
}

// ------------------------------
// 解答モードの切り替え
// ------------------------------
function selectAnswerMode(mode) {
  answerMode = mode;
  document.getElementById('btn-image').classList.toggle('active', mode === 'image');
  document.getElementById('btn-text').classList.toggle('active', mode === 'text');
  document.getElementById('image-input-area').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('text-input-area').style.display = mode === 'text' ? 'block' : 'none';
  enableSubmitButton();
}

// ------------------------------
// 送信ボタン活性化チェック
// ------------------------------
function enableSubmitButton() {
  const hasNameOrNumber =
    document.getElementById('studentName').value.trim() !== '' ||
    document.getElementById('studentNumber').value.trim() !== '';
  const hasSelectedPrompt = document.getElementById('promptId').value.trim() !== '';
  const hasImage = answerMode === 'image' && selectedFile;
  const hasText = answerMode === 'text' && document.getElementById('textAnswer').value.trim() !== '';
  document.getElementById('submit-button').disabled = !(hasNameOrNumber && hasSelectedPrompt && (answerMode === 'image' ? hasImage : hasText));
}

// ------------------------------
// メッセージ表示
// ------------------------------
function showMessage(msg) {
  const el = document.getElementById('studentMessage');
  el.innerText = msg;
  el.style.display = 'block';
}

// ------------------------------
// 課題の送信
// ------------------------------
async function submitReport() {
  const studentName = document.getElementById('studentName').value.trim();
  const studentNumber = document.getElementById('studentNumber').value.trim();
  const promptId = document.getElementById('promptId').value;

  if (!studentName && !studentNumber) {
    showMessage('氏名または出席番号を入力してください。');
    return;
  }
  if (!promptId) {
    showMessage('課題を選択してください。');
    return;
  }

  document.getElementById('loading-overlay').style.display = 'flex';
  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;

  try {
    let answerImageUrl = '';
    if (answerMode === 'image' && selectedFile) {
      const storageRef = storage
        .ref()
        .child(`submissions/${globalTeacherId}/${Date.now()}_${selectedFile.name}`);
      await storageRef.put(selectedFile);
      answerImageUrl = await storageRef.getDownloadURL();
    }
    const textAnswer = answerMode === 'text' ? document.getElementById('textAnswer').value.trim() : '';

    const docRef = await db.collection('submissions').add({
      promptId,
      classId: '',
      studentId: studentNumber || studentName,
      answerImageUrl,
      score: null,
      feedback: '',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      textAnswer,
    });
    lastSubmissionId = docRef.id;

    showMessage('送信が完了しました。');
    document.getElementById('rating-section').style.display = 'block';
    submitButton.style.display = 'none';
  } catch (error) {
    console.error('送信中にエラーが発生しました:', error);
    showMessage('エラーが発生しました。もう一度お試しください。');
    submitButton.disabled = false;
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// ------------------------------
// 採点精度の評価送信
// ------------------------------
function submitRating() {
  const rating = Number(document.getElementById('rating').value);
  if (!lastSubmissionId) return;
  db.collection('submissions')
    .doc(lastSubmissionId)
    .update({ rating })
    .then(() => {
      alert('採点精度の評価が送信されました。');
      document.getElementById('rating-section').style.display = 'none';
    })
    .catch((error) => {
      console.error('評価送信エラー:', error);
    });
}

// ------------------------------
// フォームのリセット
// ------------------------------
function resetForm() {
  document.getElementById('promptId').selectedIndex = 0;
  document.getElementById('uploadImage').value = '';
  selectedFile = null;
  document.getElementById('studentMessage').innerText = '';
  document.getElementById('textAnswer').value = '';
  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;
  submitButton.style.display = 'block';
  const ratingButton = document.getElementById('submit-rating-button');
  ratingButton.disabled = true;
  ratingButton.style.backgroundColor = '#d3d3d3';
  ratingButton.style.color = '#999';
  document.getElementById('rating-section').style.display = 'none';
  showProblemText();
}
