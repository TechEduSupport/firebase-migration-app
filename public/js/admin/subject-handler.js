

/**
 * 授業一覧を読み込む関数
 */
async function loadSubjectsForClass(classId) {
    const subjectTable = document.getElementById('subjectTable');
    subjectTable.innerHTML = `<thead><tr><th>授業名</th><th>担当教員</th><th>受講生徒数</th></tr></thead><tbody><tr><td colspan="3">授業を読み込み中...</td></tr></tbody>`;
    try {
        const snapshot = await db.collection('subjects').where('classId', '==', classId).orderBy('name', 'asc').get();
        let tableBody = '<tbody>';
        if (snapshot.empty) {
            tableBody += `<tr><td colspan="3">まだ授業は登録されていません。</td></tr>`;
        } else {
            const teacherIds = new Set();
            snapshot.docs.forEach(doc => doc.data().teacherIds.forEach(id => teacherIds.add(id)));
            const teacherMap = new Map();
            if (teacherIds.size > 0) {
                const teacherDocs = await Promise.all(Array.from(teacherIds).map(id => db.collection('users').doc(id).get()));
                teacherDocs.forEach(doc => { if(doc.exists) teacherMap.set(doc.id, doc.data().name); });
            }
            snapshot.forEach(doc => {
                const subject = doc.data();
                const teacherNames = subject.teacherIds.map(id => teacherMap.get(id) || '不明').join(', ');
                const studentCount = subject.studentIds ? subject.studentIds.length : 0;
                tableBody += `<tr onclick="showSubjectDetails('${doc.id}', '${subject.name}')"><td>${subject.name}</td><td>${teacherNames}</td><td>${studentCount}名</td></tr>`;
            });
        }
        tableBody += '</tbody>';
        subjectTable.innerHTML = subjectTable.querySelector('thead').outerHTML + tableBody;
    } catch (error) {
        console.error("授業一覧の読み込みに失敗:", error);
        subjectTable.innerHTML = `<tr><td colspan="3">授業一覧の読み込みに失敗しました。</td></tr>`;
    }
}

/**
 * 授業登録モーダルを開く関数
 */
async function openAddSubjectModal() {
    const teacherListDiv = document.getElementById('teacher-checkbox-list');
    const studentListDiv = document.getElementById('student-checkbox-list');
    teacherListDiv.innerHTML = '読み込み中...';
    studentListDiv.innerHTML = '読み込み中...';
    document.getElementById('addSubjectModal').style.display = 'flex';
    try {
        const teacherSnapshot = await db.collection('users').where('schoolId', '==', schoolAdminSchoolId).where('role', '==', 'teacher').orderBy('name', 'asc').get();
        teacherListDiv.innerHTML = '';
        if (teacherSnapshot.empty) {
            teacherListDiv.innerText = '登録されている先生がいません。';
        } else {
            teacherSnapshot.forEach(doc => {
                const teacher = doc.data();
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${doc.id}"> ${teacher.name}`;
                teacherListDiv.appendChild(label);
            });
        }
        
        // ▼▼▼ ここから修正 ▼▼▼
        const classDoc = await db.collection('classes').doc(currentClassId).get();
        const studentIdMap = classDoc.data().studentIds || {}; // studentIdsはマップ（オブジェクト）
        const studentIds = Object.keys(studentIdMap); // Object.keys()でキー（生徒UID）の配列を取得
        
        studentListDiv.innerHTML = '';
        if (studentIds.length > 0) {
            const studentPromises = studentIds.map(id => db.collection('users').doc(id).get());
            const studentDocs = await Promise.all(studentPromises);
            studentDocs.forEach(doc => {
                if (doc.exists) {
                    const student = doc.data();
                    const label = document.createElement('label');
                    // すべての生徒をデフォルトでチェック状態にする
                    label.innerHTML = `<input type="checkbox" value="${doc.id}" checked> ${student.studentNumber || ''} ${student.name}`;
                    studentListDiv.appendChild(label);
                }
            });
        // ▲▲▲ ここまで修正 ▲▲▲
        } else {
            studentListDiv.innerText = 'このクラスには生徒が登録されていません。';
        }
    } catch (error) {
        console.error("モーダルデータの読み込みに失敗:", error);
        teacherListDiv.innerText = 'エラーが発生しました。';
        studentListDiv.innerText = 'エラーが発生しました。';
    }
}

/**
 * 授業登録モーダルを閉じる関数
 */
function closeAddSubjectModal() {
    document.getElementById('addSubjectModal').style.display = 'none';
    document.getElementById('newSubjectName').value = '';
    document.getElementById('newSubjectDescription').value = '';
    document.getElementById('teacher-checkbox-list').innerHTML = '';
    document.getElementById('student-checkbox-list').innerHTML = '';
}

/**
 * 新しい授業を保存する関数
 */
