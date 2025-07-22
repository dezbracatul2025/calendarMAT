import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';

const TeamBuildingContext = createContext();
const COLLECTION_NAME = 'teambuilding_contributions';

const KNOWN_PARTICIPANTS = [
  'Claudiu', 'Voicu', 'Cosmina', 'Cristina', 'Andreea', 'George', 'Florin', 
  'Mihaela', 'Scarlat', 'Catalina', 'Adriana', 'Andrei', 'Niki', 
  'Valentina P', 'Alin M'
];

export function useTeamBuilding() {
  return useContext(TeamBuildingContext);
}

export function TeamBuildingProvider({ children }) {
  const [contributions, setContributions] = useState(() => {
    const saved = localStorage.getItem('teamBuildingContributions');
    const initialContributions = {};
    KNOWN_PARTICIPANTS.forEach(name => {
      initialContributions[name] = 0;
    });
    return saved ? { ...initialContributions, ...JSON.parse(saved) } : initialContributions;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    const collRef = collection(db, COLLECTION_NAME);
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const fetchedContributions = {};
      snapshot.forEach(docSnap => {
        if (KNOWN_PARTICIPANTS.includes(docSnap.id)) {
          fetchedContributions[docSnap.id] = docSnap.data().amount || 0;
        }
      });

      const updatedContributions = { ...contributions };
      KNOWN_PARTICIPANTS.forEach(name => {
        updatedContributions[name] = fetchedContributions[name] || contributions[name] || 0;
      });
      
      setContributions(prev => ({ ...prev, ...updatedContributions }));
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error listening to TeamBuilding contributions in Context:", err);
      setError("Eroare la sincronizarea datelor TeamBuilding.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('teamBuildingContributions', JSON.stringify(contributions));
  }, [contributions]);

  const addToTeamBuilding = async (agentName, amount) => {
    if (!KNOWN_PARTICIPANTS.includes(agentName)) {
      console.warn(`Attempted to add contribution to unknown participant: ${agentName}`);
      return;
    }

    setContributions(prev => ({
      ...prev,
      [agentName]: (prev[agentName] || 0) + amount
    }));

    const docRef = doc(db, COLLECTION_NAME, agentName);
    try {
      await setDoc(docRef, { amount: increment(amount) }, { merge: true });
      console.log(`Context: Successfully updated Firestore for ${agentName} by ${amount}`);
    } catch (err) {
      console.error(`Context: Error updating Firestore for ${agentName}: `, err);
      setError("Eroare la salvarea contribuției în baza de date.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const clearTeamBuilding = async () => {
    const batch = writeBatch(db);
    KNOWN_PARTICIPANTS.forEach(name => {
      const docRef = doc(db, COLLECTION_NAME, name);
      batch.delete(docRef);
    });

    try {
      await batch.commit();
      console.log('Context: Successfully cleared all TeamBuilding contributions.');
      setContributions({}); // Clear local state
      localStorage.removeItem('teamBuildingContributions');
    } catch (err) {
      console.error('Context: Error clearing TeamBuilding contributions:', err);
      setError('Eroare la ștergerea contribuțiilor TeamBuilding.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Force clear all TeamBuilding data immediately
  const forceClearTeamBuilding = async () => {
    try {
      // Clear from Firebase
      const batch = writeBatch(db);
      KNOWN_PARTICIPANTS.forEach(name => {
        const docRef = doc(db, COLLECTION_NAME, name);
        batch.delete(docRef);
      });
      await batch.commit();
      
      // Clear from localStorage
      localStorage.removeItem('teamBuildingContributions');
      
      // Clear from state
      setContributions({});
      
      console.log('Force cleared all TeamBuilding data');
      return true;
    } catch (error) {
      console.error('Error force clearing TeamBuilding:', error);
      return false;
    }
  };

  const value = {
    contributions,
    addToTeamBuilding,
    isLoading,
    error,
    clearTeamBuilding,
    forceClearTeamBuilding
  };

  return (
    <TeamBuildingContext.Provider value={value}>
      {children}
    </TeamBuildingContext.Provider>
  );
} 