import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot,
  query,
  writeBatch,
  where
} from 'firebase/firestore';
import { formatDateForId } from './calendarUtils';

const APPOINTMENTS_COLLECTION = 'appointments';

// Helper to get the collection reference for a specific team
const getTeamAppointmentsRef = (teamName) => {
  if (!teamName) {
    console.error("getTeamAppointmentsRef called without teamName");
    return null; // Or throw an error
  }
  return collection(db, `teams/${teamName}/appointments`);
};

// Helper to get the document reference for a specific date within a team
const getTeamDateDocRef = (teamName, date) => {
  if (!teamName) {
    console.error("getTeamDateDocRef called without teamName");
    return null;
  }
  const dateFormatted = formatDateForId(date);
  return doc(db, `teams/${teamName}/appointments/${dateFormatted}`);
};

// Get appointments for a specific date
export const getAppointmentsByDate = async (date) => {
  const dateFormatted = formatDateForId(date);
  const dateDocRef = doc(db, APPOINTMENTS_COLLECTION, dateFormatted);
  
  try {
    const docSnap = await getDoc(dateDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {};
  } catch (error) {
    console.error("Error getting appointments:", error);
    return {};
  }
};

// Get all appointments (for 3 weeks)
export const getAllAppointments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, APPOINTMENTS_COLLECTION));
    const appointments = {};
    
    querySnapshot.forEach((doc) => {
      appointments[doc.id] = doc.data();
    });
    
    return appointments;
  } catch (error) {
    console.error("Error getting all appointments:", error);
    return {};
  }
};

// Make an appointment for a specific agent (uses agent's team)
export const makeAppointment = async (date, time, agentData) => {
  if (!agentData || !agentData.team) {
    console.error("makeAppointment: Missing agent data or team");
    return false;
  }
  const teamName = agentData.team;
  const dateDocRef = getTeamDateDocRef(teamName, date);
  if (!dateDocRef) return false;

  const slotId = `${time}`; 

  try {
    const docSnap = await getDoc(dateDocRef);
    const currentData = docSnap.exists() ? docSnap.data() : {};
    
    // Check if slot is already booked *within this team's document*
    if (currentData[slotId]) {
      console.warn(`Slot ${time} on ${formatDateForId(date)} already booked for team ${teamName}`);
      // Optionally, return a specific status or false
      // Depending on how Calendar.js handles this, this might not even be reachable
      // if the UI prevents clicking already booked slots for the team.
      return false; 
    }

    await setDoc(dateDocRef, {
      ...currentData,
      [slotId]: {
        agentName: agentData.name,
        // No need to store team here, it's implied by the document path
        color: agentData.color,
        time
      }
    }, { merge: true }); // Use merge: true to be safe, though setDoc with spread should work
    
    console.log(`Appointment made for ${agentData.name} in team ${teamName} on ${formatDateForId(date)} at ${time}`);
    return true;
  } catch (error) {
    console.error(`Error making appointment for team ${teamName}:`, error);
    return false;
  }
};

// Cancel an appointment for a specific agent (uses agent's team)
export const cancelAppointment = async (date, time, agentTeam) => {
  if (!agentTeam) {
    console.error("cancelAppointment: Missing agent team");
    return false;
  }
  const dateDocRef = getTeamDateDocRef(agentTeam, date);
   if (!dateDocRef) return false;

  const slotId = `${time}`;
  
  try {
    const docSnap = await getDoc(dateDocRef);
    
    if (!docSnap.exists()) {
       console.warn(`Cannot cancel: No document found for team ${agentTeam} on date ${formatDateForId(date)}`);
      return false;
    }
    
    const currentData = docSnap.data();
    
    if (!currentData[slotId]) {
       console.warn(`Cannot cancel: Slot ${time} not found in document for team ${agentTeam} on date ${formatDateForId(date)}`);
      return false; // Slot doesn't exist in this team's doc
    }
    
    // Create a new object without the slot to delete
    const { [slotId]: removed, ...updatedData } = currentData;
    
    if (Object.keys(updatedData).length === 0) {
      // If this was the last appointment for this date/team, delete the document
      console.log(`Deleting empty document for team ${agentTeam} on date ${formatDateForId(date)}`);
      await deleteDoc(dateDocRef);
    } else {
      // Otherwise update the document without this slot
      console.log(`Canceling appointment for team ${agentTeam} on date ${formatDateForId(date)} at ${time}`);
      await setDoc(dateDocRef, updatedData); // Overwrite with data excluding the cancelled slot
    }
    
    return true;
  } catch (error) {
    console.error(`Error canceling appointment for team ${agentTeam}:`, error);
    return false;
  }
};

// Set up real-time listener for appointments *for a specific team*
export const subscribeToTeamAppointments = (teamName, callback) => {
  const teamAppointmentsRef = getTeamAppointmentsRef(teamName);
  if (!teamAppointmentsRef) {
    return () => {}; // Return a no-op unsubscribe function
  }

  console.log(`Subscribing to appointments for team: ${teamName}`);
  const q = query(teamAppointmentsRef); // Add queries here if needed later (e.g., date range)

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const appointments = {};
    snapshot.forEach((doc) => {
      // Store appointments keyed by date (doc.id)
      appointments[doc.id] = doc.data();
    });
    // Pass the team's appointments and the team name back to the callback
    callback(teamName, appointments);
  }, (error) => {
    console.error(`Error subscribing to appointments for team ${teamName}:`, error);
  });
  
  // Return the unsubscribe function
  return unsubscribe;
};

// NOTE: getAllAppointments and getAppointmentsByDate might need adjustment
// depending on how Alin's view is implemented in Calendar.js.
// For now, we assume Calendar.js will handle fetching/subscribing per team.

// Function to delete appointments older than a certain date for a specific team
// This might be used by a Cloud Function later
export const deleteOldAppointmentsForTeam = async (teamName, cutoffDateString) => {
  const teamAppointmentsRef = getTeamAppointmentsRef(teamName);
  if (!teamAppointmentsRef) return 0;

  console.log(`Deleting appointments for team ${teamName} older than ${cutoffDateString}`);
  
  const q = query(teamAppointmentsRef, where(documentId(), '<', cutoffDateString)); 
  // Assuming documentId() works directly with YYYY-MM-DD format for comparison
  // If not, might need to fetch all docs and filter manually or use a timestamp field

  let deletedCount = 0;
  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log(`No old appointments found for team ${teamName}.`);
      return 0;
    }

    // Use batch writes for efficiency if deleting many documents
    const batch = writeBatch(db);
    snapshot.forEach(doc => {
      console.log(`  - Deleting doc: ${doc.id} for team ${teamName}`);
      batch.delete(doc.ref);
      deletedCount++;
    });
    await batch.commit();
    console.log(`Successfully deleted ${deletedCount} old appointment documents for team ${teamName}.`);
    return deletedCount;
  } catch (error) {
    console.error(`Error deleting old appointments for team ${teamName}:`, error);
    return -1; // Indicate error
  }
}; 