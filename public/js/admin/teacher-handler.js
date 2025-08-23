/**
 * 登録済みの教員一覧をFirestoreから読み込んで表示する
 */
async function loadTeachers() {
    const teacherTable = document.getElementById('teacherTable');
    teacherTable.innerHTML = `<thead><tr><th>氏名</th><th>メールアドレス</th><th>状態</th></tr></thead>
                              <tbody><tr><td colspan="3">教員を読み込み中...</td></tr></tbody>`;
    try {
        const snapshot = await db.collection('users')
            .where('schoolId', '==', schoolAdminSchoolId)
            .where('role', '==', 'teacher')
            .orderBy('name', 'asc')
            .get();

        let tableBody = '<tbody>';
        if (snapshot.empty) {
            tableBody += `<tr><td colspan="3">まだ教員は登録されていません。</td></tr>`;
        } else {
            snapshot.forEach(doc => {
                const teacher = doc.data();
                // isActiveフィールドがない場合はtrue（アクティブ）として扱う
                const status = (teacher.isActive === false) ? '無効' : '有効';
                tableBody += `<tr>
                                <td>${teacher.name}</td>
                                <td>${teacher.email}</td>
                                <td>${status}</td>
                              </tr>`;
            });
        }
        tableBody += '</tbody>';
        teacherTable.innerHTML = teacherTable.querySelector('thead').outerHTML + tableBody;

    } catch (error) {
        console.error("教員一覧の読み込みに失敗しました:", error);
        teacherTable.innerHTML = `<tr><td colspan="3">教員一覧の読み込みに失敗しました。</td></tr>`;
    }
}

/**
 * 新しい教員を登録する
 */
async function registerNewTeacher() {
    const name = document.getElementById('newTeacherName').value.trim();
    const email = document.getElementById('newTeacherEmail').value.trim();
    const statusDiv = document.getElementById('registerTeacherStatus');
    const registerBtn = document.getElementById('registerTeacherBtn');

    if (!name || !email) {
        statusDiv.innerHTML = `<p class="status-error">氏名とメールアドレスを入力してください。</p>`;
        return;
    }

    registerBtn.disabled = true;
    registerBtn.innerText = '登録中...';
    statusDiv.innerHTML = `<p>処理を開始します...</p>`;

    try {
        const createTeacher = functions.httpsCallable('createTeacher');
        const result = await createTeacher({ name, email, schoolId: schoolAdminSchoolId });

        if (result.data.success) {
            statusDiv.innerHTML = `<p class="status-success">✅ ${result.data.message}</p>`;
            document.getElementById('newTeacherName').value = '';
            document.getElementById('newTeacherEmail').value = '';
            loadTeachers(); // 教員一覧を再読み込み
        } else {
            throw new Error(result.data.message || '登録に失敗しました。');
        }
    } catch (error) {
        console.error("教員の登録に失敗しました:", error);
        statusDiv.innerHTML = `<p class="status-error">❌ 登録失敗: ${error.message}</p>`;
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerText = 'この内容で登録する';
    }
}