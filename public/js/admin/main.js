// public/js/admin-script.js

// --- グローバル変数 ---
let schoolAdminSchoolId = null;
let selectedCsvFile = null;
let currentSchoolData = {};
let currentClassId = null;
let currentSubjectId = null; // 現在選択中の授業IDを保持する変数

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    // 表示用UIのイベントリスナー
    const displayYearSelector = document.getElementById('displayYearSelector');
    if (displayYearSelector) {
        displayYearSelector.addEventListener('change', () => {
            populateClassSelector(displayYearSelector.value);
        });
    }

    const classSelector = document.getElementById('classSelector');
    if (classSelector) {
        classSelector.addEventListener('change', () => {
            currentClassId = classSelector.value;
            const detailsContainer = document.getElementById('class-details-container');
            document.getElementById('subject-details-container').style.display = 'none'; // 授業詳細を隠す
            if (currentClassId) {
                detailsContainer.style.display = 'grid';
                switchTab('students');
                loadStudentsForClass(currentClassId);
            } else {
                detailsContainer.style.display = 'none';
            }
        });
    }

    // CSVアップロードエリアのイベントリスナー
    setupCsvUploadHandlers();

    // 新しい授業登録モーダルのイベントリスナー
    const openModalBtn = document.getElementById('openNewSubjectModalBtn');
    if (openModalBtn) { openModalBtn.addEventListener('click', openAddSubjectModal); }
    const cancelModalBtn = document.getElementById('cancelNewSubjectBtn');
    if (cancelModalBtn) { cancelModalBtn.addEventListener('click', closeAddSubjectModal); }
    const saveSubjectBtn = document.getElementById('saveNewSubjectBtn');
    if (saveSubjectBtn) { saveSubjectBtn.addEventListener('click', saveNewSubject); }

    // 授業詳細から戻るボタンのイベントリスナー
    const backBtn = document.getElementById('backToClassViewBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('subject-details-container').style.display = 'none';
            document.getElementById('class-details-container').style.display = 'grid';
            if (currentClassId) {
                loadSubjectsForClass(currentClassId);
            }
        });
    }

    // 削除ボタンのイベントリスナー
    const deleteBtn = document.getElementById('deleteSubjectBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteSubject);
    }

    // ▼▼▼ 編集関連のイベントリスナーを追加 ▼▼▼
    const editBtn = document.getElementById('editSubjectBtn');
    if (editBtn) { editBtn.addEventListener('click', openEditSubjectModal); }
    const cancelEditBtn = document.getElementById('cancelEditSubjectBtn');
    if (cancelEditBtn) { cancelEditBtn.addEventListener('click', closeEditSubjectModal); }
    const updateBtn = document.getElementById('updateSubjectBtn');
    if (updateBtn) { updateBtn.addEventListener('click', updateSubject); }

        // ▼▼▼ 教員登録ボタンのイベントリスナーを追加 ▼▼▼
    const registerTeacherBtn = document.getElementById('registerTeacherBtn');
    if (registerTeacherBtn) {
        registerTeacherBtn.addEventListener('click', registerNewTeacher);
    }
});

/**
 * 学校管理者としてログイン成功後に呼び出されるメイン関数 (★教員一覧読み込みを追加)
 */
async function onSchoolAdminLoginSuccess(schoolId) {
    schoolAdminSchoolId = schoolId;
    console.log(`学校ID: ${schoolId} の管理者としてログインしました。`);
    try {
        const schoolDoc = await db.collection('schools').doc(schoolId).get();
        if (schoolDoc.exists) {
            currentSchoolData = schoolDoc.data();
            document.getElementById('dashboard-title').innerText = `${currentSchoolData.name} 管理者ダッシュボード`;
        } else {
            throw new Error("学校情報が見つかりません。");
        }
    } catch (error) {
        console.error("学校情報の取得に失敗:", error);
        document.getElementById('dashboard-title').innerText = `管理者ダッシュボード`;
    }
    // ▼▼▼ 呼び出しを追加 ▼▼▼
    loadTeachers();
    populateYearSelectors();
}

/**
 * タブを切り替える関数
 */
function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector(`.nav-item[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
    if (tabName === 'subjects') {
        if (currentClassId) {
            loadSubjectsForClass(currentClassId);
        }
    }
}