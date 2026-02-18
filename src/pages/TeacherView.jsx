import { useState, useEffect, useMemo, useRef } from 'react';
import { db, activitiesCol, studentsCol } from '../services/firebase';
import { getDocs, query, where, onSnapshot, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import '../styles/teacher.css';

export default function TeacherView() {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [filterClass, setFilterClass] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMode, setImportMode] = useState('single'); // 'single' = satu tanggal (date picker), 'bulk' = banyak tanggal (baca dari kolom Tanggal di file)
  const [bulkDateFrom, setBulkDateFrom] = useState(''); // opsional: hanya import dari tanggal ini (mode keseluruhan)
  const [bulkDateTo, setBulkDateTo] = useState('');     // opsional: hanya import sampai tanggal ini (mode keseluruhan)
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState('single'); // 'single' | 'range' | 'all'
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const fileInputRef = useRef(null);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    async function loadStudents() {
      const snapshot = await getDocs(studentsCol);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    }
    loadStudents();
  }, []);

  useEffect(() => {
    setLoading(true);
    // Realtime listener for activities on selected date
    const q = query(activitiesCol, where('date', '==', date));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [date]);

  const prayers = ['sholat_subuh', 'sholat_zuhur', 'sholat_ashar', 'sholat_maghrib', 'sholat_isya'];
  const allActivityTypes = ['sahur', 'puasa', ...prayers, 'tadarus', 'sholat_tarawih'];

  const getStatus = (studentId, type) => {
    const act = activities.find(a => a.studentId === studentId && a.type === type);
    return act?.status === 'done';
  };

  const getNote = (studentId, type) => {
    const act = activities.find(a => a.studentId === studentId && a.type === type);
    return act?.note || '';
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
    let list = students;
    if (filterClass !== 'all') {
      list = list.filter(s => s.class === filterClass);
    }
    // Sort by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filterClass]);

  // Stats
  const stats = useMemo(() => {
    const totalStudents = filteredStudents.length;
    const activeStudents = filteredStudents.filter(s =>
      activities.some(a => a.studentId === s.id && a.status === 'done')
    ).length;

    const allTypes = allActivityTypes;
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    }
    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportDropdown]);

  // Export functions
  function handleExportClick() {
    setShowExportModal(true);
    setShowExportDropdown(false);
  }

  async function handleExport(format) {
    setShowExportModal(false);
    
    if (exportMode === 'single') {
      if (format === 'csv') {
        exportToCSV([date]);
      } else {
        exportToXLSX([date]);
      }
    } else if (exportMode === 'range') {
      if (!exportDateFrom || !exportDateTo) {
        alert('❌ Harap isi tanggal Dari dan Sampai');
        return;
      }
      if (exportDateFrom > exportDateTo) {
        alert('❌ Tanggal Dari harus lebih kecil dari tanggal Sampai');
        return;
      }
      const dates = generateDateRange(exportDateFrom, exportDateTo);
      if (format === 'csv') {
        exportToCSV(dates);
      } else {
        exportToXLSX(dates);
      }
    } else if (exportMode === 'all') {
      // Fetch semua tanggal yang ada di database
      const allActivitiesSnap = await getDocs(activitiesCol);
      const allDates = [...new Set(allActivitiesSnap.docs.map(d => d.data().date))].sort();
      if (allDates.length === 0) {
        alert('❌ Tidak ada data untuk diekspor');
        return;
      }
      if (format === 'csv') {
        exportToCSV(allDates);
      } else {
        exportToXLSX(allDates);
      }
    }
  }

  function generateDateRange(from, to) {
    const dates = [];
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toLocaleDateString('en-CA'));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  async function fetchActivitiesForDates(dates) {
    const allActivities = [];
    for (const d of dates) {
      const q = query(activitiesCol, where('date', '==', d));
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        allActivities.push({ id: doc.id, ...doc.data() });
      });
    }
    return allActivities;
  }

  async function exportToCSV(dates) {
    const allActivities = await fetchActivitiesForDates(dates);
    const headers = ['Nama', 'Kelas', 'Tanggal', 'Sahur', 'Puasa', 'Sholat Subuh', 'Sholat Zuhur', 'Sholat Ashar', 'Sholat Maghrib', 'Sholat Isya', 'Tadarus', 'Catatan Tadarus', 'Tarawih'];
    const rows = [];

    for (const d of dates) {
      const dateActivities = allActivities.filter(a => a.date === d);
      const studentsForDate = [...new Set(dateActivities.map(a => a.studentId))];
      
      for (const studentId of studentsForDate) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        
        const studentActivities = dateActivities.filter(a => a.studentId === studentId);
        const getActivityStatus = (type) => {
          const act = studentActivities.find(a => a.type === type);
          return act?.status === 'done' ? 'Ya' : 'Tidak';
        };
        const getTadarusNote = () => {
          const act = studentActivities.find(a => a.type === 'tadarus');
          return act?.note || '';
        };
        
        const formattedDateStr = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        
        rows.push([
          student.name,
          student.class,
          formattedDateStr,
          getActivityStatus('sahur'),
          getActivityStatus('puasa'),
          getActivityStatus('sholat_subuh'),
          getActivityStatus('sholat_zuhur'),
          getActivityStatus('sholat_ashar'),
          getActivityStatus('sholat_maghrib'),
          getActivityStatus('sholat_isya'),
          getActivityStatus('tadarus'),
          getTadarusNote(),
          getActivityStatus('sholat_tarawih')
        ]);
      }
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const filename = dates.length === 1 
      ? `kegiatan-ramadhan-${dates[0]}.csv`
      : `kegiatan-ramadhan-${dates[0]}-${dates[dates.length-1]}.csv`;

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function exportToXLSX(dates) {
    const allActivities = await fetchActivitiesForDates(dates);
    const headers = ['Nama', 'Kelas', 'Tanggal', 'Sahur', 'Puasa', 'Sholat Subuh', 'Sholat Zuhur', 'Sholat Ashar', 'Sholat Maghrib', 'Sholat Isya', 'Tadarus', 'Catatan Tadarus', 'Tarawih'];
    const rows = [];

    for (const d of dates) {
      const dateActivities = allActivities.filter(a => a.date === d);
      const studentsForDate = [...new Set(dateActivities.map(a => a.studentId))];
      
      for (const studentId of studentsForDate) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        
        const studentActivities = dateActivities.filter(a => a.studentId === studentId);
        const getActivityStatus = (type) => {
          const act = studentActivities.find(a => a.type === type);
          return act?.status === 'done' ? 'Ya' : 'Tidak';
        };
        const getTadarusNote = () => {
          const act = studentActivities.find(a => a.type === 'tadarus');
          return act?.note || '';
        };
        
        const formattedDateStr = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        
        rows.push([
          student.name,
          student.class,
          formattedDateStr,
          getActivityStatus('sahur'),
          getActivityStatus('puasa'),
          getActivityStatus('sholat_subuh'),
          getActivityStatus('sholat_zuhur'),
          getActivityStatus('sholat_ashar'),
          getActivityStatus('sholat_maghrib'),
          getActivityStatus('sholat_isya'),
          getActivityStatus('tadarus'),
          getTadarusNote(),
          getActivityStatus('sholat_tarawih')
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kegiatan Ramadhan');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Nama
      { wch: 10 }, // Kelas
      { wch: 25 }, // Tanggal
      { wch: 10 }, // Sahur
      { wch: 10 }, // Puasa
      { wch: 15 }, // Sholat Subuh
      { wch: 15 }, // Sholat Zuhur
      { wch: 15 }, // Sholat Ashar
      { wch: 15 }, // Sholat Maghrib
      { wch: 15 }, // Sholat Isya
      { wch: 10 }, // Tadarus
      { wch: 30 }, // Catatan Tadarus
      { wch: 10 }  // Tarawih
    ];

    const filename = dates.length === 1 
      ? `kegiatan-ramadhan-${dates[0]}.xlsx`
      : `kegiatan-ramadhan-${dates[0]}-${dates[dates.length-1]}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  // Import functions
  async function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const data = await readFile(file);
      let activitiesToImport = parseImportData(data, file.name);
      
      if (activitiesToImport.length === 0) {
        alert('❌ Tidak ada data yang valid untuk diimport');
        setImportLoading(false);
        return;
      }

      // Tentukan tanggal per baris
      if (importMode === 'single') {
        activitiesToImport = activitiesToImport.map(row => ({ ...row, targetDate: date }));
      } else {
        activitiesToImport = activitiesToImport
          .filter(row => {
            const d = row.dateFromFile;
            if (!d) return false;
            row.targetDate = d;
            return true;
          });
        if (activitiesToImport.length === 0) {
          alert('❌ Mode "Keseluruhan tanggal": file harus punya kolom Tanggal (format YYYY-MM-DD atau DD/MM/YYYY).');
          setImportLoading(false);
          return;
        }
        // Opsional: filter hanya tanggal tertentu (contoh: 19, 20, 21 saja)
        if (bulkDateFrom || bulkDateTo) {
          activitiesToImport = activitiesToImport.filter(row => {
            const d = row.targetDate;
            if (bulkDateFrom && d < bulkDateFrom) return false;
            if (bulkDateTo && d > bulkDateTo) return false;
            return true;
          });
          if (activitiesToImport.length === 0) {
            alert('❌ Tidak ada baris yang masuk dalam rentang tanggal yang dipilih.');
            setImportLoading(false);
            return;
          }
        }
      }

      // Untuk bulk: load existing activities per tanggal unik
      const uniqueDates = [...new Set(activitiesToImport.map(r => r.targetDate))];
      const existingByKey = {}; // key = studentId_date_type -> { id, ... }
      if (importMode === 'bulk' && uniqueDates.length > 0) {
        for (const d of uniqueDates) {
          const q = query(activitiesCol, where('date', '==', d));
          const snap = await getDocs(q);
          snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const key = `${data.studentId}_${data.date}_${data.type}`;
            existingByKey[key] = { id: docSnap.id, ...data };
          });
        }
      }

      const BATCH_SIZE = 450;
      let batch = writeBatch(db);
      let opCount = 0;
      let importedCount = 0;
      const pendingCreates = new Set(); // untuk bulk: hindari duplikat create dalam batch yang sama

      for (const activityData of activitiesToImport) {
        const student = students.find(s => 
          s.name.toLowerCase() === activityData.nama.toLowerCase() &&
          s.class.toUpperCase() === activityData.kelas.toUpperCase()
        );
        if (!student) continue;

        const targetDate = activityData.targetDate;
        const activityTypes = [
          { type: 'sahur', status: activityData.sahur },
          { type: 'puasa', status: activityData.puasa },
          { type: 'sholat_subuh', status: activityData.sholatSubuh },
          { type: 'sholat_zuhur', status: activityData.sholatZuhur },
          { type: 'sholat_ashar', status: activityData.sholatAshar },
          { type: 'sholat_maghrib', status: activityData.sholatMaghrib },
          { type: 'sholat_isya', status: activityData.sholatIsya },
          { type: 'tadarus', status: activityData.tadarus, note: activityData.catatanTadarus || '' },
          { type: 'sholat_tarawih', status: activityData.tarawih }
        ];

        for (const { type, status, note } of activityTypes) {
          if (status === 'Ya' || status === 'ya' || status === 'Y' || status === 'y' || status === true || status === 'TRUE') {
            const key = `${student.id}_${targetDate}_${type}`;
            let existing = existingByKey[key];
            if (importMode === 'single') {
              existing = activities.find(a => a.studentId === student.id && a.type === type && a.date === targetDate);
            }
            if (importMode === 'bulk' && !existing && pendingCreates.has(key)) continue;

            if (existing) {
              const updates = { status: 'done' };
              if (type === 'tadarus' && note) updates.note = note;
              const activityRef = doc(db, 'activities', existing.id);
              batch.update(activityRef, updates);
            } else {
              pendingCreates.add(key);
              const newActivityRef = doc(activitiesCol);
              batch.set(newActivityRef, {
                studentId: student.id,
                date: targetDate,
                type: type,
                status: 'done',
                note: type === 'tadarus' ? (note || '') : ''
              });
            }
            opCount++;
            importedCount++;

            if (opCount >= BATCH_SIZE) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
            }
          }
        }
      }

      if (opCount > 0) await batch.commit();
      const dateInfo = importMode === 'bulk' ? ` (${uniqueDates.length} tanggal)` : '';
      alert(`✅ Berhasil mengimport ${importedCount} aktivitas${dateInfo}!`);
      setShowImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error importing:', error);
      alert('❌ Gagal mengimport data: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  }

  /** Normalize date string dari file ke YYYY-MM-DD */
  function normalizeDateString(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    // Sudah YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY atau DD-MM-YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // YYYY/MM/DD
    const yyyymmdd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmdd) {
      const [, y, m, d] = yyyymmdd;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  function parseImportData(data, fileName) {
    const activities = [];
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      jsonData.forEach(row => {
        const rawDate = row['Tanggal'] || row['tanggal'] || row['Date'] || row['date'] || '';
        activities.push({
          nama: row['Nama'] || row['nama'] || '',
          kelas: row['Kelas'] || row['kelas'] || '',
          dateFromFile: rawDate ? normalizeDateString(rawDate) : null,
          sahur: row['Sahur'] || row['sahur'] || '',
          puasa: row['Puasa'] || row['puasa'] || '',
          sholatSubuh: row['Sholat Subuh'] || row['sholat subuh'] || '',
          sholatZuhur: row['Sholat Zuhur'] || row['sholat zuhur'] || '',
          sholatAshar: row['Sholat Ashar'] || row['sholat ashar'] || '',
          sholatMaghrib: row['Sholat Maghrib'] || row['sholat maghrib'] || '',
          sholatIsya: row['Sholat Isya'] || row['sholat isya'] || '',
          tadarus: row['Tadarus'] || row['tadarus'] || '',
          catatanTadarus: row['Catatan Tadarus'] || row['catatan tadarus'] || row['Catatan'] || '',
          tarawih: row['Tarawih'] || row['tarawih'] || ''
        });
      });
    } else {
      // CSV
      const lines = data.split('\n').filter(line => line.trim());
      if (lines.length < 2) return activities;
      
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const namaIdx = headers.findIndex(h => h.toLowerCase().includes('nama'));
      const kelasIdx = headers.findIndex(h => h.toLowerCase().includes('kelas'));
      const dateIdx = headers.findIndex(h => h.toLowerCase() === 'tanggal' || h.toLowerCase() === 'date');
      const sahurIdx = headers.findIndex(h => h.toLowerCase().includes('sahur'));
      const puasaIdx = headers.findIndex(h => h.toLowerCase().includes('puasa'));
      const sholatSubuhIdx = headers.findIndex(h => h.toLowerCase().includes('subuh'));
      const sholatZuhurIdx = headers.findIndex(h => h.toLowerCase().includes('zuhur'));
      const sholatAsharIdx = headers.findIndex(h => h.toLowerCase().includes('ashar'));
      const sholatMaghribIdx = headers.findIndex(h => h.toLowerCase().includes('maghrib'));
      const sholatIsyaIdx = headers.findIndex(h => h.toLowerCase().includes('isya'));
      const tadarusIdx = headers.findIndex(h => h.toLowerCase().includes('tadarus') && !h.toLowerCase().includes('catatan'));
      const catatanIdx = headers.findIndex(h => h.toLowerCase().includes('catatan'));
      const tarawihIdx = headers.findIndex(h => h.toLowerCase().includes('tarawih'));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        const rawDate = dateIdx >= 0 ? values[dateIdx] : '';
        activities.push({
          nama: values[namaIdx] || '',
          kelas: values[kelasIdx] || '',
          dateFromFile: rawDate ? normalizeDateString(rawDate) : null,
          sahur: values[sahurIdx] || '',
          puasa: values[puasaIdx] || '',
          sholatSubuh: values[sholatSubuhIdx] || '',
          sholatZuhur: values[sholatZuhurIdx] || '',
          sholatAshar: values[sholatAsharIdx] || '',
          sholatMaghrib: values[sholatMaghribIdx] || '',
          sholatIsya: values[sholatIsyaIdx] || '',
          tadarus: values[tadarusIdx] || '',
          catatanTadarus: values[catatanIdx] || '',
          tarawih: values[tarawihIdx] || ''
        });
      }
    }
    
    return activities.filter(a => a.nama && a.kelas);
  }

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
        {/* Date Picker & Export/Import */}
        <div className="date-picker-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span className="date-picker-label">📅 Tanggal:</span>
            <input
              type="date"
              className="date-picker-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', position: 'relative' }}>
            {/* Export Dropdown */}
            <div ref={exportDropdownRef} style={{ position: 'relative' }}>
              <button 
                className="btn btn--outline" 
                onClick={handleExportClick}
                style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                📥 Export Data
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
            <button 
              className="btn btn--primary" 
              onClick={() => setShowImportModal(true)}
              style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px' }}
            >
              📤 Import Data
            </button>
          </div>
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

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            🔄 Memuat data realtime...
          </div>
        )}

        {/* Desktop Table View */}
        {!loading && filteredStudents.length > 0 ? (
          <>
            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Siswa</th>
                    <th>Kelas</th>
                    <th>Sahur</th>
                    <th>Puasa</th>
                    <th>Sholat</th>
                    <th>Tadarus</th>
                    <th>Tarawih</th>
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
                          {getStatus(s.id, 'sahur')
                            ? <span className="status-done">✅</span>
                            : <span className="status-empty">—</span>
                          }
                        </td>
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
                          {getStatus(s.id, 'tadarus')
                            ? <>
                                <span className="status-done">✅</span>
                                {getNote(s.id, 'tadarus') && (
                                  <div className="tadarus-note">{getNote(s.id, 'tadarus')}</div>
                                )}
                              </>
                            : <span className="status-empty">—</span>
                          }
                        </td>
                        <td>
                          {getStatus(s.id, 'sholat_tarawih')
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
                        <span className="mobile-stat-label">🌙 Sahur</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'sahur') ? '✅' : '—'}
                        </span>
                      </div>
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
                        <span className="mobile-stat-label">📖 Tadarus</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'tadarus') ? '✅' : '—'}
                        </span>
                      </div>
                      <div className="mobile-stat-item">
                        <span className="mobile-stat-label">✨ Tarawih</span>
                        <span className="mobile-stat-value">
                          {getStatus(s.id, 'sholat_tarawih') ? '✅' : '—'}
                        </span>
                      </div>
                      {getNote(s.id, 'tadarus') && (
                        <div className="mobile-stat-item" style={{ gridColumn: '1 / -1' }}>
                          <span className="mobile-stat-label">📝 Catatan</span>
                          <span className="mobile-stat-value" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-light)' }}>
                            {getNote(s.id, 'tadarus')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          !loading && (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <div className="empty-state-text">Belum ada data siswa</div>
            </div>
          )
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="modal-overlay" onClick={() => !importLoading && setShowImportModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <span className="modal-icon">📤</span>
              <h3 className="modal-title">Import Data Kegiatan</h3>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Mode import:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'single'}
                      onChange={() => setImportMode('single')}
                      disabled={importLoading}
                    />
                    <span>
                      <strong>Satu tanggal</strong> — Pakai tanggal yang dipilih di date picker. Semua baris di file dianggap untuk tanggal itu.
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'bulk'}
                      onChange={() => setImportMode('bulk')}
                      disabled={importLoading}
                    />
                    <span>
                      <strong>Keseluruhan tanggal</strong> — File harus punya kolom <strong>Tanggal</strong>. Setiap baris di-import ke tanggal yang tertulis di kolom itu (bisa banyak tanggal dalam satu file).
                    </span>
                  </label>
                </div>
              </div>

              {importMode === 'single' ? (
                <div style={{ 
                  background: 'var(--color-bg)', 
                  padding: 'var(--spacing-md)', 
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-md)',
                  border: '2px solid var(--color-primary)'
                }}>
                  <strong style={{ color: 'var(--color-primary)' }}>📅 Tanggal yang akan di-import:</strong>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 'var(--spacing-xs)' }}>
                    {formattedDate}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: 'var(--spacing-xs)' }}>
                    (Format: {date})
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ 
                    background: 'var(--color-bg)', 
                    padding: 'var(--spacing-md)', 
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-md)',
                    border: '2px solid var(--color-primary)'
                  }}>
                    <strong style={{ color: 'var(--color-primary)' }}>📅 Kolom Tanggal di file:</strong>
                    <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                      Format: <strong>YYYY-MM-DD</strong> (contoh: 2026-02-18) atau <strong>DD/MM/YYYY</strong> (contoh: 18/02/2026). Baris tanpa tanggal valid akan dilewati.
                    </div>
                  </div>
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>🔹 Filter tanggal (opsional)</strong>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginBottom: 'var(--spacing-sm)' }}>
                      Kosongkan = import semua tanggal di file. Isi salah satu atau keduanya = hanya baris dalam rentang ini yang di-import.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>Dari:</span>
                        <input
                          type="date"
                          className="form-input"
                          value={bulkDateFrom}
                          onChange={e => setBulkDateFrom(e.target.value)}
                          disabled={importLoading}
                          style={{ padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>Sampai:</span>
                        <input
                          type="date"
                          className="form-input"
                          value={bulkDateTo}
                          onChange={e => setBulkDateTo(e.target.value)}
                          disabled={importLoading}
                          style={{ padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                        />
                      </label>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: 'var(--spacing-xs)' }}>
                      Contoh: isi Dari 19 Feb & Sampai 21 Feb → hanya data tanggal 19, 20, 21 yang di-import.
                    </p>
                  </div>
                </>
              )}

              <p className="modal-desc" style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
                Format file: CSV atau Excel dengan kolom Nama, Kelas, {importMode === 'bulk' ? 'Tanggal, ' : ''}Sahur, Puasa, Sholat Subuh, Sholat Zuhur, Sholat Ashar, Sholat Maghrib, Sholat Isya, Tadarus, Catatan Tadarus, Tarawih.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                style={{ marginBottom: 'var(--spacing-md)', width: '100%' }}
                disabled={importLoading}
              />
              <div className="modal-actions">
                <button 
                  className="btn btn--outline" 
                  onClick={() => setShowImportModal(false)} 
                  disabled={importLoading}
                >
                  Batal
                </button>
              </div>
              {importLoading && (
                <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)', color: 'var(--color-text-light)' }}>
                  ⏳ Memproses import...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <span className="modal-icon">📥</span>
              <h3 className="modal-title">Export Data Kegiatan</h3>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Mode export:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'single'}
                      onChange={() => setExportMode('single')}
                    />
                    <span>
                      <strong>Tanggal yang dipilih</strong> — Export data untuk tanggal yang dipilih di date picker ({formattedDate}).
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'range'}
                      onChange={() => setExportMode('range')}
                    />
                    <span>
                      <strong>Rentang tanggal</strong> — Export data dari tanggal tertentu sampai tanggal tertentu.
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'all'}
                      onChange={() => setExportMode('all')}
                    />
                    <span>
                      <strong>Keseluruhan</strong> — Export semua data kegiatan yang ada di database (semua tanggal).
                    </span>
                  </label>
                </div>
              </div>

              {exportMode === 'range' && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>🔹 Pilih rentang tanggal:</strong>
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Dari:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={exportDateFrom}
                        onChange={e => setExportDateFrom(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Sampai:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={exportDateTo}
                        onChange={e => setExportDateTo(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                      />
                    </label>
                  </div>
                </div>
              )}

              <p className="modal-desc" style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
                Pilih format file yang ingin diekspor:
              </p>

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                <button
                  className="btn btn--outline"
                  onClick={() => handleExport('csv')}
                  style={{ flex: 1 }}
                >
                  📄 Export CSV
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => handleExport('xlsx')}
                  style={{ flex: 1 }}
                >
                  📊 Export Excel
                </button>
              </div>

              <div className="modal-actions">
                <button 
                  className="btn btn--outline" 
                  onClick={() => setShowExportModal(false)}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
