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