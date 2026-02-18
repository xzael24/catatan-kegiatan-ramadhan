// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, collection, getDocs, doc, setDoc, query, addDoc, serverTimestamp } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore with persistent cache (replaces enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});

// Collection References
export const studentsCol = collection(db, 'students');
export const activitiesCol = collection(db, 'activities');
export const logsCol = collection(db, 'logs');

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

// Logging function untuk tracking semua aktivitas
export const logActivity = async (action, actor, details = {}) => {
  try {
    const logData = {
      action, // 'create_student', 'update_student', 'delete_student', 'toggle_activity', 'update_note', 'clear_activities', 'reset_all'
      actor, // { type: 'student' | 'admin', id?: string, name: string }
      details, // detail aktivitas yang dilakukan
      timestamp: serverTimestamp(),
      date: new Date().toLocaleDateString('en-CA'), // untuk filtering per hari
      userAgent: navigator.userAgent,
    };
    
    await addDoc(logsCol, logData);
  } catch (error) {
    console.error("Error logging activity:", error);
    // Jangan throw error agar tidak mengganggu flow utama
  }
};
