// functions/index.js

require("dotenv").config();
const admin = require("firebase-admin");

// Firebase Admin SDKを一度だけ初期化
admin.initializeApp();

// 各機能ファイルからエクスポートされた関数をまとめて読み込み
const usersFunctions = require('./src/users');
const schoolsFunctions = require('./src/schools');
const subjectsFunctions = require('./src/subjects');
const gradingFunctions = require('./src/grading');
const promptCheckerFunctions = require('./src/promptChecker'); // ★新しいファイルを追加

// スプレッド構文(...)を使って、読み込んだすべての関数をまとめてエクスポート
module.exports = {
  ...usersFunctions,
  ...schoolsFunctions,
  ...subjectsFunctions,
  ...gradingFunctions,
  ...promptCheckerFunctions, // ★新しい関数を追加
};