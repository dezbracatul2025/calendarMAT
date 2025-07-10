import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TeamBuildingProvider } from './components/TeamBuildingContext';
import { DebtsProvider } from './context/DebtsContext';
import Login from './components/Login';
import Calendar from './components/Calendar';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <TeamBuildingProvider>
        <DebtsProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </DebtsProvider>
      </TeamBuildingProvider>
    </AuthProvider>
  );
}

export default App; 