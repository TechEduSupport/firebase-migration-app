// Cloud Functions for Firebase: CSVからユーザーを一括作成する処理

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");
const { FieldValue } = require("firebase-admin/firestore"); // FieldValueを直接インポート

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
    if (!name) {
      return { status: "skipped", reason: "氏名が空です" };
    }

    let userRecord;
    let temporaryPassword = null;

    if (email && email.trim() !== "") {
      // メールアドレスが指定されている場合はそのまま作成
      userRecord = await admin.auth().createUser({ email, displayName: name });
    } else {
      // メールアドレスが無い場合はダミーアドレスと一時パスワードを生成
      const tempEmail = `${name.replace(/\s+/g, "_")}_${Date.now()}@example.com`;
      temporaryPassword = Math.random().toString(36).slice(-8);
      userRecord = await admin.auth().createUser({
        email: tempEmail,
        password: temporaryPassword,
        displayName: name,
      });
    }

    // Firestoreにユーザードキュメントを作成
    await admin
      .firestore()
      .collection("users")
      .doc(userRecord.uid)
      .set({
        email: userRecord.email,
        name,
        role,
        schoolId,
         createdAt: FieldValue.serverTimestamp(), // admin.firestore. を削除
      });

    logger.info(`[成功] ユーザー「${name}」を作成しました。`);
    return { status: "success", uid: userRecord.uid, name, temporaryPassword };
  } catch (error) {
    logger.error(`[失敗] ユーザー「${name}」の作成に失敗しました:`, error.message);
    return { status: "error", name, reason: error.message };
  }
}
