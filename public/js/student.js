// public/js/student.js

// --- グローバル変数 ---
let globalStudentId = null;
let currentStudentInfo = {};
let subjectsCache = [];
let promptsCache = [];
let submissionsCache = [];
let selectedFile = null;
let answerMode = 'image';

/**
 * 生徒ページを初期化する
 * @param {firebase.User} user - ログインしたユーザーオブジェクト
 */
async function initializeStudentPage(user) {
    globalStudentId = user.uid;
    document.getElementById('student-page-title').innerText = user.displayName || '生徒';

    try {
        const userDoc = await db.collection('users').doc(globalStudentId).get();
        if (userDoc.exists) {
            currentStudentInfo = { id: userDoc.id, ...userDoc.data() };
        } else {
            throw new Error('生徒情報が見つかりません。');
        }
        await loadSubjectsForStudent();
    } catch (error) {
        console.error("生徒ページの初期化中に致命的なエラー:", error);
        alert(`エラー: ${error.message}`);
        logout();
    }
}

/**
 * 生徒が履修している授業をFirestoreから読み込み、プルダウンに表示する
 */
async function loadSubjectsForStudent() {
    const sel = document.getElementById('subject-select');
    sel.innerHTML = '<option value="">授業を読み込み中...</option>';
    sel.disabled = true;

    try {
        const snapshot = await db.collection('subjects')
            .where('studentIds', 'array-contains', globalStudentId)
            .where('isActive', '==', true)
            .orderBy('name')
            .get();

        subjectsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        sel.innerHTML = '<option value="">▼ 授業を選択してください</option>';
        if (subjectsCache.length === 0) {
            sel.innerHTML = '<option value="">履修中の授業がありません</option>';
            return;
        }

        subjectsCache.forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject.id;
            opt.textContent = subject.name;
            sel.add(opt);
        });

    } catch (error) {
        console.error("授業の読み込みに失敗:", error);
        sel.innerHTML = '<option value="">読み込みに失敗しました</option>';
    } finally {
        sel.disabled = false;
    }
}

/**
 * 授業が選択されたときの処理
 */
async function handleSubjectSelection() {
    const subjectId = document.getElementById('subject-select').value;
    const promptSelect = document.getElementById('prompt-select');
    const historyCard = document.getElementById('history-card');
    const submissionCard = document.getElementById('submission-card');

    promptSelect.innerHTML = '';
    promptSelect.disabled = true;
    submissionCard.style.display = 'none';
    historyCard.style.display = 'none';
    resetSubmissionArea();

    if (!subjectId) return;

    await loadPromptsForSubject(subjectId);
    await loadSubmissionsForSubject(subjectId);

    populatePromptSelect();
    populateSubmissionHistory();

    promptSelect.disabled = false;
    historyCard.style.display = 'block';
}

/**
 * 選択された授業に紐づく課題をFirestoreから読み込む
 * @param {string} subjectId - 授業のドキュメントID
 */
async function loadPromptsForSubject(subjectId) {
    const sel = document.getElementById('prompt-select');
    sel.innerHTML = '<option value="">課題を読み込み中...</option>';
    try {
        const snapshot = await db.collection('prompts')
            .where('subjectId', '==', subjectId)
            .where('isVisible', '==', true)
            .orderBy('createdAt', 'desc')
            .get();
        promptsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("課題の読み込みに失敗:", error);
        promptsCache = [];
    }
}

/**
 * 選択された授業の提出履歴をFirestoreから読み込む
 * @param {string} subjectId - 授業のドキュメントID
 */
async function loadSubmissionsForSubject(subjectId) {
    try {
        const snapshot = await db.collection('submissions')
            .where('subjectId', '==', subjectId)
            .where('studentId', '==', globalStudentId)
            .orderBy('submittedAt', 'desc')
            .get();
        submissionsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("提出履歴の読み込みに失敗:", error);
        submissionsCache = [];
    }
}

/**
 * 課題選択プルダウンを描画する（提出状況を反映）
 */
function populatePromptSelect() {
    const sel = document.getElementById('prompt-select');
    sel.innerHTML = '<option value="">▼ 課題を選択してください</option>';
    if (promptsCache.length === 0) {
        sel.innerHTML = '<option value="">提出できる課題がありません</option>';
        return;
    }
    promptsCache.forEach(prompt => {
        const isSubmitted = submissionsCache.some(s => s.promptId === prompt.id);
        const opt = document.createElement('option');
        opt.value = prompt.id;
        opt.textContent = `${isSubmitted ? '✅[提出済み] ' : '📝[未提出] '}${prompt.title}`;
        sel.add(opt);
    });
}

/**
 * 課題が選択されたときの処理
 */
async function handlePromptSelection() {
    const promptId = document.getElementById('prompt-select').value;
    const submissionCard = document.getElementById('submission-card');
    resetSubmissionArea();

    if (!promptId) {
        submissionCard.style.display = 'none';
        return;
    }

    const prompt = promptsCache.find(p => p.id === promptId);
    if (!prompt) return;

    document.getElementById('problem-text').innerText = prompt.question || '問題文はありません。';
    const problemImage = document.getElementById('problem-image');
    const pdfContainer = document.getElementById('pdf-container');
    const problemPdf = document.getElementById('problem-pdf');

    if (prompt.questionImageUrl && typeof prompt.questionImageUrl === 'string') {
        try {
            let url;
            if (prompt.questionImageUrl.startsWith('https://') || prompt.questionImageUrl.startsWith('gs://')) {
                url = await storage.refFromURL(prompt.questionImageUrl).getDownloadURL();
            } else {
                url = await storage.ref(prompt.questionImageUrl).getDownloadURL();
            }

            if (url.toLowerCase().includes('.pdf')) {
                problemPdf.src = url;
                pdfContainer.style.display = 'block';
                problemImage.style.display = 'none';
            } else {
                problemImage.src = url;
                problemImage.style.display = 'block';
                pdfContainer.style.display = 'none';
            }
        } catch (error) {
            console.error("画像URLの取得に失敗しました:", error);
            problemImage.style.display = 'none';
            pdfContainer.style.display = 'none';
        }
    } else {
        problemImage.style.display = 'none';
        pdfContainer.style.display = 'none';
    }

    submissionCard.style.display = 'block';
    const isSubmitted = submissionsCache.some(s => s.promptId === promptId);
    document.getElementById('submit-button').textContent = isSubmitted ? 'この内容で再提出する' : 'この内容で提出する';
}


