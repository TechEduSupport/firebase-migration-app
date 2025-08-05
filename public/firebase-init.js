// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmZF5y9z8H8CsMtTgNwo50d7qOr6jdIec",
  authDomain: "tsa-0503.firebaseapp.com",
  databaseURL: "https://tsa-0503-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tsa-0503",
  storageBucket: "tsa-0503.appspot.com",
  messagingSenderId: "283742763295",
  appId: "1:283742763295:web:ed8c68433ecbe303bad82a",
  measurementId: "G-3EKFPLWBMR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Firebase Authenticationのインスタンスを取得