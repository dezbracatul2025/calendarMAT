import moment from 'moment';

// Get current week start date (Monday)
export const getCurrentWeekStart = () => {
  const today = moment();
  const dayOfWeek = today.day();
  // If today is Sunday (0), go back 6 days to get to Monday
  // Otherwise, go back to the most recent Monday
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return today.subtract(daysToSubtract, 'days').startOf('day');
};

// Generate dates for 3 weeks starting from the given date
export const generateWeekDates = (startDate) => {
  const weeks = [];
  
  // Simple translation map
  const dayNameTranslations = {
    'Monday': 'Luni',
    'Tuesday': 'Marți',
    'Wednesday': 'Miercuri',
    'Thursday': 'Joi',
    'Friday': 'Vineri'
    // Add Saturday/Sunday if you ever display them
  };

  // Generate 3 weeks
  for (let weekIndex = 0; weekIndex < 3; weekIndex++) {
    const weekStart = moment(startDate).add(weekIndex * 7, 'days');
    const weekDays = [];
    
    // Generate weekdays (Monday to Friday)
    for (let day = 0; day < 5; day++) {
      const currentDate = moment(weekStart).add(day, 'days');
      const englishDayName = currentDate.format('dddd'); // Get English name
      weekDays.push({
        date: currentDate,
        dayName: dayNameTranslations[englishDayName] || englishDayName, // Translate or fallback
        dayMonth: currentDate.format('D.M.YY')
      });
    }
    
    weeks.push({
      weekStart: weekStart,
      days: weekDays
    });
  }
  
  return weeks;
};

// Generate time slots from 9:30 to 16:00 with 30min intervals
export const generateTimeSlots = () => {
  const slots = [];
  const startTime = moment().set({hour: 9, minute: 30, second: 0});
  const endTime = moment().set({hour: 16, minute: 0, second: 0});
  
  let currentTime = moment(startTime);
  
  while (currentTime <= endTime) {
    slots.push({
      time: currentTime.format('HH:mm'),
      value: currentTime.format('HH:mm')
    });
    currentTime.add(30, 'minutes');
  }
  
  return slots;
};

// Format date for Firebase IDs
export const formatDateForId = (date) => {
  return moment(date).format('YYYY-MM-DD');
};

// Count appointments for the *next working day* by team
export const countNextDayAppointments = (allTeamsAppointmentsData) => {
  let nextWorkingDay = moment().add(1, 'day');

  // Skip weekends to find the next working day (Monday)
  if (nextWorkingDay.day() === 6) { // If tomorrow is Saturday
    nextWorkingDay.add(2, 'days'); // Move to Monday
  } else if (nextWorkingDay.day() === 0) { // If tomorrow is Sunday
    nextWorkingDay.add(1, 'day'); // Move to Monday
  }
  
  const nextWorkingDayFormatted = formatDateForId(nextWorkingDay);
  console.log("Calculating counts for next working day:", nextWorkingDayFormatted);

  const counts = {
    Andreea: 0,
    Cristina: 0,
    Scarlat: 0
  };
  
  // Iterate through each team in the provided data structure
  for (const teamName in counts) { // Iterate using the keys of counts object to ensure all teams are checked
    if (allTeamsAppointmentsData && allTeamsAppointmentsData[teamName]) {
      const teamData = allTeamsAppointmentsData[teamName];
      // Check if there are appointments for the calculated next working day for this team
      if (teamData[nextWorkingDayFormatted]) {
        // Count the number of booked slots (keys) for that day
        counts[teamName] = Object.keys(teamData[nextWorkingDayFormatted]).length;
      }
    }
  }
  
  console.log("Next day counts:", counts);
  return counts;
}; 