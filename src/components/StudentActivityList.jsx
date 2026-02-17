import { useState, useEffect } from 'react';
import { db } from '../services/db';

export default function StudentActivityList({ studentId, onLogout }) {
  const [activities, setActivities] = useState([]);
  const [studentName, setStudentName] = useState('');
  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    loadActivities();
    db.students.get(studentId).then(s => {
      if (s) setStudentName(s.name);
    });
  }, [studentId, today]);

  async function loadActivities() {
    try {
      const existing = await db.activities
        .where({ studentId })
        .filter(a => a.date === today)
        .toArray();
      setActivities(existing);
    } catch (error) {
      console.error("Error loading activities:", error);
    }
  }

  async function toggleActivity(type) {
    const existing = activities.find(a => a.type === type);
    try {
      if (existing) {
        const newStatus = existing.status === 'done' ? 'pending' : 'done';
        await db.activities.update(existing.id, { status: newStatus });
      } else {
        await db.activities.add({
          studentId,
          date: today,
          type,
          status: 'done'
        });
      }
      loadActivities();
    } catch (error) {
      console.error("Error toggling activity:", error);
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
          Ganti 🔄
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
          const isDone = activities.find(a => a.type === task.id)?.status === 'done';
          return (
            <label
              key={task.id}
              className={`activity-card ${isDone ? 'is-done' : ''}`}
              data-theme={task.theme}
              style={{ '--i': index }}
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
