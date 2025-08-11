// functions/index.js ★★★ UTF-8専用 ユーザー一括作成 最終版 ★★★

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");

admin.initializeApp();

exports.bulkCreateUsers = onRequest(
  {
    cors: true,
    region: "asia-northeast1",
    timeoutSeconds: 300,
  },
  (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    if (!req.headers['content-type']?.includes('csv')) {
        return res.status(400).json({ error: 'Content-Type must be text/csv' });
    }

    const processingPromises = [];

    const csvText = req.body.toString();
    const stream = Readable.from(csvText);

    stream
      .pipe(csv({ bom: true })) // BOM付きUTF-8に対応
      .on("data", (data) => {
        // 1行ずつユーザー作成処理を開始し、Promiseを配列に追加
        processingPromises.push(processUserCreation(data));
      })
      .on("end", async () => {
        // 全てのユーザー作成処理が終わるのを待つ
        logger.info(`全${processingPromises.length}件のユーザー作成処理の完了を待ちます...`);
        try {
          const processedResults = await Promise.all(processingPromises);
          
          const successCount = processedResults.filter(r => r.status === 'success').length;
          const errorCount = processedResults.length - successCount;

          logger.info("全てのユーザー処理が完了しました。");
          res.status(200).json({
            message: `✅ 処理完了。成功: ${successCount}件, 失敗: ${errorCount}件`,
            results: processedResults
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
 * ユーザー1人分の作成処理を行うヘルパー関数
 */
async function processUserCreation(userData) {
  const { 氏名: name, メールアドレス: email, クラス: className, ロール: role = 'student' } = userData;
  try {
    if (!name) return { status: "skipped", reason: "氏名が空です" };
    let userRecord, temporaryPassword = null;
    if (email && email.trim() !== "") {
      userRecord = await admin.auth().createUser({ email: email, displayName: name });
    } else {
      const tempEmail = `${name.replace(/\s+/g, '_')}_${Date.now()}@example.com`;
      temporaryPassword = Math.random().toString(36).slice(-8);
      userRecord = await admin.auth().createUser({ email: tempEmail, password: temporaryPassword, displayName: name });
    }
    await admin.firestore().collection("users").doc(userRecord.uid).set({ name: name, email: userRecord.email, role: role, createdAt: new Date() });
    logger.info(`[成功] ユーザー「${name}」を作成しました。`);
    return { status: "success", uid: userRecord.uid, name: name, temporaryPassword: temporaryPassword };
  } catch (error) {
    logger.error(`[失敗] ユーザー「${name}」の作成に失敗しました:`, error.message);
    return { status: "error", name: name, reason: error.message };
  }
}