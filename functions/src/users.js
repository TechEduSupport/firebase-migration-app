// functions/src/users.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * CSVデータから個々のユーザーを作成する内部関数
 * @param {object} userData - CSVの1行分のデータ
 * @returns {Promise<object>} 処理結果のオブジェクト
 */
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
    // パスワード設定メールの送信要求（管理コンソールでの設定が必要）
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

/**
 * CSVを受け取りユーザーを一括作成するHTTP関数
 */
exports.bulkCreateUsers = onRequest(
  {
    cors: true,
    region: "asia-northeast1",
    timeoutSeconds: 300,
  },
  (req, res) => {
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

/**
 * 新しい教員を作成するCallable Function
 */
exports.createTeacher = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    const { name, email, schoolId } = request.data;
    if (!name || !email || !schoolId) {
        throw new HttpsError("invalid-argument", "氏名、メールアドレス、学校IDは必須です。");
    }

    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            displayName: name,
        });

        await admin.firestore().collection("users").doc(userRecord.uid).set({
            name,
            email,
            schoolId,
            role: 'teacher',
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
        });

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