/**
 * 提出履歴テーブルを描画する
 */
function populateSubmissionHistory() {
    const historyDiv = document.getElementById('submission-history');
    if (submissionsCache.length === 0) {
        historyDiv.innerHTML = '<p>この授業の提出履歴はありません。</p>';
        return;
    }
    let tableHTML = `<table id="submission-history-table"><thead><tr><th>課題名</th><th>提出日時</th><th>評価</th><th>操作</th></tr></thead><tbody>`;
    submissionsCache.forEach(submission => {
        const prompt = promptsCache.find(p => p.id === submission.promptId);
        const submittedAt = submission.submittedAt ? submission.submittedAt.toDate().toLocaleString('ja-JP') : '不明';
        const score = (submission.score !== null) ? `${submission.score}点` : '採点中';
        tableHTML += `
            <tr>
                <td>${prompt ? prompt.title : '不明な課題'}</td>
                <td>${submittedAt}</td>
                <td>${score}</td>
                <td>
                    <button class="result" onclick="showFeedback('${submission.id}')" ${!submission.feedback ? 'disabled' : ''}>
                        フィードバックを見る
                    </button>
                </td>
            </tr>`;
    });
    tableHTML += '</tbody></table>';
    historyDiv.innerHTML = tableHTML;
}

function resetSubmissionArea() {
    document.getElementById('uploadImage').value = '';
    document.getElementById('textAnswer').value = '';
    document.getElementById('studentMessage').textContent = '';
    selectedFile = null;
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

function handleImageUpload(event) {
    selectedFile = event.target.files[0];
    enableSubmitButton();
}

function enableSubmitButton() {
    const hasPrompt = !!document.getElementById('prompt-select').value;
    const hasContent = (answerMode === 'image' && selectedFile) || (answerMode === 'text' && document.getElementById('textAnswer').value.trim() !== '');
    document.getElementById('submit-button').disabled = !(hasPrompt && hasContent);
}

async function submitAnswer() {
    const subjectId = document.getElementById('subject-select').value;
    const promptId = document.getElementById('prompt-select').value;
    const subject = subjectsCache.find(s => s.id === subjectId);
    if (!subject) {
        alert("授業情報が見つかりません。");
        return;
    }

    document.getElementById('loading-overlay').style.display = 'flex';
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;

    try {
        let answerImageUrl = '';
        if (answerMode === 'image' && selectedFile) {
            const storagePath = `submissions/${currentStudentInfo.schoolId}/${subject.classId}/${subjectId}/${globalStudentId}/${Date.now()}_${selectedFile.name}`;
            const storageRef = storage.ref().child(storagePath);
            const uploadTask = await storageRef.put(selectedFile);
            answerImageUrl = await uploadTask.ref.getDownloadURL();
        }

        const textAnswer = (answerMode === 'text') ? document.getElementById('textAnswer').value.trim() : '';
        const existingSubmission = submissionsCache.find(s => s.promptId === promptId);

        const submissionData = {
            studentId: globalStudentId,
            schoolId: currentStudentInfo.schoolId,
            classId: subject.classId,
            subjectId: subjectId,
            promptId: promptId,
            answerImageUrl: answerImageUrl,
            textAnswer: textAnswer,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            score: null,
            feedback: '',
        };

        if (existingSubmission) {
            await db.collection('submissions').doc(existingSubmission.id).update(submissionData);
        } else {
            await db.collection('submissions').add(submissionData);
        }

        showMessage('提出が完了しました。');
        document.getElementById('submission-card').style.display = 'none';
        await handleSubjectSelection();

    } catch (error) {
        console.error("提出エラー:", error);
        showMessage('エラーが発生しました。もう一度お試しください。');
    } finally {
        submitButton.disabled = false;
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

function showFeedback(submissionId) {
    const submission = submissionsCache.find(s => s.id === submissionId);
    if (!submission) return;
    const modalBody = document.getElementById('feedback-modal-body');
    let contentHTML = `<h4>提出した解答</h4>`;
    if (submission.textAnswer) {
        contentHTML += `<div class="result-box">${escapeHtml(submission.textAnswer)}</div>`;
    } else if (submission.answerImageUrl) {
        contentHTML += `<img src="${submission.answerImageUrl}" style="max-width: 100%; border-radius: 4px;">`;
    }
    contentHTML += `<h4 style="margin-top: 20px;">AIからのフィードバック</h4>
                  <div class="result-box">${submission.feedback || 'フィードバックはありません。'}</div>`;
    modalBody.innerHTML = contentHTML;
    document.getElementById('feedback-modal').style.display = 'flex';
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'none';
}

function showMessage(msg) {
    const el = document.getElementById('studentMessage');
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 5000);
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
}

/**
 * ページ読み込み完了時のエントリーポイント
 */
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            initializeStudentPage(user);
        } else {
            window.location.href = 'index.html';
        }
    });
});