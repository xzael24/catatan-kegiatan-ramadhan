import { useState, useEffect } from 'react';
import { db, activitiesCol, studentsCol } from '../services/firebase';
import { getDoc, doc, addDoc, updateDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import '../styles/student.css';

export default function StudentActivityList({ studentId, onLogout }) {
  const [activities, setActivities] = useState([]);
  const [studentName, setStudentName] = useState('');
  const today = new Date().toLocaleDateString('en-CA');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for realtime updates
    const q = query(
      activitiesCol, 
      where('studentId', '==', studentId),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivities(list);
      setLoading(false);
    });

    // Get student name
    const studentRef = doc(db, 'students', studentId);
    getDoc(studentRef).then(docSnap => {
      if (docSnap.exists()) {
        setStudentName(docSnap.data().name);
      }
    });

    return () => unsubscribe();
  }, [studentId, today]);

  async function toggleActivity(type) {
    const existing = activities.find(a => a.type === type);
    try {
      if (existing) {
        const newStatus = existing.status === 'done' ? 'pending' : 'done';
        const updates = { status: newStatus };
        if (newStatus === 'pending') updates.note = '';
        
        const activityRef = doc(db, 'activities', existing.id);
        await updateDoc(activityRef, updates);
      } else {
        await addDoc(activitiesCol, {
          studentId,
          date: today,
          type,
          status: 'done',
          note: ''
        });
      }
    } catch (error) {
      console.error("Error toggling activity:", error);
    }
  }

  async function updateNote(type, note) {
    const existing = activities.find(a => a.type === type);
    if (existing) {
      // Debounce could be added here, but for simplicity direct update
      const activityRef = doc(db, 'activities', existing.id);
      await updateDoc(activityRef, { note });
    }
  }

  const tasks = [
    { id: 'puasa', label: 'Puasa Hari Ini', icon: '🍽️', theme: 'ibadah' },
    { id: 'sholat_subuh', label: 'Sholat Subuh', icon: '🌅', theme: 'sholat' },
    { id: 'sholat_zuhur', label: 'Sholat Zuhur', icon: '☀️', theme: 'sholat' },
    { id: 'sholat_ashar', label: 'Sholat Ashar', icon: '⛅', theme: 'sholat' },
    { id: 'sholat_maghrib', label: 'Sholat Maghrib', icon: '🌇', theme: 'sholat' },
    { id: 'sholat_isya', label: 'Sholat Isya', icon: '🌙', theme: 'sholat' },
    { id: 'tadarus', label: 'Mengaji / Tadarus', icon: '📖', theme: 'mengaji' },
    { id: 'sholat_tarawih', label: 'Sholat Tarawih', icon: '✨', theme: 'tarawih' },
  ];

  const doneCount = tasks.filter(t =>
    activities.find(a => a.type === t.id)?.status === 'done'
  ).length;

  const progressPercent = Math.round((doneCount / tasks.length) * 100);
  const allDone = doneCount === tasks.length;

  const getProgressEmoji = () => {
    if (allDone) return '🏆 Masya Allah, Lengkap!';
    if (progressPercent >= 75) return '🔥 Sedikit lagi!';
    if (progressPercent >= 50) return '💪 Sudah setengah jalan!';
    if (progressPercent >= 25) return '👍 Bagus, lanjutkan!';
    return '🚀 Yuk mulai ibadah!';
  };

  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading && activities.length === 0) {
    return (
      <div className="activity-container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
        <div>Memuat aktivitas...</div>
      </div>
    );
  }

  return (
    <div className="activity-container">
      {/* Top Bar */}
      <div className="activity-top-bar">
        <div className="activity-greeting">
          <div className="activity-student-name">
            Halo, {studentName}! 👋
          </div>
          <div className="activity-date">📅 {formattedDate}</div>
        </div>
        <button className="btn-switch" onClick={onLogout}>
          Ganti Nama 🔄
        </button>
      </div>

      {/* Progress Section */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Progress Hari Ini</span>
          <span className="progress-count">{doneCount}/{tasks.length}</span>
        </div>
        <div className="progress-bar-wrapper">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-emoji">{getProgressEmoji()}</div>
      </div>

      {/* Activity Cards */}
      <div className="activity-cards">
        {tasks.map((task, index) => {
          const activity = activities.find(a => a.type === task.id);
          const isDone = activity?.status === 'done';
          const hasNote = task.id === 'tadarus';
          return (
            <div key={task.id} className="activity-card-wrapper" style={{ '--i': index }}>
              <label
                className={`activity-card ${isDone ? 'is-done' : ''}`}
                data-theme={task.theme}
              >
                <div className="activity-checkbox">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleActivity(task.id)}
                  />
                  <div className="activity-check-visual" />
                </div>
                <span className="activity-card-icon">{task.icon}</span>
                <div className="activity-card-content">
                  <div className="activity-card-label">{task.label}</div>
                  <div className="activity-card-status">
                    {isDone ? 'Alhamdulillah ✓' : 'Belum dilakukan'}
                  </div>
                </div>
              </label>
              {/* Note input for Tadarus */}
              {hasNote && isDone && (
                <div className="activity-note">
                  <div className="activity-note-label">📝 Catatan Mengaji:</div>
                  <input
                    type="text"
                    className="activity-note-input"
                    placeholder="Tulis surah / juz / halaman yang dibaca..."
                    value={activity?.note || ''}
                    onChange={e => updateNote(task.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Celebration when all done */}
      {allDone && (
        <div className="celebration-message">
          <span className="celebration-emoji">🌟</span>
          <div className="celebration-text">Masya Allah!</div>
          <div className="celebration-subtext">
            Kamu hebat, semua ibadah hari ini sudah lengkap! 🎉
          </div>
        </div>
      )}
    </div>
  );
}
