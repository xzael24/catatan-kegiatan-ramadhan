import { useState, useEffect } from 'react';
import StudentSelector from '../components/StudentSelector';
import StudentActivityList from '../components/StudentActivityList';
import '../styles/student.css';

export default function StudentView() {
  const [studentId, setStudentId] = useState(localStorage.getItem('studentId') || null);

  const handleSelect = (id) => {
    localStorage.setItem('studentId', id);
    setStudentId(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('studentId');
    setStudentId(null);
  };

  return (
    <div className="student-page">
      {/* Gradient Header */}
      <header className="student-header">
        <div className="header-decorations">
          <span className="header-decoration">🌙</span>
          <span className="header-decoration">⭐</span>
          <span className="header-decoration">🕌</span>
          <span className="header-decoration">⭐</span>
          <span className="header-decoration">🌙</span>
        </div>
        <h1 className="header-title">Ramadhan Seru</h1>
        <p className="header-subtitle">Yuk Semangat Ibadah! ✨</p>
      </header>

      {/* Main Content */}
      <div className="student-content">
        {studentId ? (
          <StudentActivityList studentId={parseInt(studentId)} onLogout={handleLogout} />
        ) : (
          <StudentSelector onSelect={handleSelect} />
        )}
      </div>
    </div>
  );
}
