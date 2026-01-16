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
    LAVENDER: '1'   // Lavender (Large/Unanswered)
  };

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  console.log(`Scanning from ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  // Use Standard CalendarApp Service (Slower but 100% reliable)
  const events = calendar.getEvents(startDate, endDate);
  let updatedCount = 0;

  // REVISED PLAN FOR RELIABILITY:
  // Use `Calendar.Events.list` to get the data (including `guestsCanSeeOtherGuests`).
  // Loop through items.
  // If update needed -> `calendar.getEventById(item.id).setColor(color)`.
  
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
  const myEmail = Session.getActiveUser().getEmail();

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
    // Rule 2: Large/Hidden Guest List (Unanswered) -> Lavender
    else if ((item.guestsCanSeeOtherGuests === false || item.attendeesOmitted) && status === 'needsAction') {
      targetColor = COLORS.LAVENDER;
    }
    // Rule 3: Owner -> Green (Basil)
    else if (isOwner) {
      targetColor = COLORS.BASIL;
    }
    // Rule 4: Accepted (Yes) -> Light Green (Sage)
    else if (status === 'accepted') {
      targetColor = COLORS.SAGE;
    }

    // Apply Update (Slow/Standard Method)
    if (targetColor && item.colorId !== targetColor) {
      try {
        // Fetch the Object wrapper to call .setColor()
        // Note: .getEventById() is reliable.
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
