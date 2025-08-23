// functions/index.js 【修正後の全コード】

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

// ------------------------------
// CSVを受け取りユーザーを一括作成するHTTP関数
// ※これはファイルアップロードを伴うため、onCallではなくonRequestを使用します。
// ------------------------------
exports.bulkCreateUsers = onRequest(
  {
    cors: true, // CORSを許可
    region: "asia-northeast1",
    timeoutSeconds: 300,
  },
  (req, res) => {
    // pre-flight OPTIONSリクエストへの対応
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    if (!req.headers["content-type"]?.includes("csv")) {
      return res.status(400).json({ error: "Content-Type must be text/csv" });
    }

    const processingPromises = [];
    const csvText = req.body.toString();
    const stream = Readable.from(csvText);

    stream
      .pipe(csv({ bom: true }))
      .on("data", (data) => {
        processingPromises.push(processUserCreation(data));
      })
      .on("end", async () => {
        try {
          const results = await Promise.all(processingPromises);
          const successCount = results.filter((r) => r.status === "success").length;
          const errorCount = results.length - successCount;

          res.status(200).json({
            message: `✅ 処理完了。成功: ${successCount}件, 失敗: ${errorCount}件`,
            results,
          });
        } catch (error) {
          logger.error("Promise.allの実行中にエラー:", error);
          res.status(500).json({ error: "複数のユーザー作成処理を待機中にエラーが発生しました。" });
        }
      })
      .on("error", (err) => {
        logger.error("CSVストリームの解析中にエラー:", err);
        res.status(500).json({ error: "CSVファイルの解析に失敗しました。" });
      });
  }
);

async function processUserCreation(userData) {
  const { 氏名: name, メールアドレス: email, ロール: role = "student", 学校ID: schoolId = "" } = userData;
  try {
    if (!email || !email.trim() || !name) {
      return { status: "skipped", reason: "氏名またはメールアドレスが空です" };
    }
    const userRecord = await admin.auth().createUser({ email, displayName: name });
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: userRecord.email, name, role, schoolId, createdAt: FieldValue.serverTimestamp(),
    });
    await admin.auth().generatePasswordResetLink(email);
    logger.info(`[成功] ユーザー「${name}」を作成し、パスワード設定メールの送信を要求しました。`);
    return { status: "success", uid: userRecord.uid, name };
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      logger.warn(`[スキップ] ユーザー「${name}」（${email}）は既に存在しています。`);
      return { status: "skipped", name, reason: "既に存在するメールアドレスです" };
    }
    logger.error(`[失敗] ユーザー「${name}」の作成に失敗しました:`, error.message);
    return { status: "error", name, reason: error.message };
  }
}

// ------------------------------
// 学校と学校管理者を一括作成するCallable Function (v2形式)
// ------------------------------
exports.createSchoolAndAdmin = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
  }
  const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "superadmin") {
    throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
  }

  const { schoolName, adminEmail, schoolCode } = request.data;
  if (!schoolName || !adminEmail || !schoolCode) {
    throw new HttpsError("invalid-argument", "学校名、管理者メールアドレス、学校IDは必須です。");
  }
  if (!/^[a-zA-Z0-9-]+$/.test(schoolCode)) {
    throw new HttpsError("invalid-argument", "学校IDは半角英数字とハイフンのみ使用できます。");
  }

  try {
    const schoolsRef = admin.firestore().collection("schools");
    const existingSchool = await schoolsRef.where("schoolCode", "==", schoolCode).get();
    if (!existingSchool.empty) {
      throw new HttpsError('already-exists', `学校ID「${schoolCode}」は既に使用されています。`);
    }

    const schoolRef = await schoolsRef.add({
      name: schoolName, schoolCode: schoolCode, createdAt: FieldValue.serverTimestamp(),
    });
    const schoolId = schoolRef.id;

    const adminUser = await admin.auth().createUser({ email: adminEmail, displayName: `${schoolName} 管理者` });

    await admin.firestore().collection("users").doc(adminUser.uid).set({
      email: adminEmail, name: `${schoolName} 管理者`, role: "schooladmin", schoolId: schoolId, createdAt: FieldValue.serverTimestamp(),
    });

    await admin.auth().generatePasswordResetLink(adminEmail);
    logger.info(`学校「${schoolName}」(ID: ${schoolCode})と管理者「${adminEmail}」を作成しました。`);
    return { success: true, message: `学校「${schoolName}」を登録しました。` };
  } catch (error) {
    logger.error("学校作成中のエラー:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'このメールアドレスは既に使用されています。');
    }
    throw new HttpsError("internal", "サーバー内部でエラーが発生しました。");
  }
});

