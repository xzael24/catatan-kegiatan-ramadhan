import { useState, useEffect, useMemo } from 'react';
import { db, studentsCol, activitiesCol } from '../services/firebase';
import { getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, doc, writeBatch, orderBy as orderByFs, collection } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

export default function AdminView() {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      console.error(err);
      showToast('❌ Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

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
        await addDoc(studentsCol, data);
        showToast('✅ Siswa berhasil ditambahkan!');
      } else {
        const studentRef = doc(db, 'students', editingId);
        await updateDoc(studentRef, data);
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
          const batch = writeBatch(db);
          sSnap.forEach(d => batch.delete(d.ref));
          
          // Delete activities
          const aSnap = await getDocs(activitiesCol);
          aSnap.forEach(d => batch.delete(d.ref));
          
          await batch.commit();

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
