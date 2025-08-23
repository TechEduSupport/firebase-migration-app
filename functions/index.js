// functions/index.js

const admin = require("firebase-admin");

// Firebase Admin SDKを一度だけ初期化します
admin.initializeApp();

// 各機能ファイルからエクスポートされた関数をまとめて読み込みます
const usersFunctions = require('./src/users');
const schoolsFunctions = require('./src/schools'); // ← ファイル名を修正
const subjectsFunctions = require('./src/subjects');

// スプレッド構文(...)を使って、読み込んだすべての関数をまとめてエクスポートします
module.exports = {
  ...usersFunctions,
  ...schoolsFunctions,
  ...subjectsFunctions,
};