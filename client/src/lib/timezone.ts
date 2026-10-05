// Timezone utility functions for handling EST/America/New_York timezone

/**
 * Convert a date to EST timezone string
 * This ensures the time displayed matches exactly what's stored in the database (EST)
 */
export function formatInEST(date: Date | string, includeTime = true): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeTime && {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  };
  
  return dateObj.toLocaleString('en-US', options);
}

/**
 * Format deadline for grant cards (short format)
 */
export function formatDeadlineShort(deadline: string | Date): string {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  
  return deadlineDate.toLocaleDateString("en-US", {
    timeZone: 'America/New_York',
    month: "short",
    day: "numeric",
  });
}

/**
 * Format full deadline with timezone
 */
export function formatDeadlineFull(deadline: string | Date, timezone?: string): string {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const tz = timezone || 'America/New_York';
  const tzAbbr = getTimezoneAbbr(tz, deadlineDate);
  
  const dateStr = deadlineDate.toLocaleString("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  
  return `${dateStr} ${tzAbbr}`;
}

/**
 * Get timezone abbreviation with DST awareness
 * Returns EST or EDT for America/New_York depending on the date
 */
export function getTimezoneAbbr(timezone: string, date?: Date | string): string {
  const dateObj = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  
  // For America/New_York, determine if it's EST or EDT based on the date
  if (timezone === 'America/New_York') {
    const formatted = dateObj.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    
    // Extract timezone abbreviation from formatted string (e.g., "12/25/2024, 3:00:00 PM EST")
    const match = formatted.match(/\b(EST|EDT)\b/);
    return match ? match[1] : 'EST';
  }
  
  // Fallback for other timezones
  const abbrs: Record<string, string> = {
    'America/Chicago': 'CST',
    'America/Denver': 'MST',
    'America/Los_Angeles': 'PST',
    'America/Phoenix': 'MST',
    'America/Anchorage': 'AKST',
    'Pacific/Honolulu': 'HST',
  };
  
  return abbrs[timezone] || 'EST';
}

/**
 * Check if deadline is soon (within 7 days) using EST timezone
 */
export function isDeadlineSoon(deadline: string | Date): boolean {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7 && diffDays >= 0;
}

/**
 * Check if grant is expired using EST timezone
 */
export function isGrantExpired(deadline: string | Date): boolean {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  return deadlineDate.getTime() < now.getTime();
}

/**
 * Format deadline with "Due in X days" logic
 * Calculates difference in EST timezone to ensure consistency
 */
export function formatDeadlineWithDays(deadline: string | Date): string {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  
  // Get current time in EST timezone
  const now = new Date();
  const nowInEST = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const deadlineInEST = new Date(deadlineDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  // Calculate difference in milliseconds using EST times
  const diffMs = deadlineInEST.getTime() - nowInEST.getTime();
  
  // If deadline has passed, return "Past Due"
  if (diffMs < 0) return "Past Due";
  
  // Calculate difference in days (ceiling for future dates)
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return "Due Soon";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  
  // For all grants, show short date format when not due soon
  return formatDeadlineShort(deadlineDate);
}

/**
 * Convert datetime-local input value to ISO string treating it as America/New_York time
 * The input "2025-08-13T23:59" should be interpreted as 11:59 PM Eastern time on that date
 * This function properly handles daylight saving time (DST) through iterative convergence
 */
export function datetimeLocalToEST(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) return '';
  
  // Parse the datetime-local value: "2025-08-13T23:59"
  const [datePart, timePart] = datetimeLocalValue.split('T');
  const [year, month, day] = datePart.split('-');
  const [hour, minute] = timePart.split(':');
  
  const targetHour = parseInt(hour);
  const targetMinute = parseInt(minute);
  
  // Start with an initial UTC guess
  let currentDate = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    targetHour,
    targetMinute,
    0
  ));
  
  // Iteratively adjust until we get the exact desired New York time
  // Maximum 5 iterations to prevent infinite loops
  for (let i = 0; i < 5; i++) {
    // Get what this UTC time looks like in America/New_York
    const nyString = currentDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Parse the NY time: "MM/DD/YYYY, HH:MM"
    const [nyDatePart, nyTimePart] = nyString.split(', ');
    const [nyMonth, nyDay, nyYear] = nyDatePart.split('/');
    const [nyHour, nyMinute] = nyTimePart.split(':');
    
    const actualHour = parseInt(nyHour);
    const actualMinute = parseInt(nyMinute);
    
    // Check if we've converged (NY time matches target)
    if (actualHour === targetHour && actualMinute === targetMinute) {
      // Also verify the date matches (handle DST day boundaries)
      if (parseInt(nyDay) === parseInt(day) && parseInt(nyMonth) === parseInt(month)) {
        return currentDate.toISOString();
      }
    }
    
    // Calculate the difference and adjust
    let hourDiff = targetHour - actualHour;
    let minuteDiff = targetMinute - actualMinute;
    
    // Handle day boundary crossings
    if (hourDiff > 12) hourDiff -= 24;
    if (hourDiff < -12) hourDiff += 24;
    
    // Apply the adjustment
    const adjustmentMs = (hourDiff * 60 + minuteDiff) * 60 * 1000;
    currentDate = new Date(currentDate.getTime() + adjustmentMs);
  }
  
  // If we didn't converge after 5 iterations, return the best attempt
  return currentDate.toISOString();
}

/**
 * Convert ISO timestamp to datetime-local format in EST timezone for form display
 * Takes a Date or ISO string and returns "YYYY-MM-DDTHH:MM" in EST timezone
 */
export function toDatetimeLocalEST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date/time components in EST timezone
  const estString = dateObj.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Parse the EST string: "MM/DD/YYYY, HH:MM"
  const [datePart, timePart] = estString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute] = timePart.split(':');
  
  // Return in datetime-local format: "YYYY-MM-DDTHH:MM"
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Format applied date with time in 24-hour EST format
 * Example output: "Oct 17, 2025 14:30 EST"
 */
export function formatAppliedDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tzAbbr = getTimezoneAbbr('America/New_York', dateObj);
  
  const dateStr = dateObj.toLocaleString("en-US", {
    timeZone: 'America/New_York',
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  
  return `${dateStr} ${tzAbbr}`;
}
