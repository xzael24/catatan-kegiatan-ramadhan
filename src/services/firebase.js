// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, query, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Replace with your project's config object from Firebase Console settings
const firebaseConfig = {
  apiKey: "AIzaSyAry6NoMU9_35DAkMzG4tCjC2-o0MvO87c",
  authDomain: "ramadhanapp-notes.firebaseapp.com",
  projectId: "ramadhanapp-notes",
  storageBucket: "ramadhanapp-notes.firebasestorage.app",
  messagingSenderId: "190785808654",
  appId: "1:190785808654:web:9c2cd78d2e665c56268f5f",
  measurementId: "G-FW2HL3W76Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    // ...
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    // ...
  }
});

// Collection References
export const studentsCol = collection(db, 'students');
export const activitiesCol = collection(db, 'activities');

// Helper to seed initial data (only run once if empty)
export const seedInitialData = async () => {
  const snapshot = await getDocs(studentsCol);
  if (snapshot.empty) {
    const students = [
      { name: 'Ahmad', class: '1A' },
      { name: 'Budi', class: '1B' },
      { name: 'Citra', class: '1A' },
      { name: 'Doni', class: '1B' },
      { name: 'Eka', class: '1A' },
      { name: 'Fahmi', class: '1B' },
      { name: 'Gita', class: '1A' },
      { name: 'Hadi', class: '1B' },
      { name: 'Indah', class: '1A' },
      { name: 'Joko', class: '1B' },
      { name: 'Kartika', class: '1A' },
      { name: 'Lutfi', class: '1B' },
      { name: 'Maya', class: '1A' },
      { name: 'Naufal', class: '1B' },
      { name: 'Olivia', class: '1A' },
      { name: 'Putra', class: '1B' },
      { name: 'Qori', class: '1A' },
      { name: 'Rizky', class: '1B' },
      { name: 'Sari', class: '1A' },
      { name: 'Toni', class: '1B' },
      { name: 'Umi', class: '1A' },
      { name: 'Vino', class: '1B' },
      { name: 'Wulan', class: '1A' },
      { name: 'Yusuf', class: '1B' },
      { name: 'Zahra', class: '1A' },
    ];
    
    // Batch write using Promise.all for speed
    const promises = students.map(s => {
      // Create a new doc reference with auto-ID
      const newRef = doc(studentsCol);
      return setDoc(newRef, { ...s, id: newRef.id }); // Store ID inside doc for easier access
    });
    
    await Promise.all(promises);
    console.log("Initial students data seeded to Firestore!");
  }
};
