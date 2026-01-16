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
    BANANA: '5'     // Yellow (Large/Unanswered)
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

  events.forEach(function(event) {
    if (event.isAllDayEvent()) return;

    const status = event.getMyStatus();
    let targetColor = "";
    
    // Check for Hidden Guest List
    // Note: getGuestList().length is 0 if hidden, but we need to distinguish "Hidden" from "Just Me".
    // 'guestsCanSeeOtherGuests' is not directly available in standard CalendarApp Event object easily 
    // without Advanced Service, BUT specific feature "attendeesOmitted" logic:
    // If I am NOT the owner, and I cannot see other guests, it's likely a hidden list.
    // However, Standard API doesn't expose 'guestsCanSeeOtherGuests' property directly on Event.
    // WORKAROUND: We will try to fetch the Advanced Event object ONLY for candidates to check this property if needed,
    // OR we just rely on "0 guests + not owner" as a heuristic? 
    // No, let's keep it simple: If we can't detect it easily in Standard Mode effectively, we might need a hybrid.
    // Wait, the user wants "Previous working logic". 
    // Actually, we CAN use the Advanced Service just for the specific property usage if 'Calendar' is enabled, 
    // but mixing them is fine.
    // Let's stick to the Pure Standard API where possible, but for "Hidden Guests" we might need a trick.
    // ACTUALLY: The previous "Batch Mode" failed on *writing*. Reading was fine.
    // So we will READ with Advanced API (to get the hidden status) and WRITE with Standard API (setColor).
    
    // ...Wait, mixing is complicated for the user script.
    // Let's try to map the Standard Event to the rules. 
    // Standard Event doesn't have 'guestsCanSeeOtherGuests'.
    // We will use the Advanced API to READ (since it's enabled) and `event.setColor` to WRITE. No, `event` from `getEvents` is a CalendarEvent object, not JSON.
    // We can't mix `event.setColor` on a JSON object.
    
    // PLAN: 
    // 1. Fetch with Standard `getEvents()` (returns objects with .setColor).
    // 2. BUT we're missing `guestsCanSeeOtherGuests`.
    // 3. SO: We *must* use Advanced API `Calendar.Events.list` to get the list (with the hidden property),
    //    AND THEN for every event we want to update, we use `calendar.getEventById(id).setColor(color)`.
    //    This is "Slow but Reliable".
  });
  
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
    // Rule 2: Large/Hidden Guest List (Unanswered) -> Yellow (Banana)
    else if ((item.guestsCanSeeOtherGuests === false || item.attendeesOmitted) && status === 'needsAction') {
      targetColor = COLORS.BANANA;
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
