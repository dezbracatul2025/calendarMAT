import React, { useState, useEffect } from 'react';
import moment from 'moment';
import './NextAppointmentWidget.css';

function NextAppointmentWidget({ appointmentsData, teamsToShow, currentTime }) {
  const [nextAppointments, setNextAppointments] = useState({}); // { teamName: { time: 'HH:mm', agentName: '...' } | null }
  const [dayProgress, setDayProgress] = useState(0); // State for progress
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const todayStr = currentTime.format('YYYY-MM-DD');
    const nowStr = currentTime.format('HH:mm');
    const results = {};
    let totalAppointmentsToday = 0;
    let completedAppointmentsToday = 0;

    // console.log(`NextAppt Widget Update: Time=${nowStr}, Date=${todayStr}`);

    teamsToShow.forEach(teamName => {
      const teamAppointmentsToday = appointmentsData[teamName]?.[todayStr];
      let foundNext = null;

      if (teamAppointmentsToday) {
        const appointmentTimes = Object.keys(teamAppointmentsToday);
        totalAppointmentsToday += appointmentTimes.length; // Add to total count
        
        // Count completed appointments
        appointmentTimes.forEach(timeSlot => {
          if (timeSlot <= nowStr) { // Check if time has passed or is current
            completedAppointmentsToday++;
          }
        });

        // Get appointment times, filter for future slots, sort them
        const futureSlots = appointmentTimes
          .filter(timeSlot => timeSlot > nowStr) // Keep only slots strictly after current time
          .sort(); // Sort times ascending (default string sort works for HH:mm)
        
        // console.log(`Team ${teamName} - Future Slots Today:`, futureSlots);

        if (futureSlots.length > 0) {
          const nextTime = futureSlots[0];
          const appointmentDetails = teamAppointmentsToday[nextTime];
          if (appointmentDetails) {
             // Determine the primary agent name to display
             const agentNameToDisplay = appointmentDetails.selectedAgent || appointmentDetails.agentName;
            foundNext = { 
                time: nextTime, 
                agentName: agentNameToDisplay 
            };
          }
        }
      }
      results[teamName] = foundNext;
    });

    // Calculate progress percentage
    const progress = totalAppointmentsToday > 0 
      ? Math.round((completedAppointmentsToday / totalAppointmentsToday) * 100) 
      : 0; // Avoid division by zero, show 0 if no appointments
    
    setDayProgress(progress);
    setNextAppointments(results);
    setIsLoading(false);

  }, [appointmentsData, teamsToShow, currentTime]); // Recalculate when data or time changes

  return (
    <div className="widget-container next-appointment-widget futuristic-theme">
      <h3>Următoarele Întâlniri</h3>
      {isLoading ? (
        <div className="loading-next-appt">Se încarcă...</div>
      ) : (
        <>
          <ul className="next-appointment-list">
            {teamsToShow.map(teamName => (
              <li key={teamName} className="next-appointment-item">
                <span className="team-name-next">{teamName}</span>
                {nextAppointments[teamName] ? (
                  <span className="appointment-details-next">
                    {nextAppointments[teamName].time} - {nextAppointments[teamName].agentName}
                  </span>
                ) : (
                  <span className="no-appointment-next">-</span>
                )}
              </li>
            ))}
          </ul>
          {/* Progress Bar Section */}
          <div className="progress-info">
            <span className="progress-label">Progres Zi</span>
            <span className="progress-percentage">{dayProgress}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-indicator" 
              style={{ width: `${dayProgress}%` }}
            ></div>
          </div>
        </>
      )}
    </div>
  );
}

export default NextAppointmentWidget; 