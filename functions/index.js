// Cloud Functions for Firebase: CSVからユーザーを一括作成する処理

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");
const { FieldValue } = require("firebase-admin/firestore"); // FieldValueを直接インポート
const cors = require("cors")({ origin: true }); // CORSを処理するためのミドルウェアをインポート

admin.initializeApp();

// ------------------------------
// CSVを受け取りユーザーを一括作成するHTTP関数
// ------------------------------
exports.bulkCreateUsers = onRequest(
  {
    cors: true,
    region: "asia-northeast1",
    timeoutSeconds: 300,
  },
  (req, res) => {
    // POSTメソッド以外は拒否
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    // Content-TypeがCSVであることを確認
    if (!req.headers["content-type"]?.includes("csv")) {
      return res.status(400).json({ error: "Content-Type must be text/csv" });
    }

    const processingPromises = [];
    const csvText = req.body.toString();
    const stream = Readable.from(csvText);

    // CSVを1行ずつ読み込み、ユーザー作成処理のPromiseを配列に追加
    stream
      .pipe(csv({ bom: true })) // BOM付きUTF-8にも対応
      .on("data", (data) => {
        processingPromises.push(processUserCreation(data));
      })
      .on("end", async () => {
        logger.info(`全${processingPromises.length}件のユーザー作成処理の完了を待ちます...`);
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

// --------------------------------------
// CSVの1行からユーザーを作成するヘルパー関数
// --------------------------------------
async function processUserCreation(userData) {
  // CSVのヘッダーは日本語想定のため、プロパティ名も日本語で取得
  const { 氏名: name, メールアドレス: email, ロール: role = "student", 学校ID: schoolId = "" } = userData;

  try {
    // メールアドレスがない、または氏名がない場合はスキップ
    if (!email || !email.trim() || !name) {
      return { status: "skipped", reason: "氏名またはメールアドレスが空です" };
    }

    // 1. ユーザーを作成
    const userRecord = await admin.auth().createUser({
      email,
      displayName: name,
    });

    // 2. Firestoreにユーザードキュメントを作成
    await admin
      .firestore()
      .collection("users")
      .doc(userRecord.uid)
      .set({
        email: userRecord.email,
        name,
        role,
        schoolId,
        createdAt: FieldValue.serverTimestamp(),
      });

    // 3. パスワード設定（リセット）メールを送信する
    // 注意: Firebaseプロジェクトでメールテンプレートが設定されている必要があります
    await admin.auth().generatePasswordResetLink(email);
    
    logger.info(`[成功] ユーザー「${name}」を作成し、パスワード設定メールの送信を要求しました。`);
    // temporaryPasswordは不要になったので削除
    return { status: "success", uid: userRecord.uid, name };

  } catch (error) {
    // 既に同じメールアドレスのユーザーが存在する場合のエラーハンドリング
    if (error.code === 'auth/email-already-exists') {
      logger.warn(`[スキップ] ユーザー「${name}」（${email}）は既に存在しています。`);
      return { status: "skipped", name, reason: "既に存在するメールアドレスです" };
    }
    logger.error(`[失敗] ユーザー「${name}」の作成に失敗しました:`, error.message);
    return { status: "error", name, reason: error.message };
  }
}

// functions/index.js

// ------------------------------
// 学校と学校管理者を一括作成するCallable Function
// ------------------------------
exports.createSchoolAndAdmin = onCall(
  {
    region: "asia-northeast1",
    cors: true,
  },
  async (request) => {
    // 1. 権限チェック (変更なし)
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "superadmin") {
      throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    // 2. データのバリデーション（schoolCodeを追加）
    const { schoolName, adminEmail, schoolCode } = request.data;
    if (!schoolName || !adminEmail || !schoolCode) {
      throw new HttpsError("invalid-argument", "学校名、管理者メールアドレス、学校IDは必須です。");
    }
    // schoolCodeが半角英数のみかチェック（簡易的）
    if (!/^[a-zA-Z0-9-]+$/.test(schoolCode)) {
        throw new HttpsError("invalid-argument", "学校IDは半角英数字とハイフンのみ使用できます。");
    }


    try {
      // ★ schoolCodeが一意かどうかのチェックを追加
      const schoolsRef = admin.firestore().collection("schools");
      const existingSchool = await schoolsRef.where("schoolCode", "==", schoolCode).get();
      if (!existingSchool.empty) {
        throw new HttpsError('already-exists', `学校ID「${schoolCode}」は既に使用されています。`);
      }

      // 3. Firestoreに学校ドキュメントを作成（schoolCodeを追加）
      const schoolRef = await schoolsRef.add({
        name: schoolName,
        schoolCode: schoolCode, // ★ schoolCodeを保存
        createdAt: FieldValue.serverTimestamp(),
      });
      const schoolId = schoolRef.id;

      // 4. 管理者アカウントの作成 (変更なし)
      const adminUser = await admin.auth().createUser({
        email: adminEmail,
        displayName: `${schoolName} 管理者`,
      });

      // 5. usersコレクションに管理者情報を保存 (変更なし)
      await admin.firestore().collection("users").doc(adminUser.uid).set({
        email: adminEmail,
        name: `${schoolName} 管理者`,
        role: "schooladmin", 
        schoolId: schoolId,
        createdAt: FieldValue.serverTimestamp(),
      });
      
      // 6. パスワード設定メールの送信 (変更なし)
      await admin.auth().generatePasswordResetLink(adminEmail);

      logger.info(`学校「${schoolName}」(ID: ${schoolCode})と管理者「${adminEmail}」を作成しました。`);
      return { success: true, message: `学校「${schoolName}」を登録しました。` };

    } catch (error) {
      logger.error("学校作成中のエラー:", error);
      // HttpsErrorの場合はそのままクライアントに返す
      if (error instanceof HttpsError) {
          throw error;
      }
      if (error.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'このメールアドレスは既に使用されています。');
      }
      throw new HttpsError("internal", "サーバー内部でエラーが発生しました。");
    }
  }
);

// functions/index.js (末尾に追記)

// ------------------------------
// 学校の生徒・クラスを一括登録する関数 (v1形式)
// ------------------------------
exports.bulkImportSchoolData = functions.region("asia-northeast1").https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send({ error: 'Method Not Allowed' });
        }
        try {
            // 1. 認証と権限チェック
            const token = req.headers.authorization?.split('Bearer ')[1];
            if (!token) {
                return res.status(401).send({ error: { message: "認証トークンがありません。" }});
            }
            const decodedToken = await admin.auth().verifyIdToken(token);
            const callerUid = decodedToken.uid;

            const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
            if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
                return res.status(403).send({ error: { message: "この操作を行う権限がありません。" }});
            }

            const schoolId = callerDoc.data().schoolId;
            const schoolDoc = await admin.firestore().collection("schools").doc(schoolId).get();
            if (!schoolDoc.exists) {
                return res.status(400).send({ error: { message: "紐づく学校情報が見つかりません。" }});
            }
            const schoolCode = schoolDoc.data().schoolCode;

            // 2. CSVデータと年度を受け取る
            const { year, csvText } = req.body;
            if (!year || !csvText) {
                return res.status(400).send({ error: { message: "年度とCSVデータは必須です。" }});
            }

            const results = [];
            const stream = Readable.from(csvText);
            const classCache = {}; // 作成済みのクラスIDをキャッシュする

            // 3. CSVを1行ずつ処理
            const processingPromises = [];
            stream.pipe(csv({ headers: ['学生番号', '学年', '組', '氏名', 'メールアドレス'], skipLines: 1 }))
                .on('data', (row) => {
                    const promise = async () => {
                        try {
                            const { 学生番号, 学年, 組, 氏名, メールアドレス } = row;
                            if (!学生番号 || !学年 || !組 || !氏名) {
                                return { status: 'error', reason: '必須項目が不足しています', row };
                            }

                            // 4. クラスの存在チェックと自動作成
                            const className = `${学年}年${組}組`;
                            let classId = classCache[className];
                            if (!classId) {
                                const classQuery = await admin.firestore().collection('classes')
                                    .where('schoolId', '==', schoolId)
                                    .where('year', '==', Number(year))
                                    .where('name', '==', className)
                                    .limit(1).get();
                                
                                if (classQuery.empty) {
                                    const newClassRef = await admin.firestore().collection('classes').add({
                                        name: className, year: Number(year), isActive: true,
                                        schoolId: schoolId, studentIds: [], teachers: {}
                                    });
                                    classId = newClassRef.id;
                                } else {
                                    classId = classQuery.docs[0].id;
                                }
                                classCache[className] = classId;
                            }
                            
                            // 5. 生徒アカウントの作成または更新
                            const studentLoginEmail = メールアドレス || `${学生番号}@${schoolCode}.local`;
                            const initialPassword = 学生番号; // 初期パスワードは学生番号
                            let studentUser;
                            try {
                                studentUser = await admin.auth().createUser({
                                    email: studentLoginEmail,
                                    password: initialPassword,
                                    displayName: 氏名,
                                });
                            } catch (error) {
                                if (error.code === 'auth/email-already-exists') {
                                    studentUser = await admin.auth().getUserByEmail(studentLoginEmail);
                                } else { throw error; }
                            }
                            
                            // 6. Firestoreのusersコレクションとclassesコレクションを更新
                            await admin.firestore().collection('users').doc(studentUser.uid).set({
                                name: 氏名, email: studentLoginEmail, role: 'student',
                                schoolId: schoolId, studentNumber: 学生番号,
                            }, { merge: true });

                            await admin.firestore().collection('classes').doc(classId).update({
                                studentIds: FieldValue.arrayUnion(studentUser.uid)
                            });

                            return { status: 'success', name: 氏名, class: className };

                        } catch (e) {
                            return { status: 'error', reason: e.message, row };
                        }
                    };
                    processingPromises.push(promise());
                })
                .on('end', async () => {
                    const allResults = await Promise.all(processingPromises);
                    const successCount = allResults.filter(r => r.status === 'success').length;
                    const errorCount = allResults.length - successCount;
                    res.status(200).send({ success: true, message: `処理完了。成功: ${successCount}件, 失敗: ${errorCount}件`, results: allResults });
                });

        } catch (error) {
            logger.error("一括登録処理中にエラー:", error);
            res.status(500).send({ error: { message: "サーバー内部でエラーが発生しました。" } });
        }
    });
});