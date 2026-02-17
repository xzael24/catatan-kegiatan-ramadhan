import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import StudentView from './pages/StudentView'
import TeacherView from './pages/TeacherView'
import AdminView from './pages/AdminView'

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<StudentView />} />
          <Route path="/guru" element={<TeacherView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
