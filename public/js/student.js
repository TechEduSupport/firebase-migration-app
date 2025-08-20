// public/js/student.js

let problemDict = {};
let answerMode = 'image';
let selectedFile = null;
let lastSubmissionId = null;
let globalStudentId = null; // ログインした生徒のUIDを保持

// ------------------------------
// 生徒に紐づく課題の読み込み（新ロジック）
// ------------------------------
async function loadPromptsForStudent(studentUid) {
  const sel = document.getElementById('promptId');
  sel.innerHTML = '<option>課題を読み込み中...</option>';
  sel.disabled = true;

  try {
    // 1. 生徒が所属するクラスを探す
    const classQuery = await db.collection('classes').where('studentIds', 'array-contains', studentUid).get();
    if (classQuery.empty) {
      console.log('この生徒が所属するクラスが見つかりません。');
      sel.innerHTML = '<option>表示できる課題がありません</option>';
      return;
    }

    // 2. 所属クラスの担当教員IDをすべて集める
    let teacherIds = [];
    classQuery.forEach(doc => {
      const classData = doc.data();
      // teacherIdsはオブジェクトのキーとして保存されていると仮定
      if (classData.teachers) {
        teacherIds = teacherIds.concat(Object.keys(classData.teachers));
      }
    });

    // 重複する教員IDを削除
    const uniqueTeacherIds = [...new Set(teacherIds)];

    if (uniqueTeacherIds.length === 0) {
        console.log('担当教員が見つかりません。');
        sel.innerHTML = '<option>表示できる課題がありません</option>';
        return;
    }

    // 3. 担当教員が作成した課題を取得する
    const promptQuery = await db.collection('prompts')
      .where('teacherId', 'in', uniqueTeacherIds)
      .where('isVisible', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    // 4. プルダウンメニューを生成
    sel.innerHTML = '';
    problemDict = {};
    const firstOpt = document.createElement('option');
    firstOpt.value = '';
    firstOpt.textContent = '▼ ここから課題を選択してください';
    sel.add(firstOpt);

    promptQuery.forEach((doc) => {
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

  } catch (error) {
    console.error('課題の読み込みに失敗しました:', error);
    sel.innerHTML = '<option>課題の読み込みに失敗</option>';
  } finally {
    sel.disabled = false;
  }
}


// --- 以下の関数は既存のままですが、念のため全体を貼り付けます ---

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
    if (data.questionImageUrl && typeof data.questionImageUrl === 'string') {
        if (data.questionImageUrl.toLowerCase().includes('.pdf')) {
            questionPdf.src = data.questionImageUrl;
            questionPdfContainer.style.display = 'block';
            questionImage.style.display = 'none';
        } else {
            questionImage.src = data.questionImageUrl;
            questionImage.style.display = 'block';
            questionPdfContainer.style.display = 'none';
        }
    } else {
        questionImage.style.display = 'none';
        questionPdfContainer.style.display = 'none';
    }
    questionArea.style.display = 'block';
}

function handleImageUpload(event) {
    selectedFile = event.target.files[0];
    enableSubmitButton();
}

function selectAnswerMode(mode) {
    answerMode = mode;
    document.getElementById('btn-image').classList.toggle('active', mode === 'image');
    document.getElementById('btn-text').classList.toggle('active', mode === 'text');
    document.getElementById('image-input-area').style.display = mode === 'image' ? 'block' : 'none';
    document.getElementById('text-input-area').style.display = mode === 'text' ? 'block' : 'none';
    enableSubmitButton();
}

function enableSubmitButton() {
    const hasNameOrNumber = document.getElementById('studentName').value.trim() !== '' || document.getElementById('studentNumber').value.trim() !== '';
    const hasSelectedPrompt = document.getElementById('promptId').value.trim() !== '';
    const hasImage = answerMode === 'image' && selectedFile;
    const hasText = answerMode === 'text' && document.getElementById('textAnswer').value.trim() !== '';
    document.getElementById('submit-button').disabled = !(hasNameOrNumber && hasSelectedPrompt && (answerMode === 'image' ? hasImage : hasText));
}

function showMessage(msg) {
    const el = document.getElementById('studentMessage');
    el.innerText = msg;
    el.style.display = 'block';
}

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
            const storageRef = storage.ref().child(`submissions/${globalStudentId}/${Date.now()}_${selectedFile.name}`);
            await storageRef.put(selectedFile);
            answerImageUrl = await storageRef.getDownloadURL();
        }
        const textAnswer = answerMode === 'text' ? document.getElementById('textAnswer').value.trim() : '';

        const docRef = await db.collection('submissions').add({
            promptId,
            classId: '', // TODO: どのクラスの課題として提出したか記録
            studentId: globalStudentId, // 提出者をUIDで記録
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
    document.getElementById('rating-section').style.display = 'none';
    showProblemText();
}