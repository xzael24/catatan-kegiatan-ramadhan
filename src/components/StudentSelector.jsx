import { useEffect, useState } from 'react';
import { db, studentsCol, seedInitialData } from '../services/firebase';
import { getDocs, query, orderBy } from 'firebase/firestore';

export default function StudentSelector({ onSelect }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudents() {
      try {
        // Try seeding if empty (runs only once per device/browser ideally, 
        // but seed function handles check)
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

      <div className="selector-grid">
        {students.map((student, index) => (
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
        ))}
      </div>
    </div>
  );
}
