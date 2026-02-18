import { useEffect, useState } from 'react';
import { db, studentsCol, seedInitialData } from '../services/firebase';
import { getDocs, query, orderBy } from 'firebase/firestore';

export default function StudentSelector({ onSelect }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    async function loadStudents() {
      try {
        await seedInitialData();

        const q = query(studentsCol, orderBy('name'));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(list);
      } catch (error) {
        console.error("Error loading students:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  // Compute unique classes and filter students
  const uniqueClasses = [...new Set(students.map(s => s.class))].sort();
  
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === '' || student.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const getInitial = (name) => name?.charAt(0).toUpperCase() || '?';

  if (loading) {
    return (
      <div className="selector-container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
        <div>Memuat data siswa...</div>
      </div>
    );
  }

  return (
    <div className="selector-container">
      <h2 className="selector-title">👋 Siapa Namamu?</h2>
      <p className="selector-subtitle">Pilih nama kamu untuk mulai</p>

      {/* Filter & Search Controls */}
      <div className="selector-controls">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            className="search-input"
            placeholder="Cari nama kamu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
          className="class-filter-select"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {uniqueClasses.map(cls => (
            <option key={cls} value={cls}>Kelas {cls}</option>
          ))}
        </select>
      </div>

      <div className="selector-grid">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student, index) => (
            <button
              key={student.id}
              className="student-card"
              style={{ '--i': index }}
              onClick={() => onSelect(student.id)}
            >
              <div className="student-avatar">
                {getInitial(student.name)}
              </div>
              <div className="student-card-info">
                <div className="student-card-name">{student.name}</div>
                <span className="student-card-class">Kelas {student.class}</span>
              </div>
            </button>
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--color-text-light)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>😔</div>
            <div>Maaf, nama tidak ditemukan</div>
          </div>
        )}
      </div>
    </div>
  );
}
