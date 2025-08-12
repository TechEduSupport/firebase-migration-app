// Firebase初期化設定
// ※プロジェクト固有の情報に置き換えて使用する
const firebaseConfig = {
  apiKey: "AIzaSyBmZF5y9z8H8CsMtTgNwo50d7qOr6jdIec",
  authDomain: "tsa-0503.firebaseapp.com",
  projectId: "tsa-0503",
  storageBucket: "tsa-0503.appspot.com",
  messagingSenderId: "283742763295",
  appId: "1:283742763295:web:ed8c68433ecbe303bad82a"
};

// アプリを初期化
firebase.initializeApp(firebaseConfig);

// 各Firebaseサービスの参照を取得
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ------------------------------
// ローカル開発時は各エミュレータに接続
// ------------------------------
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
  console.log("ローカル開発環境を検出。エミュレータに接続します。");

  // Authentication Emulator
  auth.useEmulator("http://127.0.0.1:9099");

  // Firestore Emulator
  db.useEmulator("127.0.0.1", 8080);

  // Storage Emulator
  if (storage.useEmulator) {
    storage.useEmulator("127.0.0.1", 9199);
  }
}
