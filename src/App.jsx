import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import StudentView from './pages/StudentView'
import TeacherView from './pages/TeacherView'
import AdminView from './pages/AdminView'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<StudentView />} />
            <Route path="/guru" element={<TeacherView />} />
            <Route path="/admin" element={<AdminView />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  )
}

export default App
