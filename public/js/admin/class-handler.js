/**
 * 2つの年度選択プルダウンを生成する
 */
function populateYearSelectors() {
    const importSelector = document.getElementById('importYearSelector');
    const displaySelector = document.getElementById('displayYearSelector');
    const currentYear = new Date().getFullYear();
    [importSelector, displaySelector].forEach(selector => {
        selector.innerHTML = '';
        for (let i = currentYear + 1; i >= currentYear - 5; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.text = `${i}年度`;
            selector.add(option);
        }
        selector.value = currentYear;
    });
    populateClassSelector(currentYear);
}

/**
 * 指定年度のクラスを読み込み、クラス選択プルダウンを更新する
 */
async function populateClassSelector(year) {
    const selector = document.getElementById('classSelector');
    selector.innerHTML = '<option value="">クラスを読み込み中...</option>';
    document.getElementById('class-details-container').style.display = 'none';
    document.getElementById('subject-details-container').style.display = 'none';
    document.getElementById('studentTable').innerHTML = '';
    document.getElementById('studentCount').innerText = '0名';
    try {
        const snapshot = await db.collection('classes').where('schoolId', '==', schoolAdminSchoolId).where('year', '==', Number(year)).orderBy('name', 'asc').get();
        selector.innerHTML = '<option value="">クラスを選択してください</option>';
        if (snapshot.empty) return;
        snapshot.forEach(doc => {
            const classData = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.text = classData.name;
            selector.add(option);
        });
    } catch (error) {
        console.error(`${year}年度のクラス読み込みに失敗:`, error);
        selector.innerHTML = '<option value="">読込失敗</option>';
    }
}

/**
 * 指定されたクラスの生徒一覧をFirestoreから読み込んで表示する
 */
async function loadStudentsForClass(classId) {
    const studentTable = document.getElementById('studentTable');
    studentTable.innerHTML = `<thead><tr><th>学生番号</th><th>氏名</th><th>メールアドレス</th></tr></thead><tbody><tr><td colspan="3">生徒を読み込み中...</td></tr></tbody>`;
    document.getElementById('studentCount').innerText = '0名';
    if (!classId) {
        studentTable.innerHTML = '';
        return;
    }
    try {
        const classDoc = await db.collection('classes').doc(classId).get();
        if (!classDoc.exists) throw new Error("クラスデータが見つかりません。");

        // ▼▼▼ ここから修正 ▼▼▼
        const studentIdMap = classDoc.data().studentIds || {}; // studentIdsはマップ（オブジェクト）
        const studentIds = Object.keys(studentIdMap); // Object.keys()でキー（生徒UID）の配列を取得

        document.getElementById('studentCount').innerText = `${studentIds.length}名`;
        if (studentIds.length === 0) {
            studentTable.innerHTML = `<thead><tr><th>学生番号</th><th>氏名</th><th>メールアドレス</th></tr></thead><tbody><tr><td colspan="3">このクラスにはまだ生徒が登録されていません。</td></tr></tbody>`;
            return;
        }

        const studentPromises = studentIds.map(uid => db.collection('users').doc(uid).get());
        // ▲▲▲ ここまで修正 ▲▲▲
        
        const studentDocs = await Promise.all(studentPromises);
        let studentTableBody = '<tbody>';
        studentDocs.forEach(doc => {
            if (doc.exists) {
                const student = doc.data();
                studentTableBody += `<tr><td>${student.studentNumber || '（未設定）'}</td><td>${student.name}</td><td>${student.email.endsWith('.local') ? '（なし）' : student.email}</td></tr>`;
            }
        });
        studentTableBody += '</tbody>';
        studentTable.innerHTML = studentTable.querySelector('thead').outerHTML + studentTableBody;
    } catch (error) {
        console.error("生徒一覧の読み込みに失敗:", error);
        studentTable.innerHTML = `<tr><td colspan="3">生徒一覧の読み込みに失敗しました。</td></tr>`;
    }
}

/**
 * CSVアップロード関連の処理
 */
function setupCsvUploadHandlers() {
    const csvUploadArea = document.getElementById('csvUploadArea');
    const csvFileInput = document.getElementById('csvFile');
    const csvSelectBtn = document.getElementById('csvSelectBtn');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    if (!csvUploadArea) return;
    csvSelectBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    csvUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); csvUploadArea.classList.add('dragover'); });
    csvUploadArea.addEventListener('dragleave', () => csvUploadArea.classList.remove('dragover'));
    csvUploadArea.addEventListener('drop', (e) => { e.preventDefault(); csvUploadArea.classList.remove('dragover'); handleFileSelect(e.dataTransfer.files[0]); });
    csvUploadBtn.addEventListener('click', uploadCsv);
}

function handleFileSelect(file) {
    if (!file) return;
    if (file.type !== 'text/csv') {
        alert('CSVファイルを選択してください。');
        return;
    }
    selectedCsvFile = file;
    document.querySelector('#csvUploadArea p').textContent = `選択中のファイル: ${file.name}`;
    document.getElementById('csvUploadBtn').disabled = false;
    document.getElementById('uploadStatus').innerHTML = '';
}

async function uploadCsv() {
    if (!selectedCsvFile) return;
    const uploadBtn = document.getElementById('csvUploadBtn');
    const statusDiv = document.getElementById('uploadStatus');
    const year = document.getElementById('importYearSelector').value;
    uploadBtn.disabled = true;
    uploadBtn.innerText = '登録処理中...';
    statusDiv.innerHTML = `<p>CSVファイルをアップロードし、処理を開始します...</p>`;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const csvText = event.target.result;
            const bulkImportSchoolData = functions.httpsCallable('bulkImportSchoolData');
            const result = await bulkImportSchoolData({ year: Number(year), csvText: csvText });
            if (!result.data.success) throw new Error(result.data.message || '不明なエラーが発生しました。');
            statusDiv.innerHTML = `<p class="status-success">✅ ${result.data.message}</p>`;
            populateClassSelector(document.getElementById('displayYearSelector').value);
        } catch (error) {
            console.error('CSV一括登録に失敗しました:', error);
            statusDiv.innerHTML = `<p class="status-error">❌ 登録失敗: ${error.message}</p>`;
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'アップロードして登録を開始';
            selectedCsvFile = null;
            document.getElementById('csvFile').value = '';
        }
    };
    reader.readAsText(selectedCsvFile);
}
