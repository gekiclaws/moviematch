// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBL4RzH2_q9STL1YzgCK9lOTJJ0KNvwXts",
  authDomain: "movie-match-b0907.firebaseapp.com",
  projectId: "movie-match-b0907",
  storageBucket: "movie-match-b0907.firebasestorage.app",
  messagingSenderId: "245177437391",
  appId: "1:245177437391:web:03c9f4639118c77869fbba",
  measurementId: "G-X47V2HEQRD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);