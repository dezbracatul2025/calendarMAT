import React, { createContext, useState, useContext, useEffect } from 'react';

// Agent data with passwords and colors
const agentsData = {
  // Echipa Andreea
  Andreea:    { team: "Andreea",  password: "motivatie25",   color: "#FFA500" },
  Claudiu:    { team: "Andreea",  password: "perseverenta25",color: "#008000" },
  Cosmina:    { team: "Andreea",  password: "ambitie25",     color: "#FFC107" },
  Monica:     { team: "Andreea",  password: "floare12",      color: "#8E44AD" },
  Valentina:  { team: "Andreea",  password: "soare27",       color: "#F39C12" },
  // Echipa Cristina
  Cristina:   { team: "Cristina", password: "piatra34",      color: "#FF69B4" },
  Florin:     { team: "Cristina", password: "mar07",         color: "#1E90FF" },
  Larisa:     { team: "Cristina", password: "larisaPass",    color: "#20B2AA" },
  Voicu:      { team: "Cristina", password: "cerul22",       color: "#3498DB" },
  Sorina:     { team: "Cristina", password: "carte19",       color: "#E67E22" },
  Adriana:    { team: "Cristina", password: "nor05",         color: "#2ECC71" },
  Dida:       { team: "Cristina", password: "nuc08",         color: "#A569BD" },
  // Echipa Scarlat
  Scarlat:    { team: "Scarlat",  password: "munte17",       color: "#2C3E50" },
  Mihaela:    { team: "Scarlat",  password: "ploaie14",      color: "#C0392B" },
  Andrei:     { team: "Scarlat",  password: "luna30",        color: "#7F8C8D" },
  Niki:       { team: "Scarlat",  password: "frunza09",      color: "#16A085" },
  George:     { team: "Scarlat",  password: "georgePass",    color: "#8E44AD" },
  // Admin user
  Alin:       { team: "Admin",    password: "sefulabani",    color: "#000000" }
};

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Get all agent names for dropdown
  const agentNames = Object.keys(agentsData);
  
  // Login function
  const login = (agentName, password) => {
    const agent = agentsData[agentName];
    
    if (!agent) {
      return { success: false, message: "Agent negăsit" };
    }
    
    if (agent.password !== password) {
      return { success: false, message: "Parolă incorectă" };
    }
    
    // Login successful
    setCurrentUser({
      name: agentName,
      ...agent
    });
    
    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify({
      name: agentName,
      ...agent
    }));
    
    return { success: true };
  };
  
  // Logout function
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };
  
  // Check if user is already logged in on app load
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    setLoading(false);
  }, []);
  
  const value = {
    currentUser,
    agentNames,
    agentsData,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 