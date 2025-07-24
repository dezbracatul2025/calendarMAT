import React, { createContext, useState, useContext, useEffect } from 'react';

// Agent data with passwords and colors
const agentsData = {
  // Echipa Andreea
  Andreea:    { team: "Andreea",  password: "motivatie25",   color: "#FFA500" },
  Claudiu:    { team: "Andreea",  password: "perseverenta25",color: "#0CB6EF" },
  Cosmina:    { team: "Andreea",  password: "ambitie25",     color: "#FFC107" },
  Monica:     { team: "Andreea",  password: "floare12",      color: "#8E44AD" },
  Valentina:  { team: "Andreea",  password: "soare27",       color: "#F39C12" },
  // Echipa Cristina
  Cristina:   { team: "Cristina", password: "antipatica",      color: "#FF69B4" },
  Florin:     { team: "Cristina", password: "mar07",         color: "#2ECC71" },
  Larisa:     { team: "Cristina", password: "iqos",    color: "#20B2AA" },
  Voicu:      { team: "Cristina", password: "culturist",       color: "#fb8500" },
  Dida:       { team: "Cristina", password: "superb",         color: "#A569BD" },
  "Valentina P": { team: "Cristina", password: "oglinda",       color: "#60a5fa" },
  Luca:       { team: "Cristina", password: "colac20",         color: "#1E3A8A" },
  // Echipa Scarlat
  Scarlat:    { team: "Scarlat",  password: "neymar",       color: "#2C3E50" },
  Mihaela:    { team: "Scarlat",  password: "caine",      color: "#C0392B" },
  Andrei:     { team: "Scarlat",  password: "scoala",        color: "#7F8C8D" },
  Niki:       { team: "Scarlat",  password: "hamilton",      color: "#16A085" },
  George:     { team: "Scarlat",  password: "grasu",    color: "#8E44AD" },
  "Alin M":   { team: "Scarlat",  password: "carte55",     color: "#FFD700" },
  // radiere bc boss
  Catalina:   { team: "SHARED_CREDIT", password: "neatamas", color: "#FA2A2A" },
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
  
  // Get all agent names for dropdown and sort them alphabetically
  const agentNames = Object.keys(agentsData).sort();
  
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