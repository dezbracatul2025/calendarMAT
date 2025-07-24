import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import './Login.css';

function Login() {
  const { login, agentNames } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-select agent from URL parameter or localStorage
  useEffect(() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(location.search);
    const agentFromUrl = urlParams.get('agent');
    
    // Check localStorage for last used agent
    const lastAgent = localStorage.getItem('lastSelectedAgent');
    
    // Priority: URL parameter > localStorage > empty
    const agentToSelect = agentFromUrl || lastAgent || '';
    
    if (agentToSelect && agentNames.includes(agentToSelect)) {
      setSelectedAgent(agentToSelect);
    }
  }, [agentNames, location]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedAgent) {
      setError('Te rog selectează un agent');
      return;
    }
    
    if (!password) {
      setError('Te rog introdu parola');
      return;
    }
    
    // Save selected agent to localStorage
    localStorage.setItem('lastSelectedAgent', selectedAgent);
    
    const result = login(selectedAgent, password);
    
    if (result.success) {
      navigate('/calendar');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="login-container">
      {/* Video Background Element */}
      <video 
        autoPlay 
        muted 
        loop 
        playsInline 
        className="login-video-bg"
      >
        <source src="https://cdn.glitch.global/be1c0130-336b-4c7a-b28f-528d3d64db4e/WAVES.mp4?v=1745015337324" type="video/mp4" /> 
        {/* You can still add other formats if needed */}
        Your browser does not support the video tag.
      </video>
      
      <div className="login-card">
        <h1 className="login-title">Calendar Agenți</h1>
        
        <div className="login-form-container">
          <h2 className="login-subtitle">Autentificare agent</h2>
          
          {error && <div className="login-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <select 
                value={selectedAgent} 
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="agent-dropdown"
              >
                <option value="">Selectează agent</option>
                {agentNames.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolă"
                className="password-input"
              />
            </div>
            
            <button type="submit" className="login-button">
              Conectare
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login; 