import { useEffect, useState } from 'react';
import { db } from '../services/db';

export default function StudentSelector({ onSelect }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    db.students.toArray().then(setStudents);
  }, []);

  const getInitial = (name) => name.charAt(0).toUpperCase();

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
