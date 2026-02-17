import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import '../styles/teacher.css';

export default function TeacherView() {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    loadData();
  }, [date]);

  async function loadData() {
    const s = await db.students.toArray();
    const a = await db.activities.where({ date }).toArray();
    setStudents(s);
    setActivities(a);
  }

  const prayers = ['sholat_subuh', 'sholat_zuhur', 'sholat_ashar', 'sholat_maghrib', 'sholat_isya'];

  const getStatus = (studentId, type) => {
    const act = activities.find(a => a.studentId === studentId && a.type === type);
    return act?.status === 'done';
  };

  const getPrayerCount = (studentId) => {
    return prayers.reduce((acc, type) => {
      return acc + (getStatus(studentId, type) ? 1 : 0);
    }, 0);
  };

  // Get unique classes
  const classes = useMemo(() => {
    const set = new Set(students.map(s => s.class));
    return ['all', ...Array.from(set).sort()];
  }, [students]);

  // Filter students by class
  const filteredStudents = useMemo(() => {
    if (filterClass === 'all') return students;
    return students.filter(s => s.class === filterClass);
  }, [students, filterClass]);

  // Stats
  const stats = useMemo(() => {
    const totalStudents = filteredStudents.length;
    const activeStudents = filteredStudents.filter(s =>
      activities.some(a => a.studentId === s.id && a.status === 'done')
    ).length;

    const allTypes = ['puasa', ...prayers, 'tadarus', 'sholat_tarawih'];
    const totalPossible = totalStudents * allTypes.length;
    const totalDone = filteredStudents.reduce((acc, s) => {
      return acc + allTypes.reduce((a2, type) => a2 + (getStatus(s.id, type) ? 1 : 0), 0);
    }, 0);
    const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

    return { totalStudents, activeStudents, completionRate };
  }, [filteredStudents, activities]);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="teacher-page">
      {/* Header */}
      <header className="teacher-header">
        <div className="teacher-header-content">
          <div className="admin-nav-links" style={{ marginBottom: 'var(--spacing-md)' }}>
            <Link to="/" className="back-link">🏠 Halaman Siswa</Link>
            <Link to="/admin" className="back-link">⚙️ Admin Panel</Link>
          </div>
          <span className="teacher-header-icon">👨‍🏫</span>
          <h1 className="teacher-header-title">Dashboard Guru</h1>
          <p className="teacher-header-subtitle">Pantau Ibadah Ramadhan Siswa</p>
        </div>
      </header>

      <div className="teacher-content">
        {/* Date Picker */}
        <div className="date-picker-section">
          <span className="date-picker-label">📅 Tanggal:</span>
          <input
            type="date"
            className="date-picker-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Stats Cards */}
        <div className="stats-row">
          <div className="stat-card stat-card--students">
            <div className="stat-card-value">{stats.totalStudents}</div>
            <div className="stat-card-label">Total Siswa</div>
          </div>
          <div className="stat-card stat-card--active">
            <div className="stat-card-value">{stats.activeStudents}</div>
            <div className="stat-card-label">Sudah Isi</div>
          </div>
          <div className="stat-card stat-card--completion">
            <div className="stat-card-value">{stats.completionRate}%</div>
            <div className="stat-card-label">Completion</div>
          </div>
        </div>

        {/* Class Filter */}
        <div className="class-filter">
          {classes.map(cls => (
            <button
              key={cls}
              className={`class-tab ${filterClass === cls ? 'active' : ''}`}
              onClick={() => setFilterClass(cls)}
            >
              {cls === 'all' ? 'Semua Kelas' : `Kelas ${cls}`}
            </button>
          ))}
        </div>

        {/* Desktop Table View */}
        {filteredStudents.length > 0 ? (
          <>
            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Siswa</th>
                    <th>Kelas</th>
                    <th>Puasa</th>
                    <th>Sholat</th>
                    <th>Tarawih</th>
                    <th>Tadarus</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => {
                    const prayCount = getPrayerCount(s.id);
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="table-student-info">
                            <div className="table-avatar">{s.name.charAt(0)}</div>
                            <span className="table-student-name">{s.name}</span>
                          </div>
                        </td>
                        <td><span className="table-class-badge">{s.class}</span></td>
                        <td>
                          {getStatus(s.id, 'puasa')
                            ? <span className="status-done">✅</span>
                            : <span className="status-empty">—</span>
                          }
                        </td>
                        <td>
                          <span className={`prayer-count ${
                            prayCount === 5 ? 'prayer-count--full' :
                            prayCount > 0 ? 'prayer-count--partial' :
                            'prayer-count--none'
                          }`}>
                            {prayCount}/5
                          </span>
                        </td>
                        <td>
                          {getStatus(s.id, 'sholat_tarawih')
                            ? <span className="status-done">✅</span>
                            : <span className="status-empty">—</span>
                          }
                        </td>
                        <td>
                          {getStatus(s.id, 'tadarus')
                            ? <span className="status-done">✅</span>
                            : <span className="status-empty">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="student-cards-mobile">
              {filteredStudents.map((s, index) => {
                const prayCount = getPrayerCount(s.id);
                return (
                  <div key={s.id} className="mobile-student-card" style={{ '--i': index }}>
                    <div className="mobile-card-header">
                      <div className="mobile-card-avatar">{s.name.charAt(0)}</div>
                      <div>
                        <div className="mobile-card-name">{s.name}</div>
                        <div className="mobile-card-class">Kelas {s.class}</div>
                      </div>
                    </div>
                    <div className="mobile-card-stats">
                      <div className="mobile-stat-item">
                        <span className="mobile-stat-label">🍽️ Puasa</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'puasa') ? '✅' : '—'}
                        </span>
                      </div>
                      <div className="mobile-stat-item">
                        <span className="mobile-stat-label">🕌 Sholat</span>
                        <span className={`mobile-stat-value prayer-count ${
                          prayCount === 5 ? 'prayer-count--full' :
                          prayCount > 0 ? 'prayer-count--partial' :
                          'prayer-count--none'
                        }`}>
                          {prayCount}/5
                        </span>
                      </div>
                      <div className="mobile-stat-item">
                        <span className="mobile-stat-label">✨ Tarawih</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'sholat_tarawih') ? '✅' : '—'}
                        </span>
                      </div>
                      <div className="mobile-stat-item">
                        <span className="mobile-stat-label">📖 Tadarus</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'tadarus') ? '✅' : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">📋</span>
            <div className="empty-state-text">Belum ada data siswa</div>
          </div>
        )}
      </div>
    </div>
  );
}
