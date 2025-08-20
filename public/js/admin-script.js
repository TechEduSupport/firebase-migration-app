// public/js/admin-script.js

// --- グローバル変数 ---
let schoolAdminSchoolId = null; // ログインした管理者の学校ID
let selectedCsvFile = null;     // 選択されたCSVファイル
let currentSchoolData = {};   // 学校の情報を保持するオブジェクト

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
            loadStudentsForClass(classSelector.value);
        });
    }

    // CSVアップロードエリアのイベントリスナー
    setupCsvUploadHandlers();
});


/**
 * 学校管理者としてログイン成功後に呼び出されるメイン関数
 * @param {string} schoolId ログインした管理者が所属する学校のFirestoreドキュメントID
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
    
    // 年度選択プルダウンを両方とも生成
    populateYearSelectors();
}

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

    // 初期表示として、表示用のクラスセレクターを更新
    populateClassSelector(currentYear);
}

/**
 * 指定年度のクラスを読み込み、クラス選択プルダウンを更新する
 * @param {number | string} year 
 */
async function populateClassSelector(year) {
    const selector = document.getElementById('classSelector');
    selector.innerHTML = '<option value="">クラスを読み込み中...</option>';
    document.getElementById('studentTable').innerHTML = ''; // 生徒一覧をクリア
    document.getElementById('studentCount').innerText = '0名';

    try {
        const snapshot = await db.collection('classes')
            .where('schoolId', '==', schoolAdminSchoolId)
            .where('year', '==', Number(year))
            .orderBy('name', 'asc')
            .get();

        selector.innerHTML = '<option value="">クラスを選択してください</option>';
        if (snapshot.empty) {
            return;
        }
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
 * @param {string} classId 選択されたクラスのID
 */
async function loadStudentsForClass(classId) {
    const studentTable = document.getElementById('studentTable');
    studentTable.innerHTML = `<tr><th>学生番号</th><th>氏名</th><th>メールアドレス</th></tr>
                            <tr><td colspan="3">生徒を読み込み中...</td></tr>`;
    document.getElementById('studentCount').innerText = '0名';

    if (!classId) {
        studentTable.innerHTML = '';
        return;
    }

    try {
        // studentIds配列はUIDの配列なので、それを使ってusersコレクションから情報を引く
        const classDoc = await db.collection('classes').doc(classId).get();
        if (!classDoc.exists) {
            throw new Error("クラスデータが見つかりません。");
        }

        const studentIds = classDoc.data().studentIds || [];
        document.getElementById('studentCount').innerText = `${studentIds.length}名`;

        if (studentIds.length === 0) {
            studentTable.innerHTML = `<tr><td colspan="3">このクラスにはまだ生徒が登録されていません。</td></tr>`;
            return;
        }

        const studentPromises = studentIds.map(uid => db.collection('users').doc(uid).get());
        const studentDocs = await Promise.all(studentPromises);

        studentTable.innerHTML = `<tr><th>学生番号</th><th>氏名</th><th>メールアドレス</th></tr>`; // ヘッダー再設定
        studentDocs.forEach(doc => {
            if (doc.exists) {
                const student = doc.data();
                const row = studentTable.insertRow();
                row.insertCell(0).innerText = student.studentNumber || '（未設定）';
                row.insertCell(1).innerText = student.name;
                // ダミーメールアドレスは表示しないなどの工夫も可能
                row.insertCell(2).innerText = student.email.endsWith('.local') ? '（なし）' : student.email;
            }
        });

    } catch (error) {
        console.error("生徒一覧の読み込みに失敗:", error);
        studentTable.innerHTML = `<tr><td colspan="3">生徒一覧の読み込みに失敗しました。</td></tr>`;
    }
}


// ------------------------------
// CSVアップロード関連の処理
// ------------------------------
function setupCsvUploadHandlers() {
    const csvUploadArea = document.getElementById('csvUploadArea');
    const csvFileInput = document.getElementById('csvFile');
    const csvSelectBtn = document.getElementById('csvSelectBtn');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    
    // 「ファイルを選択」ボタン
    csvSelectBtn.addEventListener('click', () => csvFileInput.click());
    // ファイルが選択された時
    csvFileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    // ドラッグ＆ドロップ
    csvUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        csvUploadArea.classList.add('dragover');
    });
    csvUploadArea.addEventListener('dragleave', () => csvUploadArea.classList.remove('dragover'));
    csvUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        csvUploadArea.classList.remove('dragover');
        handleFileSelect(e.dataTransfer.files[0]);
    });
    
    // 「アップロード」ボタン
    csvUploadBtn.addEventListener('click', uploadCsv); // この処理は次のステップで実装
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
    if (!selectedCsvFile) {
        alert('ファイルが選択されていません。');
        return;
    }

    const uploadBtn = document.getElementById('csvUploadBtn');
    const statusDiv = document.getElementById('uploadStatus');
    const year = document.getElementById('importYearSelector').value;

    uploadBtn.disabled = true;
    uploadBtn.innerText = '登録処理中...';
    statusDiv.innerHTML = `<p>CSVファイルをアップロードし、処理を開始します... (生徒数によっては数分かかる場合があります)</p>`;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const csvText = event.target.result;
            
            const user = auth.currentUser;
            if (!user) throw new Error("ログインしていません。");
            const token = await user.getIdToken();

            const functionUrl = "http://12.0.0.1:5001/tsa-0503/asia-northeast1/bulkImportSchoolData";
            
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ year: Number(year), csvText: csvText })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error.message || '不明なエラー');
            }

            statusDiv.innerHTML = `<p class="status-success">✅ ${result.message}</p>`;
            // 成功したら表示を更新
            populateClassSelector(document.getElementById('displayYearSelector').value);

        } catch (error) {
            console.error('CSV一括登録に失敗しました:', error);
            statusDiv.innerHTML = `<p class="status-error">❌ 登録失敗: ${error.message}</p>`;
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'アップロードして登録を開始';
            selectedCsvFile = null;
            document.getElementById('csvFile').value = '';
            document.querySelector('#csvUploadArea p').textContent = `選択中のファイル: なし`;
        }
    };
    reader.readAsText(selectedCsvFile);
}