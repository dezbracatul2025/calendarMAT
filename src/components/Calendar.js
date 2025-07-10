import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import moment from 'moment'; // Import moment
// Import Romanian locale for moment
import 'moment/locale/ro'; 
import {
  getCurrentWeekStart,
  generateWeekDates,
  generateTimeSlots,
  formatDateForId,
  countNextDayAppointments
} from '../utils/calendarUtils';
import {
  subscribeToTeamAppointments,
  makeAppointment,
  cancelAppointment,
  confirmAppointment,
  deconfirmAppointment
} from '../utils/appointmentService';
// Import Firestore functions directly for simplicity here
import { db } from '../firebase'; 
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore'; 
import './Calendar.css';
import TeamBuildingWidget from './TeamBuildingWidget'; // <<< Import the new component
import SpeechGeneratorPopup from './SpeechGeneratorPopup'; // <<< Import new component
import NextAppointmentWidget from './NextAppointmentWidget'; // <<< Import new widget
import DebtsWidget from './DebtsWidget';

// Set moment locale globally for this component/app part
moment.locale('ro');

// Original teams + the identifier for the shared calendar
const ALL_TEAMS = ['Andreea', 'Cristina', 'Scarlat'];
const SHARED_CALENDAR_ID = 'SHARED_CREDIT'; 
const SHARED_CALENDAR_NAME = 'Stergere birou de credit';

// --- Agent de Serviciu Config ---
const AGENT_SERVICIU_ID = 'AGENT_SERVICIU';
const AGENT_SERVICIU_NAME = 'Diverse';
const SERVICE_AGENTS = [ // Specified list used for rotation, NOT for the dropdown
  "Scarlat", "Cristina", "Dida", "Mihaela", "Catalina", "George", 
  "Andreea", "Cosmina", "Florin", "Valentina P", "Larisa", "Voicu"
]; // Removed .sort() to keep specific order

const ASSIGNMENTS_COLLECTION = 'dailyAssignments';
const ROTATION_START_DATE = moment('2024-01-01'); // Fixed start date for rotation
const PAUSE_COLLECTION = 'rotationPause'; // Collection for pause state
// --- End Config ---

// Combine all IDs for easier iteration
const ALL_CALENDAR_IDS = [...ALL_TEAMS, SHARED_CALENDAR_ID];
const ALL_VIEW_IDS = [...ALL_CALENDAR_IDS, AGENT_SERVICIU_ID]; 

// --- Helper Functions for Agent de Serviciu --- 

// Format date for Firestore IDs
const formatDateId = (date) => moment(date).format('YYYY-MM-DD');

// Get Firestore document reference for a specific date's assignment
const getAssignmentDocRef = (date) => {
  const dateId = formatDateId(date);
  return doc(db, ASSIGNMENTS_COLLECTION, dateId);
};

// Set/Update assignment in Firestore
const setDailyAssignment = async (date, agentName) => {
  if (!date || !agentName) return false;
  const docRef = getAssignmentDocRef(date);
  const assignmentData = { assignedAgent: agentName, date: formatDateId(date) };
  try {
    await setDoc(docRef, assignmentData); 
    console.log(`Assignment set for ${formatDateId(date)}: ${agentName}`);
    return true;
  } catch (error) {
    console.error(`Error setting assignment for ${formatDateId(date)}:`, error);
    return false;
  }
};

// Subscribe to assignment changes for a date
const subscribeToDailyAssignment = (date, callback) => {
  const docRef = getAssignmentDocRef(date);
  console.log(`Subscribing to daily assignment for ${formatDateId(date)}`);
  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    callback(docSnap.exists() ? docSnap.data() : null);
  }, (error) => {
    console.error(`Error subscribing to daily assignment:`, error);
    callback(null); 
  });
  return unsubscribe;
};

// Get pause document reference
const getPauseDocRef = () => {
  return doc(db, PAUSE_COLLECTION, 'pauseState');
};

// Set/Update pause state in Firestore
const setRotationPause = async (isPaused) => {
  const docRef = getPauseDocRef();
  const pauseData = { isPaused, lastUpdated: moment().toISOString() };
  try {
    await setDoc(docRef, pauseData); 
    console.log(`Rotation pause set to: ${isPaused}`);
    return true;
  } catch (error) {
    console.error(`Error setting rotation pause:`, error);
    return false;
  }
};

// Subscribe to pause state changes
const subscribeToRotationPause = (callback) => {
  const docRef = getPauseDocRef();
  console.log(`Subscribing to rotation pause state`);
  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    callback(docSnap.exists() ? docSnap.data() : { isPaused: false });
  }, (error) => {
    console.error(`Error subscribing to rotation pause:`, error);
    callback({ isPaused: false }); 
  });
  return unsubscribe;
};

