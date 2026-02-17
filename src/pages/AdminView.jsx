import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

export default function AdminView() {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  // Form state
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const s = await db.students.orderBy('name').toArray();
    const a = await db.activities.toArray();
    setStudents(s);
    setActivities(a);
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

    try {
      if (formMode === 'add') {
        await db.students.add({ name: formName.trim(), class: formClass.trim().toUpperCase() });
        showToast('✅ Siswa berhasil ditambahkan!');
      } else {
        await db.students.update(editingId, { name: formName.trim(), class: formClass.trim().toUpperCase() });
        showToast('✅ Data siswa berhasil diperbarui!');
      }
      cancelForm();
      loadData();
    } catch (err) {
      console.error(err);
      showToast('❌ Terjadi kesalahan');
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
        await db.students.delete(student.id);
        await db.activities.where({ studentId: student.id }).delete();
        setModal(null);
        showToast('🗑️ Siswa berhasil dihapus');
        loadData();
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
        await db.activities.clear();
        setModal(null);
        showToast('🗑️ Semua data aktivitas berhasil dihapus');
        loadData();
      }
    });
  }

  function confirmResetAll() {
    setModal({
      icon: '💣',
      title: 'Reset Seluruh Data?',
      desc: 'SEMUA data (siswa & aktivitas) akan dihapus dan dikembalikan ke data awal. Tindakan ini tidak dapat dibatalkan!',
      confirmLabel: 'Reset Semua',
      confirmClass: 'btn--danger',
      onConfirm: async () => {
        await db.delete();
        setModal(null);
        showToast('🔄 Database telah di-reset. Memuat ulang...');
        setTimeout(() => window.location.reload(), 1500);
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
          <p className="admin-header-subtitle">Kelola Data Ramadhan App</p>
        </div>
      </header>

      <div className="admin-content">
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
                  <button type="submit" className="btn btn--success">
                    {formMode === 'add' ? '💾 Simpan' : '✅ Update'}
                  </button>
                  <button type="button" className="btn btn--outline" onClick={cancelForm}>
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
              {filteredStudents.length === 0 && (
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
                <button className="btn btn--danger" onClick={confirmClearActivities}>
                  Hapus Semua Aktivitas
                </button>
              </div>

              <div className="danger-card">
                <div className="danger-card-header">
                  <span>💣</span>
                  <span className="danger-card-title">Reset Seluruh Database</span>
                </div>
                <p className="danger-card-desc">
                  Menghapus SEMUA data (siswa & aktivitas) dan mengembalikan ke data awal seperti pertama kali install.
                  Tindakan ini tidak dapat dibatalkan!
                </p>
                <button className="btn btn--danger" onClick={confirmResetAll}>
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
              <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-sm)' }}>🕌</div>
              <h3 style={{
                fontFamily: 'var(--font-family-heading)',
                fontSize: 'var(--font-size-xl)',
                fontWeight: 800,
                marginBottom: 'var(--spacing-xs)'
              }}>
                Ramadhan App Anak Sholeh
              </h3>
              <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-sm)' }}>
                Aplikasi pencatatan ibadah Ramadhan untuk siswa SD
              </p>

              <div style={{ textAlign: 'left' }}>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Versi:</strong> 1.0.0
                </div>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Teknologi:</strong> React + Vite + Dexie (IndexedDB) + PWA
                </div>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Data Storage:</strong> Lokal (di perangkat, tanpa server)
                </div>
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Mode Offline:</strong> ✅ Didukung (PWA)
                </div>
              </div>
            </div>

            <div className="admin-form">
              <h3 style={{
                fontFamily: 'var(--font-family-heading)',
                fontSize: 'var(--font-size-md)',
                fontWeight: 700,
                marginBottom: 'var(--spacing-md)'
              }}>
                📖 Cara Penggunaan
              </h3>
              <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.8, color: 'var(--color-text-light)' }}>
                <p><strong>1. Halaman Siswa</strong> — Siswa memilih nama, lalu mencentang ibadah yang sudah dilakukan hari itu.</p>
                <p style={{ marginTop: 'var(--spacing-sm)' }}><strong>2. Dashboard Guru</strong> — Guru melihat rekap ibadah seluruh siswa per tanggal.</p>
                <p style={{ marginTop: 'var(--spacing-sm)' }}><strong>3. Admin Panel</strong> — Mengelola data siswa (tambah/edit/hapus) dan reset data.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Modal ---- */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <span className="modal-icon">{modal.icon}</span>
            <h3 className="modal-title">{modal.title}</h3>
            <p className="modal-desc">{modal.desc}</p>
            <div className="modal-actions">
              <button className="btn btn--outline" onClick={() => setModal(null)}>
                Batal
              </button>
              <button className={`btn ${modal.confirmClass}`} onClick={modal.onConfirm}>
                {modal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Toast ---- */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
