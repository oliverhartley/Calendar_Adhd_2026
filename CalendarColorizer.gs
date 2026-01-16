/**
 * Reliable Calendar Colorizer (Standard Mode)
 * 
 * Logic:
 * 1. Declined (NO) -> Flamingo (Light Red)
 * 2. Large/Hidden (Guests hidden) -> Banana (Yellow)
 * 3. Owner -> Basil (Green)
 * 4. Accepted (YES) -> Sage (Light Green)
 */

function colorizeCalendar() {
  const SCRIPT_NAME = 'Reliable Calendar Colorizer';
  console.time(SCRIPT_NAME);

  // --- CONFIGURATION ---
  const DAYS_TO_LOOK_BACK = 7; 
  const DAYS_TO_LOOK_AHEAD = 7; 

  const COLORS = {
    BASIL: '10',    // Green (Owner)
    SAGE: '2',      // Light Green (Accepted)
    FLAMINGO: '4',  // Light Red (Declined)
    LAVENDER: '1',  // Lavender (Large/Unanswered)
    GRAPHITE: '8',  // Gray (Conflict)
    BANANA: '5'     // Yellow (Maybe)
  };

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  console.log(`Scanning from ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  const optionalArgs = {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false
  };
  
  let items = [];
  try {
    const response = Calendar.Events.list('primary', optionalArgs);
    items = response.items || [];
  } catch (e) {
    console.error(`Status: Failed to fetch events via Advanced API. Error: ${e.message}`);
    return;
  }
  
  console.log(`Found ${items.length} events.`);

  // --- 2. DETECT CONFLICTS (Pre-calc) ---
  const myEmail = Session.getActiveUser().getEmail();
  const conflictingIds = new Set();
  
  // Create a sub-list of "Busy" events (Not Declined)
  // We use this list to find overlaps.
  const busyEvents = items.filter(item => {
    if (!item.start.dateTime) return false; // Skip all-day
    let myStatus = 'needsAction';
    if (item.attendees) {
      const me = item.attendees.find(a => a.email === myEmail || a.self);
      if (me) myStatus = me.responseStatus;
    }
    // Consider it "Busy" if I haven't explicitly declined
    return myStatus !== 'declined';
  });

  // Sort by start time (API usually does this, but ensure)
  busyEvents.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

  // Find overlaps
  for (let i = 0; i < busyEvents.length; i++) {
    const current = busyEvents[i];
    const currentStart = new Date(current.start.dateTime).getTime();
    const currentEnd = new Date(current.end.dateTime).getTime();

    for (let j = i + 1; j < busyEvents.length; j++) {
      const next = busyEvents[j];
      const nextStart = new Date(next.start.dateTime).getTime();

      // If next starts after current ends, no overlap possible (sorted)
      if (nextStart >= currentEnd) break;

      // Overlap Found
      conflictingIds.add(current.id);
      conflictingIds.add(next.id);
    }
  }
  console.log(`Found ${conflictingIds.size} events involved in conflicts.`);

  // --- 3. APPLY RULES ---
  let updatedCount = 0;

  items.forEach(function(item) {
    if (item.start.date) return; // Skip all-day

    const title = item.summary || "";
    let status = "needsAction"; 
    let isOwner = false;

    if (item.organizer && (item.organizer.email === myEmail || item.organizer.self)) {
        isOwner = true;
    }
    
    if (item.attendees) {
      const me = item.attendees.find(a => a.email === myEmail || a.self);
      if (me) status = me.responseStatus;
    } else if (isOwner) {
      status = 'accepted';
    }

    let targetColor = "";
    
    // Rule 1: Declined -> Light Red (Flamingo)
    if (status === 'declined') {
      targetColor = COLORS.FLAMINGO;
    }
    // Rule 2: Conflict (Unanswered) -> Graphite (Gray)
    else if (conflictingIds.has(item.id) && status === 'needsAction') {
      targetColor = COLORS.GRAPHITE;
    }
    // Rule 3: Maybe (Tentative) -> Banana (Yellow)
    else if (status === 'tentative') {
      targetColor = COLORS.BANANA;
    }
    // Rule 4: Large/Hidden Guest List (Unanswered) -> Lavender
    else if ((item.guestsCanSeeOtherGuests === false || item.attendeesOmitted) && status === 'needsAction') {
      targetColor = COLORS.LAVENDER;
    }
    // Rule 5: Owner -> Green (Basil)
    else if (isOwner) {
      targetColor = COLORS.BASIL;
    }
    // Rule 6: Accepted (Yes) -> Light Green (Sage)
    else if (status === 'accepted') {
      targetColor = COLORS.SAGE;
    }

    // Apply Update (Slow/Standard Method)
    if (targetColor && item.colorId !== targetColor) {
      try {
        const eventObject = calendar.getEventById(item.id);
        if (eventObject) {
           eventObject.setColor(targetColor);
           updatedCount++;
           console.log(`Updated: "${title}" -> ${targetColor}`);
        }
      } catch (e) {
         console.error(`Failed to update "${title}": ${e.message}`);
      }
    }
  });

  console.log(`Total updated: ${updatedCount}`);
  console.timeEnd(SCRIPT_NAME);
}