// functions/index.js 内の bulkImportSchoolData を置き換え

// ------------------------------
// 学校の生徒・クラスを一括登録するCallable Function (v2形式)
// ------------------------------
exports.bulkImportSchoolData = onCall({ region: "asia-northeast1", cors: true, timeoutSeconds: 300 }, async (request) => {
    // 1. 認証と権限チェック
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. 学校情報の取得
    const schoolId = callerDoc.data().schoolId;
    const schoolDoc = await admin.firestore().collection("schools").doc(schoolId).get();
    if (!schoolDoc.exists) {
        throw new HttpsError("not-found", "紐づく学校情報が見つかりません。");
    }
    const schoolCode = schoolDoc.data().schoolCode;

    // 3. リクエストデータの検証
    const { year, csvText } = request.data;
    if (!year || !csvText) {
        throw new HttpsError("invalid-argument", "年度とCSVデータは必須です。");
    }

    // パスワードを自動生成するヘルパー関数
    const generatePassword = () => {
        const length = 8;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let retVal = "";
        for (let i = 0, n = charset.length; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        return retVal;
    };

    const stream = Readable.from(csvText);
    const studentsByClass = {}; // クラスごとに生徒をグループ化するためのオブジェクト

    return new Promise((resolve, reject) => {
        stream.pipe(csv({ headers: ['学生番号', '学年', '組', '氏名', 'メールアドレス'], skipLines: 1 }))
            .on('data', (row) => {
                // まずはデータを読み込んでクラスごとにグループ分けするだけ
                const className = `${row.学年}年${row.組}組`;
                if (!studentsByClass[className]) {
                    studentsByClass[className] = [];
                }
                studentsByClass[className].push(row);
            })
            .on('end', async () => {
                try {
                    const allResults = [];
                    // グループ分けしたクラスごとに処理を実行
                    for (const className in studentsByClass) {
                        const studentsInClass = studentsByClass[className];

                        // 6. クラスの存在チェックと自動作成 (クラスごとに1回だけ実行)
                        let classId;
                        const classQuery = await admin.firestore().collection('classes')
                            .where('schoolId', '==', schoolId).where('year', '==', Number(year)).where('name', '==', className).limit(1).get();
                        
                        if (classQuery.empty) {
                            const newClassRef = await admin.firestore().collection('classes').add({
                                name: className, year: Number(year), isActive: true, schoolId: schoolId, studentIds: [], teachers: {}
                            });
                            classId = newClassRef.id;
                        } else {
                            classId = classQuery.docs[0].id;
                        }

                        // 7. そのクラスの生徒全員を並行して処理
                        const studentProcessingPromises = studentsInClass.map(async (studentRow) => {
                            try {
                                const { 学生番号, 氏名, メールアドレス } = studentRow;
                                const studentLoginEmail = メールアドレス || `${学生番号}@${schoolCode}.local`;
                                const initialPassword = generatePassword();
                                let studentUser;
                                try {
                                    studentUser = await admin.auth().createUser({ email: studentLoginEmail, password: initialPassword, displayName: 氏名 });
                                } catch (error) {
                                    if (error.code === 'auth/email-already-exists') {
                                        studentUser = await admin.auth().getUserByEmail(studentLoginEmail);
                                    } else { throw error; }
                                }
                                await admin.firestore().collection('users').doc(studentUser.uid).set({
                                    name: 氏名, email: studentLoginEmail, role: 'student', schoolId: schoolId, studentNumber: 学生番号,
                                }, { merge: true });
                                return { status: 'success', uid: studentUser.uid };
                            } catch (e) {
                                logger.error(`生徒処理エラー: ${e.message}`, { studentRow });
                                return { status: 'error', reason: e.message, row: studentRow };
                            }
                        });
                        
                        const studentResults = await Promise.all(studentProcessingPromises);
                        allResults.push(...studentResults);

                        // 8. 成功した生徒のUIDをクラスに一括で追加
                        const successfulStudentUids = studentResults
                            .filter(r => r.status === 'success')
                            .map(r => r.uid);
                        
                        if (successfulStudentUids.length > 0) {
                            await admin.firestore().collection('classes').doc(classId).update({
                                studentIds: FieldValue.arrayUnion(...successfulStudentUids)
                            });
                        }
                    }

                    const successCount = allResults.filter(r => r.status === 'success').length;
                    const errorCount = allResults.length - successCount;
                    resolve({ success: true, message: `処理完了。成功: ${successCount}件, 失敗: ${errorCount}件`, results: allResults });

                } catch (e) {
                    logger.error("グループ処理中のエラー:", e);
                    reject(new HttpsError("internal", e.message));
                }
            })
            .on('error', (err) => {
                logger.error("CSVストリームのエラー:", err);
                reject(new HttpsError("internal", "CSVの解析に失敗しました。"));
            });
    });
});

// ------------------------------
// 新しい授業を作成するCallable Function
// ------------------------------
exports.createSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    // 1. 認証と権限チェック
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. データ検証
    const { name, description, year, schoolId, classId, teacherIds, studentIds } = request.data;
    if (!name || !year || !schoolId || !classId || !teacherIds || !studentIds || teacherIds.length === 0) {
        throw new HttpsError("invalid-argument", "必須項目が不足しています。");
    }

    try {
        // 3. Firestoreに新しい授業ドキュメントを作成
        await admin.firestore().collection("subjects").add({
            name,
            description,
            year,
            isActive: true, // デフォルトはアクティブ
            schoolId,
            classId,
            teacherIds,
            studentIds,
            createdAt: FieldValue.serverTimestamp(),
        });
        
        logger.info(`新しい授業「${name}」が作成されました。`);
        return { success: true, message: "新しい授業を登録しました。" };

    } catch (error) {
        logger.error("授業作成中のエラー:", error);
        throw new HttpsError("internal", "授業の登録中にサーバーでエラーが発生しました。");
    }
});