async function saveNewSubject() {
    const saveButton = document.getElementById('saveNewSubjectBtn');
    saveButton.disabled = true;
    saveButton.innerText = '登録中...';
    try {
        const name = document.getElementById('newSubjectName').value.trim();
        const description = document.getElementById('newSubjectDescription').value.trim();
        const selectedTeacherIds = Array.from(document.querySelectorAll('#teacher-checkbox-list input:checked')).map(cb => cb.value);
        const selectedStudentIds = Array.from(document.querySelectorAll('#student-checkbox-list input:checked')).map(cb => cb.value);
        if (!name || selectedTeacherIds.length === 0) {
            alert('授業名と担当教員は必須です。');
            throw new Error("Validation failed");
        }
        const createSubject = functions.httpsCallable('createSubject');
        const result = await createSubject({ name, description, year: Number(document.getElementById('displayYearSelector').value), schoolId: schoolAdminSchoolId, classId: currentClassId, teacherIds: selectedTeacherIds, studentIds: selectedStudentIds });
        if (result.data.success) {
            closeAddSubjectModal();
            loadSubjectsForClass(currentClassId);
        } else {
            throw new Error(result.data.message || '登録に失敗しました。');
        }
    } catch (error) {
        console.error("授業の登録に失敗しました:", error);
        alert(`エラー: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.innerText = 'この内容で登録する';
    }
}

/**
 * 授業詳細ビューを表示する関数
 */
function showSubjectDetails(subjectId, subjectName) {
    currentSubjectId = subjectId;
    document.getElementById('class-details-container').style.display = 'none';
    document.getElementById('subject-details-container').style.display = 'block';
    document.getElementById('subject-details-title').innerText = `「${subjectName}」の詳細`;
    loadStudentsForSubject(subjectId);
    loadPromptsForSubject(subjectId);
}

/**
 * 授業に登録されている生徒一覧を表示する
 */
async function loadStudentsForSubject(subjectId) {
    const table = document.getElementById('subjectStudentTable');
    table.innerHTML = `<thead><tr><th>学生番号</th><th>氏名</th></tr></thead><tbody><tr><td colspan="2">受講生徒を読み込み中...</td></tr></tbody>`;
    try {
        const subjectDoc = await db.collection('subjects').doc(subjectId).get();
        if (!subjectDoc.exists) throw new Error("授業データが見つかりません。");
        const studentIds = subjectDoc.data().studentIds || [];
        if (studentIds.length === 0) {
            table.innerHTML = `<thead><tr><th>学生番号</th><th>氏名</th></tr></thead><tbody><tr><td colspan="2">この授業には生徒が登録されていません。</td></tr></tbody>`;
            return;
        }
        const studentPromises = studentIds.map(id => db.collection('users').doc(id).get());
        const studentDocs = await Promise.all(studentPromises);
        let tableBody = '<tbody>';
        studentDocs.forEach(doc => {
            if (doc.exists) {
                const student = doc.data();
                tableBody += `<tr><td>${student.studentNumber || '（未設定）'}</td><td>${student.name}</td></tr>`;
            }
        });
        tableBody += '</tbody>';
        table.innerHTML = table.querySelector('thead').outerHTML + tableBody;
    } catch (error) {
        console.error("受講生徒一覧の読み込みに失敗:", error);
        table.innerHTML = `<tr><td colspan="2">受講生徒一覧の読み込みに失敗しました。</td></tr>`;
    }
}

/**
 * 授業に紐づく課題一覧を表示する
 */
async function loadPromptsForSubject(subjectId) {
    const table = document.getElementById('promptListForSubjectTable');
    table.innerHTML = `<thead><tr><th>課題タイトル</th><th>作成日</th></tr></thead><tbody><tr><td colspan="2">課題を読み込み中...</td></tr></tbody>`;
    try {
        const snapshot = await db.collection('prompts').where('subjectId', '==', subjectId).orderBy('createdAt', 'desc').get();
        let tableBody = '<tbody>';
        if (snapshot.empty) {
            tableBody += `<tr><td colspan="2">この授業にはまだ課題がありません。</td></tr>`;
        } else {
            snapshot.forEach(doc => {
                const prompt = doc.data();
                const createdAt = prompt.createdAt ? prompt.createdAt.toDate().toLocaleDateString('ja-JP') : '不明';
                tableBody += `<tr><td>${prompt.title}</td><td>${createdAt}</td></tr>`;
            });
        }
        tableBody += '</tbody>';
        table.innerHTML = table.querySelector('thead').outerHTML + tableBody;
    } catch (error) {
        console.error("課題一覧の読み込みに失敗:", error);
        table.innerHTML = `<tr><td colspan="2">課題一覧の読み込みに失敗しました。</td></tr>`;
    }
}

/**
 * 現在表示している授業を削除する関数
 */
async function deleteSubject() {
    if (!currentSubjectId) {
        alert("授業が選択されていません。");
        return;
    }
    const subjectName = document.getElementById('subject-details-title').innerText;
    if (!confirm(`${subjectName}を削除します。この操作は元に戻せません。\n本当によろしいですか？`)) {
        return;
    }
    const deleteButton = document.getElementById('deleteSubjectBtn');
    deleteButton.disabled = true;
    deleteButton.innerText = '削除中...';
    try {
        const deleteSubjectFunction = functions.httpsCallable('deleteSubject');
        const result = await deleteSubjectFunction({ subjectId: currentSubjectId });
        if (result.data.success) {
            alert("授業を削除しました。");
            document.getElementById('subject-details-container').style.display = 'none';
            document.getElementById('class-details-container').style.display = 'grid';
            loadSubjectsForClass(currentClassId);
        } else {
            throw new Error(result.data.message || '削除に失敗しました。');
        }
    } catch (error) {
        console.error("授業の削除に失敗しました:", error);
        alert(`エラー: ${error.message}`);
    } finally {
        deleteButton.disabled = false;
        deleteButton.innerText = '削除';
    }
}

/**
 * 授業編集モーダルを開き、既存のデータを表示する
 */
async function openEditSubjectModal() {
    if (!currentSubjectId) return;

    const modal = document.getElementById('editSubjectModal');
    const teacherListDiv = document.getElementById('edit-teacher-checkbox-list');
    const studentListDiv = document.getElementById('edit-student-checkbox-list');
    teacherListDiv.innerHTML = '読み込み中...';
    studentListDiv.innerHTML = '読み込み中...';
    modal.style.display = 'flex';

    try {
        // 授業の現在のデータを取得
        const subjectDoc = await db.collection('subjects').doc(currentSubjectId).get();
        if (!subjectDoc.exists) throw new Error("授業データが見つかりません。");
        const subjectData = subjectDoc.data();

        // フォームに現在の値を設定
        document.getElementById('editSubjectName').value = subjectData.name;
        document.getElementById('editSubjectDescription').value = subjectData.description || '';

        // 学校の全先生リストを取得し、現在の担当教員にチェックを入れる
        const teacherSnapshot = await db.collection('users').where('schoolId', '==', schoolAdminSchoolId).where('role', '==', 'teacher').orderBy('name', 'asc').get();
        teacherListDiv.innerHTML = '';
        teacherSnapshot.forEach(doc => {
            const teacher = doc.data();
            const isChecked = subjectData.teacherIds.includes(doc.id) ? 'checked' : '';
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${doc.id}" ${isChecked}> ${teacher.name}`;
            teacherListDiv.appendChild(label);
        });

        // クラスの全生徒リストを取得し、現在の受講生徒にチェックを入れる
        const classDoc = await db.collection('classes').doc(currentClassId).get();
        const studentIdsInClass = classDoc.data().studentIds || [];
        studentListDiv.innerHTML = '';
        if (studentIdsInClass.length > 0) {
            const studentPromises = studentIdsInClass.map(id => db.collection('users').doc(id).get());
            const studentDocs = await Promise.all(studentPromises);
            studentDocs.forEach(doc => {
                if (doc.exists) {
                    const student = doc.data();
                    const isChecked = subjectData.studentIds.includes(doc.id) ? 'checked' : '';
                    const label = document.createElement('label');
                    label.innerHTML = `<input type="checkbox" value="${doc.id}" ${isChecked}> ${student.studentNumber || ''} ${student.name}`;
                    studentListDiv.appendChild(label);
                }
            });
        } else {
            studentListDiv.innerText = 'このクラスには生徒が登録されていません。';
        }

    } catch (error) {
        console.error("編集モーダルのデータ読み込みに失敗:", error);
        alert("編集情報の読み込みに失敗しました。");
        closeEditSubjectModal();
    }
}

