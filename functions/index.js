// functions/index.js

const admin = require("firebase-admin");

// Firebase Admin SDKを初期化
// これを最初に行うことで、他のファイルでadminインスタンスを使い回せます。
admin.initializeApp();

// 各機能ファイルからエクスポートされた関数を読み込む
const usersFunctions = require('./src/users');
const schoolsFunctions = require('./src/schools');
const subjectsFunctions = require('./src/subjects');

// 読み込んだ関数をFirebase Functionsとして再度エクスポートする
exports.bulkCreateUsers = usersFunctions.bulkCreateUsers;
exports.createTeacher = usersFunctions.createTeacher;

exports.createSchoolAndAdmin = schoolsFunctions.createSchoolAndAdmin;
exports.bulkImportSchoolData = schoolsFunctions.bulkImportSchoolData;

exports.createSubject = subjectsFunctions.createSubject;
exports.deleteSubject = subjectsFunctions.deleteSubject;
exports.updateSubject = subjectsFunctions.updateSubject;