// ------------------------------
// 授業を削除するCallable Function
// ------------------------------
exports.deleteSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    // 1. 認証と権限チェック
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. データ検証
    const { subjectId } = request.data;
    if (!subjectId) {
        throw new HttpsError("invalid-argument", "授業IDは必須です。");
    }

    try {
        // TODO: この授業に紐づく課題(prompts)が既に存在する場合、削除を中止するか、
        //       あるいは課題も一緒に削除するかの仕様を検討する必要があります。
        //       今回はまず授業ドキュメントのみを削除します。

        await admin.firestore().collection("subjects").doc(subjectId).delete();
        
        logger.info(`授業(ID: ${subjectId})が削除されました。`);
        return { success: true, message: "授業を削除しました。" };

    } catch (error) {
        logger.error("授業削除中のエラー:", error);
        throw new HttpsError("internal", "授業の削除中にサーバーでエラーが発生しました。");
    }
});

// ------------------------------
// 授業情報を更新するCallable Function
// ------------------------------
exports.updateSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    // 1. 認証と権限チェック
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. データ検証
    const { subjectId, name, description, teacherIds, studentIds } = request.data;
    if (!subjectId || !name || !teacherIds || !studentIds || teacherIds.length === 0) {
        throw new HttpsError("invalid-argument", "必須項目が不足しています。");
    }

    try {
        // 3. Firestoreの授業ドキュメントを更新
        await admin.firestore().collection("subjects").doc(subjectId).update({
            name,
            description,
            teacherIds,
            studentIds,
        });
        
        logger.info(`授業(ID: ${subjectId})が更新されました。`);
        return { success: true, message: "授業情報を更新しました。" };

    } catch (error) {
        logger.error("授業更新中のエラー:", error);
        throw new HttpsError("internal", "授業の更新中にサーバーでエラーが発生しました。");
    }
});

// functions/index.js の末尾に追記

// ------------------------------
// 新しい教員を作成するCallable Function
// ------------------------------
exports.createTeacher = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    // 1. 認証と権限チェック
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. データ検証
    const { name, email, schoolId } = request.data;
    if (!name || !email || !schoolId) {
        throw new HttpsError("invalid-argument", "氏名、メールアドレス、学校IDは必須です。");
    }

    try {
        // 3. Firebase Authenticationにユーザーを作成
        const userRecord = await admin.auth().createUser({
            email: email,
            displayName: name,
        });

        // 4. Firestoreのusersコレクションに教員情報を保存
        await admin.firestore().collection("users").doc(userRecord.uid).set({
            name,
            email,
            schoolId,
            role: 'teacher',
            isActive: true, // デフォルトは有効
            createdAt: FieldValue.serverTimestamp(),
        });

        // 5. パスワード設定メールを送信
        await admin.auth().generatePasswordResetLink(email);

        logger.info(`新しい教員「${name}」(${email})が作成されました。`);
        return { success: true, message: "教員を登録し、パスワード設定メールを送信しました。" };

    } catch (error) {
        logger.error("教員作成中のエラー:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'このメールアドレスは既に使用されています。');
        }
        throw new HttpsError("internal", "教員の登録中にサーバーでエラーが発生しました。");
    }
});