/**
 * 授業編集モーダルを閉じる
 */
function closeEditSubjectModal() {
    document.getElementById('editSubjectModal').style.display = 'none';
}

/**
 * 授業情報を更新する
 */
async function updateSubject() {
    const updateButton = document.getElementById('updateSubjectBtn');
    updateButton.disabled = true;
    updateButton.innerText = '更新中...';

    try {
        const name = document.getElementById('editSubjectName').value.trim();
        const description = document.getElementById('editSubjectDescription').value.trim();
        const selectedTeacherIds = Array.from(document.querySelectorAll('#edit-teacher-checkbox-list input:checked')).map(cb => cb.value);
        const selectedStudentIds = Array.from(document.querySelectorAll('#edit-student-checkbox-list input:checked')).map(cb => cb.value);

        if (!name || selectedTeacherIds.length === 0) {
            alert('授業名と担当教員は必須です。');
            throw new Error("Validation failed");
        }

        const updateSubjectFunction = functions.httpsCallable('updateSubject');
        const result = await updateSubjectFunction({
            subjectId: currentSubjectId,
            name,
            description,
            teacherIds: selectedTeacherIds,
            studentIds: selectedStudentIds
        });

        if (result.data.success) {
            alert('授業情報を更新しました。');
            closeEditSubjectModal();
            // 画面の表示を更新
            document.getElementById('subject-details-title').innerText = `「${name}」の詳細`;
            loadStudentsForSubject(currentSubjectId);
        } else {
            throw new Error(result.data.message || '更新に失敗しました。');
        }

    } catch (error) {
        console.error("授業の更新に失敗しました:", error);
        alert(`エラー: ${error.message}`);
    } finally {
        updateButton.disabled = false;
        updateButton.innerText = 'この内容で更新する';
    }
}