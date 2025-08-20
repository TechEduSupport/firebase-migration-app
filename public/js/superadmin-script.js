// public/js/superadmin-script.js

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createSchoolBtn');
    if (createBtn) {
        createBtn.addEventListener('click', createSchoolAndAdmin);
    }
});

// public/js/superadmin-script.js

/**
 * 学校と学校管理者を同時に作成する関数
 */
async function createSchoolAndAdmin() {
    const schoolName = document.getElementById('newSchoolName').value.trim();
    const adminEmail = document.getElementById('schoolAdminEmail').value.trim();
    const schoolCode = document.getElementById('newSchoolCode').value.trim(); // ★ 追加
    const statusDiv = document.getElementById('createSchoolStatus');
    const createBtn = document.getElementById('createSchoolBtn');

    // ★ schoolCodeの入力チェックを追加
    if (!schoolName || !adminEmail || !schoolCode) {
        statusDiv.innerHTML = `<p class="status-error">すべての項目を入力してください。</p>`;
        return;
    }

    createBtn.disabled = true;
    createBtn.innerText = '登録処理中...';
    statusDiv.innerHTML = `<p>処理を開始します...</p>`;

    try {
        const createSchoolFunction = firebase.functions().httpsCallable('createSchoolAndAdmin');
        // ★ schoolCodeをCloud Functionに渡す
        const result = await createSchoolFunction({ schoolName, adminEmail, schoolCode });

        if (result.data.success) {
            statusDiv.innerHTML = `<p class="status-success">✅ 登録成功: ${result.data.message}</p>`;
            document.getElementById('newSchoolName').value = '';
            document.getElementById('schoolAdminEmail').value = '';
            document.getElementById('newSchoolCode').value = ''; // ★ 追加
            loadSchools(); 
        } else {
            throw new Error(result.data.message);
        }

    } catch (error) {
        console.error('学校と管理者の作成に失敗しました:', error);
        statusDiv.innerHTML = `<p class="status-error">❌ 登録失敗: ${error.message}</p>`;
    } finally {
        createBtn.disabled = false;
        createBtn.innerText = '登録を実行';
    }
}


/**
 * Firestoreから学校一覧と管理者情報を読み込んでテーブルに表示する関数
 */
async function loadSchools() {
    const table = document.getElementById('schoolTable');
    // ★ ヘッダーを「学校ID」から「学校コード」に変更
    table.innerHTML = `<tr><th>学校名</th><th>学校コード</th><th>管理者メールアドレス</th><th>登録日</th></tr>`;

    try {
        const adminUsersSnapshot = await db.collection('users').where('role', '==', 'schooladmin').get();
        const adminMap = {}; 
        adminUsersSnapshot.forEach(doc => {
            const admin = doc.data();
            if (admin.schoolId) {
                adminMap[admin.schoolId] = admin.email;
            }
        });

        const schoolsSnapshot = await db.collection('schools').orderBy('createdAt', 'desc').get();
        if (schoolsSnapshot.empty) {
            table.innerHTML += `<tr><td colspan="4">まだ学校は登録されていません。</td></tr>`;
            return;
        }

        schoolsSnapshot.forEach(doc => {
            const school = doc.data();
            const schoolId = doc.id;
            const adminEmail = adminMap[schoolId] || '未設定'; 

            const row = table.insertRow();
            row.insertCell(0).innerText = school.name;
            row.insertCell(1).innerText = school.schoolCode || '（未設定）'; // ★ schoolCodeを表示
            row.insertCell(2).innerText = adminEmail;
            row.insertCell(3).innerText = school.createdAt.toDate().toLocaleString('ja-JP');
        });

    } catch (error) {
        console.error("学校一覧の読み込みに失敗しました:", error);
        table.innerHTML += `<tr><td colspan="4">学校一覧の読み込みに失敗しました。</td></tr>`;
    }
}