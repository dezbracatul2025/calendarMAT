import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import moment from 'moment'; // Import moment
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
  cancelAppointment
} from '../utils/appointmentService';
import './Calendar.css';

const ALL_TEAMS = ['Andreea', 'Cristina', 'Scarlat'];

function Calendar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [currentRealTime, setCurrentRealTime] = useState(moment()); // Store moment object for time
  const [todayDateString, setTodayDateString] = useState(moment().format('YYYY-MM-DD')); // Store current date string
  const [appointmentsData, setAppointmentsData] = useState({});
  const [teamCounts, setTeamCounts] = useState({ Andreea: 0, Cristina: 0, Scarlat: 0 });
  const [weeks, setWeeks] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [message, setMessage] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [slotToCancel, setSlotToCancel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
    let weekStartForDisplay;

    // Determine the starting Monday for the 3-week display
    if (now.day() === 6 || now.day() === 0) { // If it's Saturday or Sunday
      // Start the calendar view from the *upcoming* Monday
      weekStartForDisplay = moment(now).day(8).startOf('day'); 
      console.log("Weekend detected. Starting calendar view from next Monday:", weekStartForDisplay.format('YYYY-MM-DD'));
    } else {
      // Otherwise (Mon-Fri), start from the current week's Monday
      weekStartForDisplay = getCurrentWeekStart(); // Use existing function
      console.log("Weekday detected. Starting calendar view from current Monday:", weekStartForDisplay.format('YYYY-MM-DD'));
    }

    const generatedWeeks = generateWeekDates(weekStartForDisplay);
    setWeeks(generatedWeeks);
  }, [todayDateString]); // Depend only on the date string
  
  // Callback to handle updates from subscriptions
  const handleSubscriptionUpdate = useCallback((teamName, teamAppointments) => {
    console.log(`Received update for team: ${teamName}`, teamAppointments);
    // Use functional update to ensure we have the latest state for appointmentsData
    setAppointmentsData(prevData => { 
      const updatedData = {
        ...prevData,
        [teamName]: teamAppointments
      };
      // IMPORTANT: Recalculate counts using the *newly updated* full data
      // This ensures countNextDayAppointments receives the latest snapshot of all available data
      const currentCounts = countNextDayAppointments(updatedData);
      setTeamCounts(currentCounts);
      
      return updatedData; // Return the new state for appointmentsData
    });
  }, []); // Added useCallback with empty dependency array as it doesn't depend on component state directly

  // This useEffect sets up the subscriptions
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setAppointmentsData({}); // Clear data when user changes
    setTeamCounts({ Andreea: 0, Cristina: 0, Scarlat: 0 }); // Reset counts

    // *** MODIFICATION START: ALL users subscribe to ALL teams ***
    // const teamsToSubscribe = currentUser.name === 'Alin' ? ALL_TEAMS : [currentUser.team];
    const teamsToSubscribe = ALL_TEAMS; // Always subscribe to all teams
    // *** MODIFICATION END ***

    const unsubscribes = [];
    console.log(`User ${currentUser.name} subscribing to ALL teams (${teamsToSubscribe.join(', ')}) for counters...`);

    // For regular agents, fetch initial counts for other teams
    // This section might be less critical now as all users subscribe to all teams
    if (currentUser.name !== 'Alin') {
       // console.log("Regular agent - subscribing to all for counters.");
    }

    teamsToSubscribe.forEach(teamName => {
      // Use the existing callback which updates the aggregated state
      const unsubscribe = subscribeToTeamAppointments(teamName, handleSubscriptionUpdate);
      unsubscribes.push(unsubscribe);
    });

    // Assume initial data fetch happens quickly via onSnapshot
    setIsLoading(false); 

    return () => {
      console.log("Unsubscribing from appointments...");
      unsubscribes.forEach(unsub => unsub());
    };
  // Added handleSubscriptionUpdate to dependency array as it's defined outside but used inside
  }, [currentUser, handleSubscriptionUpdate]);
  
  // Handle slot click
  const handleSlotClick = async (teamName, date, time) => {
    if (!currentUser || currentUser.name === 'Alin') return;

    const teamAppointment = getTeamAppointment(teamName, date, time);

    if (!teamAppointment) {
      console.log(`Booking slot for team ${teamName} at ${formatDateForId(date)} ${time}`);
      if (currentUser.team !== teamName) {
          console.error(`Mismatch: Current user team ${currentUser.team} trying to book in ${teamName}`);
          setMessage("Eroare internă: Echipă incorectă.");
          setTimeout(() => setMessage(''), 3000);
          return;
      }
      const success = await makeAppointment(date, time, currentUser);
      if (!success) {
        setMessage('Eroare la crearea programării.');
        setTimeout(() => setMessage(''), 3000);
      }
    } else {
      if (teamAppointment.agentName === currentUser.name) {
        console.log(`Initiating cancellation for team ${teamName} slot`);
        setSlotToCancel({ date, time, team: teamName });
        setIsPopupOpen(true);
      } else {
        console.log(`Slot booked by colleague ${teamAppointment.agentName} in team ${teamName}`);
        setMessage('Interval rezervat de un coleg.');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };
  
  // Handle cancel confirmation
  const handleCancelConfirm = async () => {
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
  
  // Get appointment for a specific team
  const getTeamAppointment = useCallback((teamName, date, time) => {
    const dateFormatted = formatDateForId(date);
    if (appointmentsData[teamName] && 
        appointmentsData[teamName][dateFormatted] && 
        appointmentsData[teamName][dateFormatted][time]) {
      return appointmentsData[teamName][dateFormatted][time];
    }
    return null;
  }, [appointmentsData]);
  
  // Determine which team's calendar section to show
  const shouldShowTeamSection = (teamName) => {
    if (!currentUser) return false;
    if (currentUser.name === 'Alin') return true;
    return currentUser.team === teamName;
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // If currentUser is not yet loaded, show loading or nothing
  if (isLoading || !currentUser) {
    return <div>Se încarcă...</div>; 
  }

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
        {Object.entries(teamCounts).map(([team, count]) => (
          <div key={team} className="team-count-item">
            <div className="team-name">{team}</div>
            <div className="team-count">{count}</div>
          </div>
        ))}
      </div>
      
      {/* Calendar content */}
      <div className="calendar-content">
        {ALL_TEAMS.map(teamName => (
          shouldShowTeamSection(teamName) && (
            <div key={teamName} className="team-calendar">
              <h2 className="team-title">{teamName}</h2>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="week-container">
                  <div className="days-container">
                    {week.days.map((day, dayIndex) => (
                      <div key={dayIndex} className="day-column">
                        <div className="day-header">
                          {day.dayName} {day.dayMonth}
                        </div>
                        {timeSlots.map((slot, slotIndex) => {
                          const teamAppointment = getTeamAppointment(teamName, day.date, slot.time);
                          
                          const isBooked = !!teamAppointment;
                          const isOwn = isBooked && teamAppointment.agentName === currentUser.name;
                          const isColleague = isBooked && !isOwn;

                          const canClick = currentUser.name !== 'Alin' && (!isBooked || isOwn);
                          const isDisabled = !canClick;
                          
                          return (
                            <div 
                              key={slotIndex}
                              className={`time-slot ${isBooked ? 'booked' : ''} ${isOwn ? 'own-appointment' : ''} ${isColleague ? 'colleague-appointment' : ''} ${isDisabled ? 'disabled-slot' : ''}`}
                              style={isBooked ? { backgroundColor: teamAppointment.color } : {}}
                              onClick={canClick ? () => handleSlotClick(teamName, day.date, slot.time) : undefined} 
                            >
                              {isBooked ? (
                                <div className="appointment-info">
                                  <div>{teamAppointment.agentName}</div>
                                  <div>{teamAppointment.time}</div>
                                </div>
                              ) : (
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
        ))}
      </div>
      
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
    </div>
  );
}

export default Calendar; 