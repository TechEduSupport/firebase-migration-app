// functions/src/subjects.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * 新しい授業を作成するCallable Function
 */
exports.createSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    const { name, description, year, schoolId, classId, teacherIds, studentIds } = request.data;
    if (!name || !year || !schoolId || !classId || !teacherIds || !studentIds || teacherIds.length === 0) {
        throw new HttpsError("invalid-argument", "必須項目が不足しています。");
    }

    try {
        await admin.firestore().collection("subjects").add({
            name,
            description,
            year,
            isActive: true,
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

/**
 * 授業を削除するCallable Function
 */
exports.deleteSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    const { subjectId } = request.data;
    if (!subjectId) {
        throw new HttpsError("invalid-argument", "授業IDは必須です。");
    }

    try {
        await admin.firestore().collection("subjects").doc(subjectId).delete();
        
        logger.info(`授業(ID: ${subjectId})が削除されました。`);
        return { success: true, message: "授業を削除しました。" };

    } catch (error) {
        logger.error("授業削除中のエラー:", error);
        throw new HttpsError("internal", "授業の削除中にサーバーでエラーが発生しました。");
    }
});

/**
 * 授業情報を更新するCallable Function
 */
exports.updateSubject = onCall({ region: "asia-northeast1", cors: true }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    const { subjectId, name, description, teacherIds, studentIds } = request.data;
    if (!subjectId || !name || !teacherIds || !studentIds || teacherIds.length === 0) {
        throw new HttpsError("invalid-argument", "必須項目が不足しています。");
    }

    try {
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