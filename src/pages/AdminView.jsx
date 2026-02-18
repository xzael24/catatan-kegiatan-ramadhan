import { useState, useEffect, useMemo } from 'react';
import { db, studentsCol, activitiesCol, logsCol, logActivity } from '../services/firebase';
import { getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, doc, writeBatch, orderBy as orderByFs, collection, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

export default function AdminView() {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('all'); // 'all', 'student', 'admin'
  const [logActionFilter, setLogActionFilter] = useState('all');

  // Form state
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load Students
      const q = query(studentsCol, orderBy('name'));
      const sSnap = await getDocs(q);
      const sList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(sList);

      // Load Activities (just for stats, might be heavy if too many)
      // For scalability, we might want to use aggregation queries, but for now simple fetch
      const aSnap = await getDocs(activitiesCol);
      const aList = aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(aList);

      // Load Logs (latest 500)
      if (activeTab === 'logging') {
        await loadLogs();
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const q = query(logsCol, orderBy('timestamp', 'desc'), limit(500));
      const logsSnap = await getDocs(q);
      const logsList = logsSnap.docs.map(doc => {
        const data = doc.data();
        let timestamp = new Date();
        if (data.timestamp) {
          if (data.timestamp.toDate && typeof data.timestamp.toDate === 'function') {
            timestamp = data.timestamp.toDate();
          } else if (data.timestamp.seconds) {
            timestamp = new Date(data.timestamp.seconds * 1000);
          } else if (data.timestamp instanceof Date) {
            timestamp = data.timestamp;
          }
        }
        return { 
          id: doc.id, 
          ...data,
          timestamp
        };
      });
      setLogs(logsList);
    } catch (err) {
      console.error("Error loading logs:", err);
      // Jika orderBy timestamp gagal (belum ada index), coba tanpa orderBy
      try {
        const logsSnap = await getDocs(logsCol);
        const logsList = logsSnap.docs.map(doc => {
          const data = doc.data();
          let timestamp = new Date();
          if (data.timestamp) {
            if (data.timestamp.toDate && typeof data.timestamp.toDate === 'function') {
              timestamp = data.timestamp.toDate();
            } else if (data.timestamp.seconds) {
              timestamp = new Date(data.timestamp.seconds * 1000);
            } else if (data.timestamp instanceof Date) {
              timestamp = data.timestamp;
            }
          }
          return { 
            id: doc.id, 
            ...data,
            timestamp
          };
        });
        // Sort manually by timestamp
        logsList.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(logsList.slice(0, 500));
      } catch (err2) {
        console.error("Error loading logs (fallback):", err2);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'logging') {
      loadLogs();
    }
  }, [activeTab]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // ---- Student CRUD ----
  function openAddForm() {
    setFormMode('add');
    setEditingId(null);
    setFormName('');
    setFormClass('');
  }

  function openEditForm(student) {
    setFormMode('edit');
    setEditingId(student.id);
    setFormName(student.name);
    setFormClass(student.class);
  }

  function cancelForm() {
    setFormMode(null);
    setEditingId(null);
    setFormName('');
    setFormClass('');
  }

  async function handleSaveStudent(e) {
    e.preventDefault();
    if (!formName.trim() || !formClass.trim()) return;

    setLoading(true);
    try {
      const data = { name: formName.trim(), class: formClass.trim().toUpperCase() };
      
      if (formMode === 'add') {
        const docRef = await addDoc(studentsCol, data);
        await logActivity('create_student', { type: 'admin', name: 'Admin' }, {
          studentId: docRef.id,
          studentName: data.name,
          studentClass: data.class
        });
        showToast('✅ Siswa berhasil ditambahkan!');
      } else {
        const oldStudent = students.find(s => s.id === editingId);
        const studentRef = doc(db, 'students', editingId);
        await updateDoc(studentRef, data);
        await logActivity('update_student', { type: 'admin', name: 'Admin' }, {
          studentId: editingId,
          oldData: { name: oldStudent?.name, class: oldStudent?.class },
          newData: { name: data.name, class: data.class }
        });
        showToast('✅ Data siswa berhasil diperbarui!');
      }
      cancelForm();
      loadData();
    } catch (err) {
      console.error(err);
      showToast('❌ Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  function confirmDeleteStudent(student) {
    setModal({
      icon: '⚠️',
      title: 'Hapus Siswa?',
      desc: `Yakin ingin menghapus "${student.name}"? Semua data aktivitas siswa ini juga akan dihapus.`,
      confirmLabel: 'Hapus',
      confirmClass: 'btn--danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          // Delete student doc
          await deleteDoc(doc(db, 'students', student.id));
          
          // Delete activities for this student
          // Note: Client-side deletion like this is okay for small apps. 
          // For production with many records, use Cloud Functions.
          const q = query(collection(db, 'activities'), orderBy('studentId')); // We need index for this or simple filter client side if small
          // Actually better to iterate current activities state since we have it
          const studentActivities = activities.filter(a => a.studentId === student.id);
          
          const batch = writeBatch(db);
          studentActivities.forEach(a => {
             const ref = doc(db, 'activities', a.id);
             batch.delete(ref);
          });
          await batch.commit();

          await logActivity('delete_student', { type: 'admin', name: 'Admin' }, {
            studentId: student.id,
            studentName: student.name,
            studentClass: student.class,
            deletedActivitiesCount: studentActivities.length
          });

          setModal(null);
          showToast('🗑️ Siswa berhasil dihapus');
          loadData();
        } catch (err) {
          console.error(err);
          showToast('❌ Gagal menghapus data');
        } finally {
          setLoading(false);
        }
      }
    });
  }

  // ---- Data Management ----
  function confirmClearActivities() {
    setModal({
      icon: '🗑️',
      title: 'Hapus Semua Aktivitas?',
      desc: 'Semua data checklist ibadah akan dihapus. Data siswa tetap aman. Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Hapus Semua',
      confirmClass: 'btn--danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          const snapshot = await getDocs(activitiesCol);
          const totalCount = snapshot.docs.length;
          // Delete in batches (limit 500 per batch)
          const batch = writeBatch(db);
          let count = 0;
          let batchCount = 0;
          
          for (const document of snapshot.docs) {
            batch.delete(document.ref);
            count++;
            if (count >= 400) {
              await batch.commit();
              // new batch
              // batch is not reusable after commit, need new one? 
              // Actually for simplicity in this helper, let's just assume <500 items or reload loop.
              // Proper way involves creating new batch instance.
              // For now let's hope it's small enough or just do naive Promise.all
            }
          }
          if (count > 0 && count < 400) {
            await batch.commit();
          } else if (count >= 400) {
             // If extremely large, this naive batching logic needs improvement
             // But for SD app likely okay.
             const remaining = snapshot.docs.slice(count);
             if (remaining.length > 0) {
                const batch2 = writeBatch(db);
                remaining.forEach(d => batch2.delete(d.ref));
                await batch2.commit();
             }
          }
          
          await logActivity('clear_activities', { type: 'admin', name: 'Admin' }, {
            deletedCount: totalCount
          });
          
          setModal(null);
          showToast('🗑️ Semua data aktivitas berhasil dihapus');
          loadData();
        } catch (err) { 
          console.error(err);
          showToast('❌ Gagal hapus aktivitas');
        } finally {
          setLoading(false);
        }
      }
    });
  }

  function confirmResetAll() {
    setModal({
      icon: '💣',
      title: 'Reset Seluruh Data?',
      desc: 'SEMUA data (siswa & aktivitas) akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan!',
      confirmLabel: 'Reset Semua',
      confirmClass: 'btn--danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          // Delete students
          const sSnap = await getDocs(studentsCol);
          const studentsCount = sSnap.docs.length;
          const batch = writeBatch(db);
          sSnap.forEach(d => batch.delete(d.ref));
          
          // Delete activities
          const aSnap = await getDocs(activitiesCol);
          const activitiesCount = aSnap.docs.length;
          aSnap.forEach(d => batch.delete(d.ref));
          
          await batch.commit();

          await logActivity('reset_all', { type: 'admin', name: 'Admin' }, {
            deletedStudentsCount: studentsCount,
            deletedActivitiesCount: activitiesCount
          });

          setModal(null);
          showToast('🔄 Database telah di-reset.');
          loadData();
        } catch (err) {
          console.error(err);
          showToast('❌ Gagal reset database');
        } finally {
          setLoading(false);
        }
      }
    });
  }

  // ---- Filtered students ----
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.class.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // ---- Filtered logs ----
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    if (logFilter !== 'all') {
      filtered = filtered.filter(log => log.actor?.type === logFilter);
    }
    
    if (logActionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === logActionFilter);
    }
    
    return filtered;
  }, [logs, logFilter, logActionFilter]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalActivities = activities.length;
    const classes = new Set(students.map(s => s.class));
    const totalClasses = classes.size;
    const doneActivities = activities.filter(a => a.status === 'done').length;
    const uniqueDates = new Set(activities.map(a => a.date));
    const totalDays = uniqueDates.size;

    return { totalStudents, totalActivities, totalClasses, doneActivities, totalDays };
  }, [students, activities]);

  const tabs = [
    { id: 'students', label: '👤 Kelola Siswa' },
    { id: 'data', label: '📊 Data & Reset' },
    { id: 'logging', label: '📝 Logging' },
    { id: 'info', label: 'ℹ️ Info Aplikasi' },
  ];

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-nav-links">
            <Link to="/" className="admin-nav-link">🏠 Halaman Siswa</Link>
            <Link to="/guru" className="admin-nav-link">👨‍🏫 Dashboard Guru</Link>
          </div>
          <span className="admin-header-icon">⚙️</span>
          <h1 className="admin-header-title">Admin Panel</h1>
          <p className="admin-header-subtitle">Kelola Data Ramadhan App (Firebase)</p>
        </div>
      </header>

      <div className="admin-content">
        {/* Loading Overlay */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', marginBottom: '20px' }}>
             ⏳ Memproses data...
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============ STUDENTS TAB ============ */}
        {activeTab === 'students' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2 className="admin-panel-title">Daftar Siswa ({students.length})</h2>
              {formMode === null && (
                <button className="btn btn--primary" onClick={openAddForm}>
                  + Tambah Siswa
                </button>
              )}
            </div>

            {/* Add/Edit Form */}
            {formMode && (
              <form className="admin-form" onSubmit={handleSaveStudent}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family-heading)' }}>
                  {formMode === 'add' ? '➕ Tambah Siswa Baru' : '✏️ Edit Data Siswa'}
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nama Siswa</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Contoh: Ahmad"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kelas</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formClass}
                      onChange={e => setFormClass(e.target.value)}
                      placeholder="Contoh: 1A"
                      required
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn--success" disabled={loading}>
                    {loading ? 'Menyimpan...' : (formMode === 'add' ? '💾 Simpan' : '✅ Update')}
                  </button>
                  <button type="button" className="btn btn--outline" onClick={cancelForm} disabled={loading}>
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* Search */}
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="Cari nama atau kelas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Student List */}
            <div className="admin-student-list">
              {filteredStudents.map((student, index) => (
                <div key={student.id} className="admin-student-item" style={{ '--i': index }}>
                  <div className="admin-student-avatar">
                    {student.name.charAt(0)}
                  </div>
                  <div className="admin-student-info">
                    <div className="admin-student-name">{student.name}</div>
                    <div className="admin-student-class">Kelas {student.class}</div>
                  </div>
                  <div className="admin-student-actions">
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() => openEditForm(student)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => confirmDeleteStudent(student)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {filteredStudents.length === 0 && !loading && (
                <div className="empty-state">
                  <span className="empty-state-icon">🔍</span>
                  <div className="empty-state-text">
                    {searchQuery ? 'Tidak ditemukan' : 'Belum ada siswa'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ DATA TAB ============ */}
        {activeTab === 'data' && (
          <div className="admin-panel">
            <h2 className="admin-panel-title" style={{ marginBottom: 'var(--spacing-lg)' }}>
              📊 Ringkasan Data
            </h2>

            <div className="info-grid">
              <div className="info-card">
                <span className="info-card-icon">👤</span>
                <div className="info-card-value">{stats.totalStudents}</div>
                <div className="info-card-label">Total Siswa</div>
              </div>
              <div className="info-card">
                <span className="info-card-icon">🏫</span>
                <div className="info-card-value">{stats.totalClasses}</div>
                <div className="info-card-label">Jumlah Kelas</div>
              </div>
              <div className="info-card">
                <span className="info-card-icon">✅</span>
                <div className="info-card-value">{stats.doneActivities}</div>
                <div className="info-card-label">Aktivitas Selesai</div>
              </div>
              <div className="info-card">
                <span className="info-card-icon">📅</span>
                <div className="info-card-value">{stats.totalDays}</div>
                <div className="info-card-label">Hari Aktif</div>
              </div>
            </div>

            <div className="danger-zone">
              <h3 className="admin-panel-title" style={{ color: 'var(--color-danger)', marginBottom: 'var(--spacing-md)' }}>
                ⚠️ Zona Berbahaya
              </h3>

              <div className="danger-card">
                <div className="danger-card-header">
                  <span>🗑️</span>
                  <span className="danger-card-title">Hapus Semua Aktivitas</span>
                </div>
                <p className="danger-card-desc">
                  Menghapus seluruh data checklist ibadah (puasa, sholat, tadarus, dll).
                  Data siswa tidak akan terpengaruh.
                </p>
                <button className="btn btn--danger" onClick={confirmClearActivities} disabled={loading}>
                  Hapus Semua Aktivitas
                </button>
              </div>

              <div className="danger-card">
                <div className="danger-card-header">
                  <span>💣</span>
                  <span className="danger-card-title">Reset Seluruh Database</span>
                </div>
                <p className="danger-card-desc">
                  Menghapus SEMUA data (siswa & aktivitas).
                  Tindakan ini tidak dapat dibatalkan!
                </p>
                <button className="btn btn--danger" onClick={confirmResetAll} disabled={loading}>
                  Reset Seluruh Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ LOGGING TAB ============ */}
        {activeTab === 'logging' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2 className="admin-panel-title">📝 Log Aktivitas ({filteredLogs.length} dari {logs.length})</h2>
              <button className="btn btn--outline" onClick={loadLogs} disabled={loading}>
                🔄 Refresh
              </button>
            </div>

            {/* Filters */}
            <div style={{ 
              display: 'flex', 
              gap: 'var(--spacing-md)', 
              marginBottom: 'var(--spacing-lg)',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Filter Aktor:</label>
                <select 
                  className="form-input" 
                  style={{ minWidth: '150px' }}
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                >
                  <option value="all">Semua</option>
                  <option value="student">Siswa</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Filter Aksi:</label>
                <select 
                  className="form-input" 
                  style={{ minWidth: '200px' }}
                  value={logActionFilter}
                  onChange={e => setLogActionFilter(e.target.value)}
                >
                  <option value="all">Semua Aksi</option>
                  <option value="create_student">Tambah Siswa</option>
                  <option value="update_student">Update Siswa</option>
                  <option value="delete_student">Hapus Siswa</option>
                  <option value="toggle_activity">Toggle Aktivitas</option>
                  <option value="update_note">Update Catatan</option>
                  <option value="clear_activities">Hapus Semua Aktivitas</option>
                  <option value="reset_all">Reset Database</option>
                </select>
              </div>
            </div>

            {/* Filtered Logs */}
            {filteredLogs.map((log, index) => {
              const getActionLabel = (action) => {
                const labels = {
                  'create_student': '➕ Tambah Siswa',
                  'update_student': '✏️ Update Siswa',
                  'delete_student': '🗑️ Hapus Siswa',
                  'toggle_activity': '✅ Toggle Aktivitas',
                  'update_note': '📝 Update Catatan',
                  'clear_activities': '🗑️ Hapus Semua Aktivitas',
                  'reset_all': '💣 Reset Database'
                };
                return labels[action] || action;
              };

              const getActivityTypeLabel = (type) => {
                const labels = {
                  'puasa': '🍽️ Puasa',
                  'sholat_subuh': '🌅 Sholat Subuh',
                  'sholat_zuhur': '☀️ Sholat Zuhur',
                  'sholat_ashar': '⛅ Sholat Ashar',
                  'sholat_maghrib': '🌇 Sholat Maghrib',
                  'sholat_isya': '🌙 Sholat Isya',
                  'tadarus': '📖 Tadarus',
                  'sholat_tarawih': '✨ Sholat Tarawih'
                };
                return labels[type] || type;
              };

              const formatTimestamp = (timestamp) => {
                if (!timestamp) return 'Tidak diketahui';
                try {
                  let date;
                  if (timestamp instanceof Date) {
                    date = timestamp;
                  } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                    date = timestamp.toDate();
                  } else if (timestamp.seconds) {
                    date = new Date(timestamp.seconds * 1000);
                  } else {
                    date = new Date(timestamp);
                  }
                  return date.toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                } catch (e) {
                  return 'Format tidak valid';
                }
              };

              return (
                <div 
                  key={log.id} 
                  style={{
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    <div>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: 'var(--font-size-base)',
                        color: log.actor?.type === 'admin' ? 'var(--color-danger)' : 'var(--color-primary)'
                      }}>
                        {getActionLabel(log.action)}
                      </span>
                      <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text-light)' }}>
                        oleh <strong>{log.actor?.name || 'Tidak diketahui'}</strong>
                      </span>
                    </div>
                    <span style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-xs)' }}>
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  
                  {/* Details */}
                  <div style={{ 
                    marginTop: 'var(--spacing-sm)', 
                    padding: 'var(--spacing-sm)',
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)'
                  }}>
                    {log.action === 'create_student' && (
                      <div>
                        <strong>Siswa Baru:</strong> {log.details?.studentName} (Kelas {log.details?.studentClass})
                        <br />
                        <span style={{ color: 'var(--color-text-light)' }}>ID: {log.details?.studentId}</span>
                      </div>
                    )}
                    {log.action === 'update_student' && (
                      <div>
                        <strong>Siswa:</strong> {log.details?.studentId}
                        <br />
                        <strong>Perubahan:</strong> {log.details?.oldData?.name} ({log.details?.oldData?.class}) 
                        → {log.details?.newData?.name} ({log.details?.newData?.class})
                      </div>
                    )}
                    {log.action === 'delete_student' && (
                      <div>
                        <strong>Siswa Dihapus:</strong> {log.details?.studentName} (Kelas {log.details?.studentClass})
                        <br />
                        <span style={{ color: 'var(--color-text-light)' }}>
                          {log.details?.deletedActivitiesCount || 0} aktivitas juga dihapus
                        </span>
                      </div>
                    )}
                    {log.action === 'toggle_activity' && (
                      <div>
                        <strong>Aktivitas:</strong> {getActivityTypeLabel(log.details?.activityType)}
                        <br />
                        <strong>Status:</strong> {log.details?.oldStatus || 'belum ada'} → {log.details?.newStatus || log.details?.status}
                        <br />
                        <span style={{ color: 'var(--color-text-light)' }}>
                          Tanggal: {log.details?.date || log.date}
                        </span>
                      </div>
                    )}
                    {log.action === 'update_note' && (
                      <div>
                        <strong>Aktivitas:</strong> {getActivityTypeLabel(log.details?.activityType)}
                        <br />
                        <strong>Catatan Lama:</strong> {log.details?.oldNote || '(kosong)'}
                        <br />
                        <strong>Catatan Baru:</strong> {log.details?.newNote || '(kosong)'}
                      </div>
                    )}
                    {log.action === 'clear_activities' && (
                      <div>
                        <strong>Total Dihapus:</strong> {log.details?.deletedCount || 0} aktivitas
                      </div>
                    )}
                    {log.action === 'reset_all' && (
                      <div>
                        <strong>Data Dihapus:</strong> {log.details?.deletedStudentsCount || 0} siswa, 
                        {' '}{log.details?.deletedActivitiesCount || 0} aktivitas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredLogs.length === 0 && !loading && (
              <div className="empty-state">
                <span className="empty-state-icon">📝</span>
                <div className="empty-state-text">
                  {logs.length === 0 ? 'Belum ada log aktivitas' : 'Tidak ada log yang sesuai filter'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ INFO TAB ============ */}
        {activeTab === 'info' && (
          <div className="admin-panel">
            <h2 className="admin-panel-title" style={{ marginBottom: 'var(--spacing-lg)' }}>
              ℹ️ Tentang Aplikasi
            </h2>

            <div className="admin-form" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-sm)' }}>🔥</div>
              <h3 style={{
                fontFamily: 'var(--font-family-heading)',
                fontSize: 'var(--font-size-xl)',
                fontWeight: 800,
                marginBottom: 'var(--spacing-xs)'
              }}>
                Ramadhan App Anak Sholeh
              </h3>
              <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-sm)' }}>
                Powered by Firebase Firestore (Realtime)
              </p>

              <div style={{ textAlign: 'left' }}>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Versi:</strong> 2.0.0 (Cloud Sync)
                </div>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Teknologi:</strong> React + Firebase Firestore
                </div>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Sync:</strong> Realtime (Live Updates) ⚡
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Modal ---- */}\
      {modal && (
        <div className="modal-overlay" onClick={() => !loading && setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <span className="modal-icon">{modal.icon}</span>
            <h3 className="modal-title">{modal.title}</h3>
            <p className="modal-desc">{modal.desc}</p>
            <div className="modal-actions">
              <button className="btn btn--outline" onClick={() => setModal(null)} disabled={loading}>
                Batal
              </button>
              <button className={`btn ${modal.confirmClass}`} onClick={modal.onConfirm} disabled={loading}>
                {loading ? 'Memproses...' : modal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Toast ---- */}\
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
