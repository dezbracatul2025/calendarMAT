import { db } from '../firebase';
// Import auth as well
import { auth } from '../firebase'; 
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
  where,
  documentId,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { formatDateForId } from './calendarUtils';

// Helper to get the collection reference for a specific team
const getTeamAppointmentsRef = (teamName) => {
  if (!teamName) {
    console.error("getTeamAppointmentsRef called without teamName");
    return null; // Or throw an error
  }
  // Path used: teams/{teamName}/appointments
  return collection(db, `teams/${teamName}/appointments`); 
};

// Helper to get the document reference for a specific date within a team
const getTeamDateDocRef = (teamName, date) => {
  if (!teamName) {
    console.error("getTeamDateDocRef called without teamName");
    return null;
  }
  const dateFormatted = formatDateForId(date);
  // Path used: teams/{teamName}/appointments/{dateFormatted}
  return doc(db, `teams/${teamName}/appointments/${dateFormatted}`); 
};

// *** NOTE: getAppointmentsByDate and getAllAppointments use a different path ('appointments') ***
// *** This might need adjustment if these functions are used elsewhere ***

// Get appointments for a specific date (Uses 'appointments' collection - MIGHT BE WRONG PATH)
export const getAppointmentsByDate = async (date) => {
  const dateFormatted = formatDateForId(date);
  // Uses 'appointments' - check if this is intended
  const dateDocRef = doc(db, 'appointments', dateFormatted); 
  
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

// Get all appointments (Uses 'appointments' collection - MIGHT BE WRONG PATH)
export const getAllAppointments = async () => {
  try {
    // Uses 'appointments' - check if this is intended
    const querySnapshot = await getDocs(collection(db, 'appointments')); 
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

// Make an appointment for a specific agent IN A SPECIFIC TARGET TEAM/CALENDAR
// Add optional selectedAgent, clientName, and selectedAgentColor parameters
export const makeAppointment = async (
  date, 
  time, 
  agentData, 
  targetTeamName, 
  selectedAgent = undefined, 
  clientName = undefined, 
  selectedAgentColor = undefined // Add the new color parameter
) => {
  // Validate targetTeamName
  if (!targetTeamName) {
    console.error("makeAppointment: Missing target team name");
    return false;
  }
  // Use the provided targetTeamName to get the reference
  const dateDocRef = getTeamDateDocRef(targetTeamName, date); 
  if (!dateDocRef) return false;

  // Agent data is still needed for storing who made the appointment
  if (!agentData) { 
    console.error("makeAppointment: Missing agent data");
    return false;
  }

  const slotId = `${time}`; 

  console.log('Attempting to make appointment. Agent Data:', agentData, 'Target Calendar:', targetTeamName);
  console.log('Current Auth User UID:', auth.currentUser?.uid);

  try {
    const docSnap = await getDoc(dateDocRef);
    const currentData = docSnap.exists() ? docSnap.data() : {};
    
    if (currentData[slotId]) {
      // Folosim targetTeamName în mesajul de avertizare
      console.warn(`Slot ${time} on ${formatDateForId(date)} already booked for target ${targetTeamName}`); 
      return false; 
    }

    // --- Prepare the appointment data --- 
    const appointmentData = {
      agentName: agentData.name, // Always store the name of the user making the booking
      // Use selectedAgentColor if provided (from Catalina's form), otherwise use the booking agent's color
      color: selectedAgentColor !== undefined ? selectedAgentColor : agentData.color, 
      time,
      createdAt: serverTimestamp() // Add createdAt timestamp
    };

    // Add selectedAgent and clientName if provided (from Catalina's form)
    if (selectedAgent !== undefined) {
      appointmentData.selectedAgent = selectedAgent;
    }
    if (clientName !== undefined) {
      appointmentData.clientName = clientName;
    }
    // --- End Prepare --- 

    await setDoc(dateDocRef, {
      ...currentData,
      [slotId]: appointmentData // Use the prepared appointmentData object
    }, { merge: true }); 
    
    // Folosim targetTeamName în mesajul de succes
    console.log(`Appointment made for ${agentData.name} in target ${targetTeamName} on ${formatDateForId(date)} at ${time}`);
    return true;
  } catch (error) {
    // Folosim targetTeamName în mesajul de eroare
    console.error(`Error making appointment for target ${targetTeamName} (${formatDateForId(date)} ${time}):`, error); 
    return false;
  }
};

// Cancel an appointment IN A SPECIFIC TARGET TEAM/CALENDAR
export const cancelAppointment = async (date, time, targetTeamName) => {
  // Validate targetTeamName
  if (!targetTeamName) {
    console.error("cancelAppointment: Missing target team name");
    return false;
  }
  // Use the provided targetTeamName to get the reference
  const dateDocRef = getTeamDateDocRef(targetTeamName, date);
   if (!dateDocRef) return false;

  const slotId = `${time}`;
  
  try {
    const docSnap = await getDoc(dateDocRef);
    
    if (!docSnap.exists()) {
       // Folosim targetTeamName în mesajul de avertizare
       console.warn(`Cannot cancel: No document found for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false;
    }
    
    const currentData = docSnap.data();
    
    if (!currentData[slotId]) {
       // Folosim targetTeamName în mesajul de avertizare
       console.warn(`Cannot cancel: Slot ${time} not found in document for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false; 
    }
    
    const { [slotId]: removed, ...updatedData } = currentData;
    
    if (Object.keys(updatedData).length === 0) {
      // Folosim targetTeamName în mesaj
      console.log(`Deleting empty document for target ${targetTeamName} on date ${formatDateForId(date)}`);
      await deleteDoc(dateDocRef);
    } else {
      // Folosim targetTeamName în mesaj
      console.log(`Canceling appointment for target ${targetTeamName} on date ${formatDateForId(date)} at ${time}`);
      await setDoc(dateDocRef, updatedData); 
    }
    
    return true;
  } catch (error) {
    // Folosim targetTeamName în mesajul de eroare
    console.error(`Error canceling appointment for target ${targetTeamName}:`, error);
    return false;
  }
};

// Confirm an appointment IN A SPECIFIC TARGET TEAM/CALENDAR
export const confirmAppointment = async (date, time, targetTeamName) => {
  // Validate targetTeamName
  if (!targetTeamName) {
    console.error("confirmAppointment: Missing target team name");
    return false;
  }
  // Use the provided targetTeamName to get the reference
  const dateDocRef = getTeamDateDocRef(targetTeamName, date);
   if (!dateDocRef) return false;

  const slotId = `${time}`;
  
  try {
    const docSnap = await getDoc(dateDocRef);
    
    if (!docSnap.exists()) {
       console.warn(`Cannot confirm: No document found for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false;
    }
    
    const currentData = docSnap.data();
    
    if (!currentData[slotId]) {
       console.warn(`Cannot confirm: Slot ${time} not found in document for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false; 
    }

    // Check if already confirmed
    if (currentData[slotId].isConfirmed) {
      console.log(`Appointment already confirmed for target ${targetTeamName} on date ${formatDateForId(date)} at ${time}`);
      return true; // Or false if we want to signal no change was made
    }
    
    // Update the specific slot data to include isConfirmed: true
    const updatedSlotData = { 
        ...currentData[slotId], 
        isConfirmed: true 
    };

    await updateDoc(dateDocRef, {
        [slotId]: updatedSlotData
    });
    
    console.log(`Appointment confirmed for target ${targetTeamName} on date ${formatDateForId(date)} at ${time}`);
    return true;

  } catch (error) {
    console.error(`Error confirming appointment for target ${targetTeamName}:`, error);
    return false;
  }
};

// Deconfirm an appointment IN A SPECIFIC TARGET TEAM/CALENDAR
export const deconfirmAppointment = async (date, time, targetTeamName) => {
  // Validate targetTeamName
  if (!targetTeamName) {
    console.error("deconfirmAppointment: Missing target team name");
    return false;
  }
  const dateDocRef = getTeamDateDocRef(targetTeamName, date);
   if (!dateDocRef) return false;

  const slotId = `${time}`;
  
  try {
    const docSnap = await getDoc(dateDocRef);
    if (!docSnap.exists()) {
       console.warn(`Cannot deconfirm: No document found for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false;
    }
    
    const currentData = docSnap.data();
    if (!currentData[slotId]) {
       console.warn(`Cannot deconfirm: Slot ${time} not found in document for target ${targetTeamName} on date ${formatDateForId(date)}`);
      return false; 
    }

    // Check if it's actually confirmed before trying to deconfirm
    if (!currentData[slotId].isConfirmed) {
      console.log(`Appointment was not confirmed for target ${targetTeamName} on date ${formatDateForId(date)} at ${time}`);
      return true; // Or false?
    }
    
    // Update the specific slot data to remove or set isConfirmed: false
    // Option 1: Set to false
    const updatedSlotData = { 
        ...currentData[slotId], 
        isConfirmed: false 
    };
    // Option 2: Remove the field (requires FieldValue.delete() - more complex import)
    // For simplicity, let's set it to false.

    await updateDoc(dateDocRef, {
        [slotId]: updatedSlotData
    });
    
    console.log(`Appointment DEconfirmed for target ${targetTeamName} on date ${formatDateForId(date)} at ${time}`);
    return true;

  } catch (error) {
    console.error(`Error deconfirming appointment for target ${targetTeamName}:`, error);
    return false;
  }
};

// Set up real-time listener for appointments *for a specific team*
export const subscribeToTeamAppointments = (teamName, callback) => {
  const teamAppointmentsRef = getTeamAppointmentsRef(teamName); 
  if (!teamAppointmentsRef) {
    return () => {}; 
  }

  console.log(`Subscribing to appointments for team: ${teamName}`);
  const q = query(teamAppointmentsRef); 

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const appointments = {};
    snapshot.forEach((doc) => {
      appointments[doc.id] = doc.data();
    });
    callback(teamName, appointments);
  }, (error) => {
    console.error(`Error subscribing to appointments for team ${teamName}:`, error);
  });
  
  return unsubscribe;
};


// Function to delete appointments older than a certain date for a specific team
export const deleteOldAppointmentsForTeam = async (teamName, cutoffDateString) => {
  const teamAppointmentsRef = getTeamAppointmentsRef(teamName); 
  if (!teamAppointmentsRef) return 0;

  console.log(`Deleting appointments for team ${teamName} older than ${cutoffDateString}`);
  
  const q = query(teamAppointmentsRef, where(documentId(), '<', cutoffDateString)); 

  let deletedCount = 0;
  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log(`No old appointments found for team ${teamName}.`);
      return 0;
    }

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

// Add createdAt timestamp to existing appointments (migration function)
export const addTimestampToExistingAppointments = async (teamName) => {
  if (!teamName) {
    console.error("addTimestampToExistingAppointments: Missing team name");
    return false;
  }

  try {
    const teamAppointmentsRef = getTeamAppointmentsRef(teamName);
    const querySnapshot = await getDocs(teamAppointmentsRef);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    querySnapshot.forEach((dateDoc) => {
      const dateData = dateDoc.data();
      let hasChanges = false;
      const updatedData = {};

      // Check each time slot in the date document
      Object.keys(dateData).forEach((timeSlot) => {
        const appointment = dateData[timeSlot];
        
        // Only add timestamp if it doesn't already exist
        if (appointment && !appointment.createdAt) {
          updatedData[timeSlot] = {
            ...appointment,
            createdAt: serverTimestamp()
          };
          hasChanges = true;
        }
      });

      // If we have changes, add to batch
      if (hasChanges) {
        batch.update(dateDoc.ref, updatedData);
        updatedCount++;
      }
    });

    // Commit all changes
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Updated ${updatedCount} date documents for team ${teamName} with timestamps`);
    } else {
      console.log(`No appointments found without timestamps for team ${teamName}`);
    }

    return true;
  } catch (error) {
    console.error(`Error adding timestamps to existing appointments for team ${teamName}:`, error);
    return false;
  }
};

// Add timestamps to all existing appointments across all teams
export const migrateAllExistingAppointments = async () => {
  const teams = ['Andreea', 'Cristina', 'Scarlat', 'SHARED_CREDIT'];
  
  try {
    for (const team of teams) {
      console.log(`Migrating timestamps for team: ${team}`);
      await addTimestampToExistingAppointments(team);
    }
    console.log('Migration completed for all teams');
    return true;
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
};

// Helper function to format timestamp for display
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Timestamp necunoscut';
  
  try {
    // If it's a Firestore timestamp
    if (timestamp.toDate) {
      const date = timestamp.toDate();
      return date.toLocaleString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    // If it's a regular Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    // If it's a number (milliseconds)
    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return date.toLocaleString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    return 'Format timestamp necunoscut';
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Eroare formatare timestamp';
  }
};

// Function to get appointment details with formatted timestamp
export const getAppointmentWithTimestamp = (appointment) => {
  if (!appointment) return null;
  
  return {
    ...appointment,
    formattedCreatedAt: appointment.createdAt ? formatTimestamp(appointment.createdAt) : 'Timestamp necunoscut'
  };
};