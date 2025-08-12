// あなたのウェブアプリのFirebase設定
// TODO: この部分はあなたのプロジェクトの情報に書き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyBmZF5y9z8H8CsMtTgNwo50d7qOr6jdIec",
  authDomain: "tsa-0503.firebaseapp.com",
  projectId: "tsa-0503",
  storageBucket: "tsa-0503.appspot.com",
  messagingSenderId: "283742763295",
  appId: "1:283742763295:web:ed8c68433ecbe303bad82a"
};

// Firebaseを初期化
firebase.initializeApp(firebaseConfig);

// 他のファイルで `auth` という変数を使えるように定義
const auth = firebase.auth();
const db = firebase.firestore(); 

// --- ▼▼▼ ここから下を追加 ▼▼▼ ---

// もしローカル環境で実行されている場合、エミュレータに接続する
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
  console.log("ローカル開発環境を検出。エミュレータに接続します。");
  
  // Authentication Emulatorに接続
  auth.useEmulator("http://127.0.0.1:9099");
  
  // Firestore Emulatorに接続
  db.useEmulator("127.0.0.1", 8080);
  
  // (将来的にはFunctionsも)
  // const functions = firebase.functions();
  // functions.useEmulator("127.0.0.1", 5001);
}