// Calculate default agent based on rotation
const calculateDefaultServiceAgent = (targetDate) => {
  const targetMoment = moment(targetDate);
  if (targetMoment.day() === 0 || targetMoment.day() === 6) return null; // Skip weekends
  if (SERVICE_AGENTS.length === 0) return null;

  let workdayCount = 0;
  let currentDate = moment(ROTATION_START_DATE);
  while (currentDate.isSameOrBefore(targetMoment, 'day')) {
    const dayOfWeek = currentDate.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) workdayCount++;
    if (currentDate.isSame(targetMoment, 'day')) break;
    currentDate.add(1, 'day');
  }

  const agentIndex = (workdayCount - 1) % SERVICE_AGENTS.length;
  return SERVICE_AGENTS[agentIndex];
};

// Find the next working day
const getNextWorkingDay = (startDate) => {
    let nextDay = moment(startDate).add(1, 'day');
    while (nextDay.day() === 0 || nextDay.day() === 6) nextDay.add(1, 'day');
    return nextDay;
};

function Calendar() {
  // Get agentNames and agentsData from useAuth
  const { currentUser, logout, agentNames: ALL_POSSIBLE_AGENTS, agentsData } = useAuth(); 
  const navigate = useNavigate();
  const [currentRealTime, setCurrentRealTime] = useState(moment()); // Store moment object for time
  const [todayDateString, setTodayDateString] = useState(moment().format('YYYY-MM-DD')); // Store current date string
  const [appointmentsData, setAppointmentsData] = useState({});
  const [teamCounts, setTeamCounts] = useState({ Andreea: 0, Cristina: 0, Scarlat: 0 }); // Only original team counts needed
  const [weeks, setWeeks] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [message, setMessage] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [slotToCancel, setSlotToCancel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for active view (calendar or agent service)
  const [activeViewId, setActiveViewId] = useState(null); 
  const [availableViewIds, setAvailableViewIds] = useState([]); 
  
  // State for Agent de Serviciu data
  const [serviceAgent, setServiceAgent] = useState(null); 
  const [serviceAgentDate, setServiceAgentDate] = useState(null); 
  const [isRotationPaused, setIsRotationPaused] = useState(false); 

  // --- State for Catalina's input form ---
  const [activeSlotForInput, setActiveSlotForInput] = useState(null); // { date, time, calendarId }
  const [selectedAgentForSlot, setSelectedAgentForSlot] = useState('');
  const [clientNameForSlot, setClientNameForSlot] = useState('');
  // --- End State ---
  
  const [isSpeechPopupOpen, setIsSpeechPopupOpen] = useState(false);
  const [selectedAppointmentForSpeech, setSelectedAppointmentForSpeech] = useState(null);
  
  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser && !isLoading) {
      navigate('/');
    }
  }, [currentUser, navigate, isLoading]);
  
  // Generate initial time slots (only needs to run once)
  useEffect(() => {
    setTimeSlots(generateTimeSlots());
  }, []);

  // Update clock and check for day change every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = moment();
      setCurrentRealTime(now); // Update the real-time clock state

      const currentDateStr = now.format('YYYY-MM-DD');
      // Check if the day has changed compared to the stored date string
      if (currentDateStr !== todayDateString) {
        console.log(`Day changed from ${todayDateString} to ${currentDateStr}. Updating weeks...`);
        setTodayDateString(currentDateStr); // Update the day state if it changed
      }
    }, 1000);
    
    return () => clearInterval(timer);
  // We intentionally don't include todayDateString here to avoid effect loop,
  // the comparison inside handles the update trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Update displayed weeks *only* when the day (todayDateString) changes
  useEffect(() => {
    // This effect runs initially and whenever todayDateString changes
    console.log("Recalculating weeks for display based on date:", todayDateString);

    const now = moment(); // Get the current moment
    const currentDayOfWeek = now.day(); // 0 = Sunday, 6 = Saturday
    let weekStartForDisplay;

    // Determine the starting Monday for the 3-week display
    const thisMonday = getCurrentWeekStart(); // Get this week's Monday

    if (currentDayOfWeek === 6 || currentDayOfWeek === 0) { // If it's Saturday or Sunday
      // Start the calendar view from the *upcoming* Monday
      weekStartForDisplay = moment(thisMonday).add(1, 'week'); 
      console.log("Weekend detected. Starting calendar view from NEXT Monday:", weekStartForDisplay.format('YYYY-MM-DD'));
    } else {
      // Otherwise (Mon-Fri), start from the current week's Monday
      weekStartForDisplay = thisMonday; // Use the calculated Monday of the current week
      console.log("Weekday detected. Starting calendar view from CURRENT Monday:", weekStartForDisplay.format('YYYY-MM-DD'));
    }

    const generatedWeeks = generateWeekDates(weekStartForDisplay); // Generate 3 weeks from the determined start
    setWeeks(generatedWeeks);
    setIsLoading(false); // Ensure loading is set to false after weeks are set

  }, [todayDateString]); // Depend only on the date string
  
  // Callback to handle updates from subscriptions
  const handleSubscriptionUpdate = useCallback((calendarId, calendarAppointments) => {
    console.log(`Received update for calendar: ${calendarId}`, calendarAppointments);
    setAppointmentsData(prevData => { 
      const updatedData = {
        ...prevData,
        [calendarId]: calendarAppointments
      };
      
      const nextDayCounts = countNextDayAppointments(updatedData);
      const displayCounts = ALL_TEAMS.reduce((acc, teamName) => {
          acc[teamName] = nextDayCounts[teamName] || 0;
          return acc;
      }, {});
      setTeamCounts(displayCounts); 
      
      return updatedData; 
    });
  }, []); 

  // This useEffect sets up the subscriptions
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setAppointmentsData({}); 
    // Reset counts including the shared one initially (though we only display ALL_TEAMS)
    setTeamCounts({ Andreea: 0, Cristina: 0, Scarlat: 0 }); 

    const unsubscribes = [];
    console.log(`User ${currentUser.name} subscribing to ALL calendars (${ALL_CALENDAR_IDS.join(', ')}) ...`);

    // Subscribe ALL users to ALL calendars (including the shared one)
    ALL_CALENDAR_IDS.forEach(calendarId => {
      const unsubscribe = subscribeToTeamAppointments(calendarId, handleSubscriptionUpdate);
      unsubscribes.push(unsubscribe);
    });

    setIsLoading(false); 

    return () => {
      console.log("Unsubscribing from appointments...");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, handleSubscriptionUpdate]);
  
  // Handle slot click
  const handleSlotClick = async (targetCalendarId, date, time) => {
    if (!currentUser) return; 

    // If another slot is active for input, do nothing until it's confirmed/cancelled
    if (activeSlotForInput) {
        console.log("Another slot is active for input. Please confirm or cancel first.");
        setMessage("Confirmați sau anulați întâi selecția curentă.");
        setTimeout(() => setMessage(''), 3000);
        return;
    }

    const existingAppointment = getTeamAppointment(targetCalendarId, date, time);

    // --- Catalina's Special Logic for SHARED_CALENDAR ---
    if (currentUser.name === 'Catalina' && 
        targetCalendarId === SHARED_CALENDAR_ID &&
        !existingAppointment) 
    {
      console.log(`Catalina clicked on empty shared slot: ${formatDateForId(date)} ${time}. Activating input.`);
      setActiveSlotForInput({ date, time, calendarId: targetCalendarId });
      setSelectedAgentForSlot(''); // Reset fields
      setClientNameForSlot('');
      return; // Stop further execution for this case
    } 
    // --- End Catalina's Special Logic ---

    if (!existingAppointment) {
      // Standard booking logic (for non-Catalina or other calendars)
      if (currentUser.name === 'Claudiu' && 
          targetCalendarId !== currentUser.team && // Not his own team
          targetCalendarId !== SHARED_CALENDAR_ID) // Not the shared calendar
      {
        console.log(`Claudiu read-only attempt blocked for calendar: ${targetCalendarId}`);
        setMessage('Nu puteți rezerva în acest calendar.');
        setTimeout(() => setMessage(''), 3000);
        return; // Prevent booking
      }
      
      console.log(`Booking slot for target ${targetCalendarId} at ${formatDateForId(date)} ${time} by ${currentUser.name}`);
      // Standard booking - pass undefined for extra fields
      const success = await makeAppointment(date, time, currentUser, targetCalendarId, undefined, undefined); 
      if (!success) {
        setMessage('Eroare la crearea programării.');
        setTimeout(() => setMessage(''), 3000);
      }
    } else {
      // Cancellation logic (only own appointments)
      if (existingAppointment.agentName === currentUser.name) {
        console.log(`Initiating cancellation for ${targetCalendarId} slot`);
        setSlotToCancel({ date, time, team: targetCalendarId }); 
        setIsPopupOpen(true);
      } else {
        console.log(`Slot booked by colleague ${existingAppointment.agentName} in ${targetCalendarId}`);
        setMessage('Interval rezervat de un coleg.');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };
  
  // Handle cancel confirmation
  const handleCancelConfirm = async () => {
    // Use the stored 'team' (which is now the targetCalendarId) 
    if (slotToCancel && currentUser) {
      console.log(`Confirming cancellation for slot:`, slotToCancel);
      const success = await cancelAppointment(slotToCancel.date, slotToCancel.time, slotToCancel.team);
      if (!success) {
        setMessage('Eroare la anularea programării.');
        setTimeout(() => setMessage(''), 3000);
      }
      setIsPopupOpen(false);
      setSlotToCancel(null);
    }
  };
  
  // Handle cancel rejection
  const handleCancelReject = () => {
    setIsPopupOpen(false);
    setSlotToCancel(null);
  };
  
  // Get appointment for a specific team/calendar ID
  const getTeamAppointment = useCallback((calendarId, date, time) => {
    const dateFormatted = formatDateId(date);
    if (appointmentsData[calendarId] && 
        appointmentsData[calendarId][dateFormatted] && 
        appointmentsData[calendarId][dateFormatted][time]) {
      return appointmentsData[calendarId][dateFormatted][time];
    }
    return null;
  }, [appointmentsData]);
  
  // Determine which calendar section to show
  const shouldShowTeamSection = (calendarId) => {
    if (!currentUser) return false;
    // Alin sees everything
    if (currentUser.name === 'Alin') return true; 
    // Other agents see their own team AND the shared calendar
    if (calendarId === SHARED_CALENDAR_ID) return true;
    return currentUser.team === calendarId;
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // Determine available views and set initial active view
  useEffect(() => {
    if (currentUser) {
      let viewsToShow = [];
      let initialActive = null;
      
      if (currentUser.name === 'Alin') {
        viewsToShow = ALL_VIEW_IDS; 
        initialActive = ALL_TEAMS[0]; 
      } else if (currentUser.name === 'Claudiu') { // <<< Add specific check for Claudiu
        viewsToShow = ALL_VIEW_IDS; // Claudiu sees all view buttons
        initialActive = currentUser.team; // Start on his team's calendar ('Andreea')
      } else if (currentUser.team === SHARED_CALENDAR_ID) { 
        viewsToShow = [SHARED_CALENDAR_ID, AGENT_SERVICIU_ID]; 
        initialActive = SHARED_CALENDAR_ID;
      } else { // Regular agents
        viewsToShow = [currentUser.team, SHARED_CALENDAR_ID, AGENT_SERVICIU_ID];
        initialActive = currentUser.team; 
      }
      
      setAvailableViewIds(viewsToShow);
      setActiveViewId(initialActive); 
    } else if (!isLoading) { 
         navigate('/');
    }
    // Re-evaluate loading state potentially after fetching service agent data
    // setIsLoading handled within service agent useEffect
  }, [currentUser, isLoading, navigate]);
  
  // --- useEffect for Rotation Pause State ---
  useEffect(() => {
    const unsubscribePause = subscribeToRotationPause((pauseData) => {
      setIsRotationPaused(pauseData.isPaused || false);
    });
    return () => unsubscribePause();
  }, []);
  
  // --- useEffect for Agent de Serviciu --- 
  useEffect(() => {
    const today = moment(); 
    const todayStr = formatDateId(today);
    setServiceAgentDate(today); 

    const currentDayOfWeek = today.day();
    if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
      console.log("Weekend - No agent of service.");
      setServiceAgent('Weekend'); 
      setIsLoading(false); 
      return; 
    }

    // Check if rotation is paused
    if (isRotationPaused) {
      console.log("Rotation is paused - No agent assignment.");
      setServiceAgent('Pauză'); 
      setIsLoading(false); 
      return; 
    }

    setIsLoading(true); 
    const unsubscribe = subscribeToDailyAssignment(today, (assignmentData) => {
      let currentAssignment = null;
      if (assignmentData && assignmentData.assignedAgent) {
        console.log("Found assignment in Firestore:", assignmentData.assignedAgent);
        currentAssignment = assignmentData.assignedAgent;
      } else {
        console.log("No assignment found for today. Calculating default.");
        const defaultAgent = calculateDefaultServiceAgent(today);
        if (defaultAgent) {
          console.log("Default agent calculated:", defaultAgent);
          currentAssignment = defaultAgent;
          setDailyAssignment(today, defaultAgent);
        } else {
          console.log("Could not calculate default agent.");
          currentAssignment = 'N/A'; 
        }
      }
      setServiceAgent(currentAssignment);
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, [todayDateString, isRotationPaused]); // Rerun when day changes or pause state changes
  // --- End Agent de Serviciu useEffect ---

  // --- Handlers for Agent de Serviciu Arrows --- 
  const handlePrevServiceAgent = () => {
    if (!serviceAgent || serviceAgent === 'Weekend' || serviceAgent === 'N/A' || serviceAgent === 'Pauză' || !serviceAgentDate) return;
    const currentIndex = SERVICE_AGENTS.indexOf(serviceAgent);
    if (currentIndex === -1) return; 
    const prevIndex = (currentIndex - 1 + SERVICE_AGENTS.length) % SERVICE_AGENTS.length;
    const prevAgent = SERVICE_AGENTS[prevIndex];
    console.log(`Admin override: Setting agent for ${formatDateId(serviceAgentDate)} to ${prevAgent}`);
    setDailyAssignment(serviceAgentDate, prevAgent);
  };

  const handleNextServiceAgent = () => {
    if (!serviceAgent || serviceAgent === 'Weekend' || serviceAgent === 'N/A' || serviceAgent === 'Pauză' || !serviceAgentDate) return;
    const currentIndex = SERVICE_AGENTS.indexOf(serviceAgent);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % SERVICE_AGENTS.length;
    const nextAgent = SERVICE_AGENTS[nextIndex];
    console.log(`Admin override: Setting agent for ${formatDateId(serviceAgentDate)} to ${nextAgent}`);
    setDailyAssignment(serviceAgentDate, nextAgent);
  };

  // --- Handler for Pause Button ---
  const handleTogglePause = async () => {
    const newPauseState = !isRotationPaused;
    console.log(`Claudiu toggling rotation pause to: ${newPauseState}`);
    const success = await setRotationPause(newPauseState);
    if (!success) {
      console.error('Failed to toggle rotation pause');
    }
  };
  // --- End Handlers ---

  // --- Handlers for Catalina's input form ---
  const handleConfirmCatalinaBooking = async () => {
    if (!activeSlotForInput || !selectedAgentForSlot || !clientNameForSlot.trim()) {
      setMessage('Selectați agentul și introduceți numele clientului.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const { date, time, calendarId } = activeSlotForInput;
    
    // Find the color of the selected agent
    const selectedAgentData = agentsData[selectedAgentForSlot];
    const selectedColor = selectedAgentData ? selectedAgentData.color : currentUser.color; // Fallback to current user's color if not found

    console.log(`Catalina confirming booking for ${calendarId} at ${formatDateForId(date)} ${time}. Agent: ${selectedAgentForSlot}, Client: ${clientNameForSlot}, Color: ${selectedColor}`);
    
    // Call makeAppointment with the extra details including the selected color
    const success = await makeAppointment(
        date, 
        time, 
        currentUser, // Still pass Catalina's data for logging/agentName
        calendarId, 
        selectedAgentForSlot, // The agent selected in the dropdown
        clientNameForSlot.trim(), // The client name
        selectedColor // The color of the selected agent
    );
    
    if (!success) {
      setMessage('Eroare la crearea programării.');
      setTimeout(() => setMessage(''), 3000);
    } else {
        setMessage('Programare creată cu succes!');
        setTimeout(() => setMessage(''), 3000);
    }

    // Reset the input form state regardless of success/failure
    setActiveSlotForInput(null);
    setSelectedAgentForSlot('');
    setClientNameForSlot('');
  };

  const handleCancelCatalinaInput = () => {
    console.log("Catalina cancelled input.");
    setActiveSlotForInput(null);
    setSelectedAgentForSlot('');
    setClientNameForSlot('');
  };
  // --- End Handlers ---

  // --- Handler for Right-Click (Context Menu) ---
  const handleContextMenu = async (event, calendarId, date, time, appointment) => { 
    event.preventDefault(); 

    const isTargetCalendar = [...ALL_TEAMS, SHARED_CALENDAR_ID].includes(calendarId);

    // --- Permission Check --- 
    // 1. Must be a target calendar
    // 2. Must be a booked slot
    // 3. Must be the user's OWN appointment OR the user must be 'Catalina' on the SHARED calendar
    let canConfirmOrDeconfirm = false;
    if (isTargetCalendar && appointment) {
        if (appointment.agentName === currentUser.name) { // Is it my own appointment?
            canConfirmOrDeconfirm = true;
        } else if (calendarId === SHARED_CALENDAR_ID && currentUser.name === 'Catalina') { // Catalina can confirm/deconfirm any on SHARED?
            // Assumption: Catalina should be able to manage confirmations on SHARED calendar
            // Adjust this logic if needed
            canConfirmOrDeconfirm = true; 
        } else if (currentUser.name === 'Alin') { // Allow Admin Alin?
            canConfirmOrDeconfirm = true;
        }
    }

    if (!canConfirmOrDeconfirm) {
      console.log("Context menu ignored - insufficient permissions or invalid state.");
      return; 
    }
    // --- End Permission Check --- 

    console.log(`Right-click triggered by ${currentUser.name} for: ${calendarId}, ${formatDateId(date)} ${time}`);

    // Check if already confirmed
    if (appointment.isConfirmed) {
        // --- Deconfirm --- 
        console.log("Attempting to DEconfirm...");
        const success = await deconfirmAppointment(date, time, calendarId);
        if (success) {
            setMessage('Confirmare anulată!');
            setTimeout(() => setMessage(''), 2000);
        } else {
            setMessage('Eroare la anularea confirmării.');
            setTimeout(() => setMessage(''), 3000);
        }
    } else {
        // --- Confirm --- 
        console.log("Attempting to confirm...");
        const success = await confirmAppointment(date, time, calendarId);
        if (success) {
            setMessage('Programare confirmată!');
            setTimeout(() => setMessage(''), 2000); 
        } else {
            setMessage('Eroare la confirmarea programării.');
            setTimeout(() => setMessage(''), 3000); 
        }
    }
  };
  // --- End Handler ---

  // --- Handlers for Speech Popup ---
  const handleOpenSpeechPopup = (appointment, dayDate) => {
    if (!appointment || !dayDate) {
        console.error("Missing data for speech popup", { appointment, dayDate });
        return;
    }
    // Construct the data object for the popup using the CORRECT date from the grid
    const popupData = {
        ...appointment, // Keep other appointment details like time, agentName etc.
        date: dayDate    // <<< Use the date of the day column
    };
    console.log("Opening speech popup with data:", popupData);
    setSelectedAppointmentForSpeech(popupData); // Pass the corrected data
    setIsSpeechPopupOpen(true);
  };

  const handleCloseSpeechPopup = () => {
    setIsSpeechPopupOpen(false);
    setSelectedAppointmentForSpeech(null); 
  };
  // --- End Handlers ---

  // Render loading indicator
  if (isLoading || !activeViewId) {
    return <div className="loading-indicator">Se încarcă...</div>; 
  }

  // --- Calculate the next agent dynamically based on the current serviceAgent ---
  let displayNextAgent = null;
  if (serviceAgent && serviceAgent !== 'Weekend' && serviceAgent !== 'N/A' && serviceAgent !== 'Pauză') {
      const currentIndex = SERVICE_AGENTS.indexOf(serviceAgent);
      if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % SERVICE_AGENTS.length;
          displayNextAgent = SERVICE_AGENTS[nextIndex];
      }
  }
  // --- End dynamic calculation ---

  // --- Helper function to format date for Agent Serviciu view --- 
  const formatServiceDate = (date) => {
    if (!date) return ''
    // Uppercase the first letter of the day name
    return moment(date).format('dddd DD.MM.YYYY').replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="calendar-container">
      {/* Header */}
      <header className="calendar-header">
        <h1>CALENDAR AGENȚI</h1>
        {/* Formatăm timpul din state-ul currentRealTime */}
        <div className="current-time">{currentRealTime.format('HH:mm:ss')}</div>
      </header>
      
      {/* Team counts */}
      <div className="team-counts">
        {ALL_TEAMS.map(teamName => (
          <div key={teamName} className="team-count-item">
            <div className="team-name">{teamName}</div>
            {/* Display count from the filtered teamCounts state */}
            <div className="team-count">{teamCounts[teamName] || 0}</div>
          </div>
        ))}
      </div>
      
      {/* --- View Selection Buttons --- */}
      <div className="calendar-selector">
        {availableViewIds.map(viewId => {
          let displayName = viewId;
          if (viewId === SHARED_CALENDAR_ID) displayName = SHARED_CALENDAR_NAME;
          if (viewId === AGENT_SERVICIU_ID) displayName = AGENT_SERVICIU_NAME;
          
          return (
            <button 
              key={viewId}
              className={`selector-button ${activeViewId === viewId ? 'active' : ''}`}
              onClick={() => setActiveViewId(viewId)}
            >
              {displayName}
            </button>
          );
        })}
      </div>
      {/* --- End Buttons --- */}
      
      {/* --- Conditional Content Rendering --- */}
      <div className="calendar-content">

        {/* --- Diverse View (Previously Agent de Serviciu) --- */} 
        {activeViewId === AGENT_SERVICIU_ID && (
          // Main container for the "Diverse" section
          <div className="diverse-view"> 
             <h2>{AGENT_SERVICIU_NAME.toUpperCase()}</h2> {/* Use the updated name */} 

            {/* --- Widget Area --- */}
            <div className="widget-area">
                {/* Widget 1: Agent de Serviciu */}
                <div className="widget-container agent-widget"> 
                    {/* Content previously directly under agent-serviciu-view */} 
                    <h3>AGENTUL DE SERVICIU</h3> {/* Keep a sub-title for the widget */} 
                    <div className="service-date">{formatServiceDate(serviceAgentDate)}</div>
                    
                    {/* Pause Button - Only for Claudiu */}
                    {currentUser && currentUser.name === 'Claudiu' && (
                      <div className="pause-control">
                        <button 
                          className={`pause-button ${isRotationPaused ? 'paused' : 'active'}`}
                          onClick={handleTogglePause}
                          aria-label={isRotationPaused ? "Reactivează rotația" : "Pauză rotație"}
                        >
                          {isRotationPaused ? '▶️ Reactivează' : '⏸️ Pauză'}
                        </button>
                      </div>
                    )}
                    
                    <div className="agent-display">
                      {/* Show arrows for Admin OR Claudiu */} 
                      {currentUser && (currentUser.name === 'Alin' || currentUser.name === 'Claudiu') && (
                        <button className="nav-button prev" onClick={handlePrevServiceAgent} aria-label="Agent precedent">&lt;</button>
                      )}
                      <span className="agent-name">{serviceAgent === 'Weekend' || serviceAgent === 'N/A' || serviceAgent === 'Pauză' ? '-' : serviceAgent || '...'}</span>
                      {/* Show arrows for Admin OR Claudiu */} 
                      {currentUser && (currentUser.name === 'Alin' || currentUser.name === 'Claudiu') && (
                        <button className="nav-button next" onClick={handleNextServiceAgent} aria-label="Agent următor">&gt;</button>
                      )}
                    </div>
                    {/* Show next agent info */}
                    {serviceAgent !== 'Weekend' && serviceAgent !== 'N/A' && serviceAgent !== 'Pauză' && displayNextAgent && (
                      <div className="next-agent-info">
                        Urmează: {displayNextAgent} 
                      </div>
                    )}
                    {/* Show success message only on workdays and when not paused */} 
                    {serviceAgent !== 'Weekend' && serviceAgent !== 'N/A' && serviceAgent !== 'Pauză' && (
                        <div className="success-message">
                        Mult succes!!
                        </div>
                    )}
                    {/* Show weekend message */}
                    {serviceAgent === 'Weekend' && (
                        <div className="weekend-message">Weekend - Fără agent de serviciu</div>
                    )}
                    {/* Show pause message */}
                    {serviceAgent === 'Pauză' && (
                        <div className="pause-message">Rotația este în pauză - Zi de sărbătoare</div>
                    )}
                </div> {/* End agent-widget */} 

                {/* Widget 2: Team Building */}
                <TeamBuildingWidget /> 
                
                {/* Widget 3: Debts */}
                <DebtsWidget />
                
                {/* Widget 4: Next Appointment (Conditionally Rendered) */}
                {/* Show for Niki, Florin, OR Claudiu */}
                {currentUser && (currentUser.name === 'Niki' || currentUser.name === 'Florin' || currentUser.name === 'Claudiu') && (
                  <NextAppointmentWidget 
                    appointmentsData={appointmentsData}
                    teamsToShow={ALL_TEAMS} // Pass the main teams
                    currentTime={currentRealTime} // Pass the current time moment object
                  />
                )}
                
            </div> {/* End widget-area */} 
          </div> // End diverse-view
        )}

        {/* --- Calendar Views (Render only if NOT Agent Serviciu view) --- */} 
        {activeViewId !== AGENT_SERVICIU_ID && (
          // Ensure we have a valid calendar ID before rendering the calendar
          ALL_CALENDAR_IDS.includes(activeViewId) && (
              <div key={activeViewId} className="team-calendar"> 
                <h2 className="team-title">{activeViewId === SHARED_CALENDAR_ID ? SHARED_CALENDAR_NAME : activeViewId}</h2>
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="week-container">
                    <div className="days-container">
                      {week.days.map((day, dayIndex) => (
                        <div key={dayIndex} className="day-column">
                          <div className="day-header">
                            {day.dayName} {day.dayMonth}
                          </div>
                          {timeSlots.map((slot, slotIndex) => {
                            const appointment = getTeamAppointment(activeViewId, day.date, slot.time);
                            const isBooked = !!appointment;
                            const isOwn = isBooked && appointment.agentName === currentUser.name;
                            const isColleague = isBooked && !isOwn;
                            const isConfirmed = appointment?.isConfirmed; // <<< Check confirmation status
                            
                            // --- Check if this slot is the one Catalina is editing ---
                            const isCatalinaInputActive = 
                                activeSlotForInput &&
                                activeSlotForInput.calendarId === activeViewId &&
                                moment(activeSlotForInput.date).isSame(day.date, 'day') &&
                                activeSlotForInput.time === slot.time;
                            // --- End Check ---

                            // --- Revised Logic for clickability/disabled state ---
                            let canClick = false;
                            let isDisabled = false;
                            const isInputFormActiveAnywhere = !!activeSlotForInput; // Check if the form is active anywhere

                            if (isBooked) {
                                if (isOwn) {
                                    // User's own appointment - allow cancellation
                                    canClick = true;
                                    isDisabled = false;
                                } else {
                                    // Colleague's appointment - disallow click/disable
                                    canClick = false;
                                    isDisabled = true;
                                }
                            } else { // Slot is not booked
                                if (isInputFormActiveAnywhere) {
                                    // Cannot click other slots if Catalina's form is active
                                    canClick = false;
                                    isDisabled = true;
                                } else {
                                    // Allow clicking empty slot (for booking or Catalina's form)
                                    canClick = true;
                                    isDisabled = false;

                                    // Visually disable booking for Claudiu on other team calendars
                                    if (currentUser.name === 'Claudiu' && 
                                        activeViewId !== currentUser.team && 
                                        activeViewId !== SHARED_CALENDAR_ID
                                    ) {
                                        canClick = false;
                                        isDisabled = true;
                                    }
                                }
                            }

                            // Override if the current slot is the one being edited by Catalina
                            if (isCatalinaInputActive) {
                                canClick = false; // Don't allow clicking the slot itself while editing
                                isDisabled = true; // Visually disable interaction with the underlying slot
                            }
                            // --- End Revised Logic ---
                            
                            return (
                              <div 
                                key={slotIndex}
                                className={`time-slot ${isBooked ? 'booked' : ''} ${isOwn ? 'own-appointment' : ''} ${isColleague ? 'colleague-appointment' : ''} ${isDisabled ? 'disabled-slot' : ''} ${isCatalinaInputActive ? 'input-active' : ''} ${isConfirmed ? 'confirmed-appointment' : ''}`}
                                style={isBooked ? { backgroundColor: appointment.color } : {}}
                                onClick={canClick ? () => handleSlotClick(activeViewId, day.date, slot.time) : undefined} 
                                onContextMenu={(e) => handleContextMenu(e, activeViewId, day.date, slot.time, appointment)}
                              >
                                {/* --- Speech Button --- */}
                                {isBooked && !isCatalinaInputActive && (
                                  <button 
                                    className="speech-button" 
                                    onClick={(e) => { e.stopPropagation(); handleOpenSpeechPopup(appointment, day.date); }} 
                                    title="Generează mesaj"
                                  >
                                    🗨️
                                  </button>
                                )}
                                {/* --- End Speech Button --- */}

                                {isCatalinaInputActive ? (
                                  // --- Render Catalina's Form ---
                                  <div className="catalina-input-form">
                                    <select 
                                      value={selectedAgentForSlot} 
                                      onChange={(e) => setSelectedAgentForSlot(e.target.value)}
                                      onClick={(e) => e.stopPropagation()} // Prevent slot click from triggering
                                    >
                                      <option value="" disabled>Selectează agent</option>
                                      {/* Use ALL_POSSIBLE_AGENTS from useAuth */}
                                      {ALL_POSSIBLE_AGENTS.map(agent => (
                                        <option key={agent} value={agent}>{agent}</option>
                                      ))}
                                    </select>
                                    <input 
                                      type="text" 
                                      placeholder="Nume client" 
                                      value={clientNameForSlot}
                                      onChange={(e) => setClientNameForSlot(e.target.value)}
                                      onClick={(e) => e.stopPropagation()} // Prevent slot click from triggering
                                    />
                                    <div className="catalina-form-buttons">
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); handleConfirmCatalinaBooking(); }}
                                          disabled={!selectedAgentForSlot || !clientNameForSlot.trim()}
                                        >Ok</button>
                                       <button onClick={(e) => { e.stopPropagation(); handleCancelCatalinaInput(); }}>X</button>
                                    </div>
                                  </div>
                                  // --- End Form ---
                                ) : isBooked ? (
                                  // --- Standard Booked Slot Display ---
                                  <div className="appointment-info">
                                    {/* Show client name if available (especially for SHARED_CALENDAR) */}
                                    {appointment.clientName ? (
                                        <>
                                            <div>{appointment.selectedAgent || appointment.agentName}</div> 
                                            <div className="client-name-display">({appointment.clientName})</div>
                                            <div>{appointment.time}</div>
                                        </>
                                    ) : (
                                        <>
                                          <div>{appointment.agentName}</div>
                                          <div>{appointment.time}</div>
                                        </>
                                    )}
                                  </div>
                                ) : (
                                  // --- Empty Slot Display ---
                                  <div className="slot-time">{slot.time}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}
        {/* End Calendar Views */} 

      </div> 
      {/* End Conditional Content Rendering */} 
      
      {/* Message display */}
      {message && (
        <div className="message-container">
          <div className="message">{message}</div>
        </div>
      )}
      
      {/* Confirmation popup */}
      {isPopupOpen && (
        <div className="popup-overlay">
          <div className="popup">
            <p>Ești sigur că vrei să anulezi?</p>
            <div className="popup-buttons">
              <button className="confirm-button" onClick={handleCancelConfirm}>Da</button>
              <button className="cancel-button" onClick={handleCancelReject}>Nu</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Logout button */}
      <button className="logout-button" onClick={handleLogout}>
        Deconectare
      </button>

      {/* --- Render Speech Popup Conditionally --- */}
      {selectedAppointmentForSpeech && (
        <SpeechGeneratorPopup 
          appointmentData={selectedAppointmentForSpeech} 
          onClose={handleCloseSpeechPopup} 
          isOpen={isSpeechPopupOpen}
        />
      )}
      {/* --- End Render --- */}

    </div>
  );
}

export default Calendar; 