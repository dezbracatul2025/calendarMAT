import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase'; // Assuming firebase.js is correctly set up
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  writeBatch,
  where,
  Timestamp, // For querying dates
  orderBy, // For potentially ordering history
  getDocs
} from 'firebase/firestore';

const DebtsContext = createContext();

const DEBTS_COLLECTION = 'agent_debts'; // Firestore collection for current debt amounts
const DEBTS_HISTORY_COLLECTION = 'debt_history'; // Firestore collection for history logs

export function useDebts() {
  return useContext(DebtsContext);
}

export function DebtsProvider({ children }) {
  const [debts, setDebts] = useState({}); // Initialize as empty object
  const [history, setHistory] = useState([]); // Initialize as empty array
  const [isLoadingDebts, setIsLoadingDebts] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Effect to subscribe to debts from Firestore
  useEffect(() => {
    setIsLoadingDebts(true);
    const q = query(collection(db, DEBTS_COLLECTION));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const debtsData = {};
      querySnapshot.forEach((doc) => {
        // Assuming each document ID is the agent's name
        // and contains a field like 'currentDebtAmount'
        debtsData[doc.id] = doc.data().currentDebtAmount || 0;
      });
      setDebts(debtsData);
      setIsLoadingDebts(false);
    }, (error) => {
      console.error("Error fetching debts from Firestore: ", error);
      setIsLoadingDebts(false);
      // Handle error appropriately, maybe set an error state
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  // Effect to subscribe to history from Firestore (optional, but good for consistency)
  // For now, cleanOldHistory will handle fetching and deleting, then we might need to refresh.
  // Let's simplify and load history once and then manage cleanOldHistory.
  // A full real-time sync for history might be overkill if only cleanOldHistory modifies it.
  // We will adapt cleanOldHistory to work with Firestore.

  // Adaugă datorie - To be refactored for Firestore
  const addDebt = async (agentName, amount, addedBy) => {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("Invalid amount for addDebt:", amount);
      return;
    }

    const agentDebtRef = doc(db, DEBTS_COLLECTION, agentName);
    const historyRef = doc(collection(db, DEBTS_HISTORY_COLLECTION)); // Auto-generate ID for history

    try {
      const batch = writeBatch(db);

      // Update or set debt amount
      batch.set(agentDebtRef, { currentDebtAmount: increment(numericAmount) }, { merge: true });
      
      // Add to history
      batch.set(historyRef, {
        agent: agentName,
        amount: numericAmount,
        type: 'add',
        date: serverTimestamp(), // Use server timestamp
        addedBy
      });

      await batch.commit();
      console.log(`Debt added for ${agentName} and history logged.`);
      // No need to setDebts or setHistory, onSnapshot will handle it if listening
      // If not listening for history, we might need to re-fetch or update manually after cleaning
    } catch (error) {
      console.error("Error adding debt or logging history: ", error);
    }
  };

  // Procesează plata - To be refactored for Firestore
  const processPayment = async (agentName, amount, approvedBy) => {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("Invalid amount for processPayment:", amount);
      return;
    }

    const agentDebtRef = doc(db, DEBTS_COLLECTION, agentName);
    const historyRef = doc(collection(db, DEBTS_HISTORY_COLLECTION));

    try {
      const batch = writeBatch(db);

      // Ensure debt doesn't go below zero; ideally, UI should prevent this too
      // For safety, one might read the doc first, but increment handles atomicity.
      // Firestore increment won't create a doc if it doesn't exist, so debt doc should exist.
      batch.update(agentDebtRef, { currentDebtAmount: increment(-numericAmount) });

      batch.set(historyRef, {
        agent: agentName,
        amount: numericAmount,
        type: 'payment',
        date: serverTimestamp(),
        approvedBy
      });

      await batch.commit();
      console.log(`Payment processed for ${agentName} and history logged.`);
    } catch (error) {
      console.error("Error processing payment or logging history: ", error);
      // Consider how to handle if agent's debt doc doesn't exist - UI should ensure only existing debtors can be paid
    }
  };

  // Șterge istoricul mai vechi de 7 zile - To be refactored for Firestore
  const cleanOldHistory = async () => {
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgoDate);

    const oldHistoryQuery = query(
      collection(db, DEBTS_HISTORY_COLLECTION),
      where("date", "<=", sevenDaysAgoTimestamp)
    );

    try {
      const querySnapshot = await getDocs(oldHistoryQuery); // Need to import getDocs
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`${querySnapshot.size} old history entries deleted.`);
      // After deleting, if history state needs to be accurate, re-fetch or filter local state.
      // For now, DebtsWidget doesn't display history directly, so this is okay.
      // If history is displayed, a Firestore listener for history would be better.
    } catch (error) {
      console.error("Error cleaning old history: ", error);
    }
  };
  
  const value = {
    debts,
    history, // This history state is not currently synced from Firestore after initial load / cleaning.
    addDebt,
    processPayment,
    cleanOldHistory,
    isLoadingDebts,
    // isLoadingHistory // Not fully implemented with listener yet
  };

  return (
    <DebtsContext.Provider value={value}>
      {children}
    </DebtsContext.Provider>
  );
} 