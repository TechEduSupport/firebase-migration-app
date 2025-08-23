// functions/src/schools.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const csv = require("csv-parser");
const logger = require("firebase-functions/logger");
const { Readable } = require("stream");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * 学校と学校管理者を一括作成するCallable Function
 */
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

/**
 * 学校の生徒・クラスを一括登録するCallable Function
 */
exports.bulkImportSchoolData = onCall({ region: "asia-northeast1", cors: true, timeoutSeconds: 300 }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError("unauthenticated", "この操作を行うには認証が必要です。");
    }
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "schooladmin") {
        throw new HttpsError("permission-denied", "この操作を行う権限がありません。");
    }

    const schoolId = callerDoc.data().schoolId;
    const schoolDoc = await admin.firestore().collection("schools").doc(schoolId).get();
    if (!schoolDoc.exists) {
        throw new HttpsError("not-found", "紐づく学校情報が見つかりません。");
    }
    const schoolCode = schoolDoc.data().schoolCode;

    const { year, csvText } = request.data;
    if (!year || !csvText) {
        throw new HttpsError("invalid-argument", "年度とCSVデータは必須です。");
    }

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
    const studentsByClass = {};

    return new Promise((resolve, reject) => {
        stream.pipe(csv({ headers: ['学生番号', '学年', '組', '氏名', 'メールアドレス'], skipLines: 1 }))
            .on('data', (row) => {
                const className = `${row.学年}年${row.組}組`;
                if (!studentsByClass[className]) {
                    studentsByClass[className] = [];
                }
                studentsByClass[className].push(row);
            })
            .on('end', async () => {
                try {
                    const allResults = [];
                    for (const className in studentsByClass) {
                        const studentsInClass = studentsByClass[className];

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