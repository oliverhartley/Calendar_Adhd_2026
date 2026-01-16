/**
 * ADHD Calendar Colorizer
 * Automates calendar coloring based on 'ADHD Calendar Color Strategy.md'
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Apps Script project at script.google.com
 * 2. Copy the contents of this file into 'Code.gs'
 * 3. Save the project.
 * 4. Run the 'colorizeCalendar' function manually to test.
 * 5. Set up a "Time-driven" trigger to run 'colorizeCalendar' every hour to keep it updated.
 */

function colorizeCalendar() {
  const SCRIPT_NAME = 'ADHD Calendar Colorizer';
  console.time(SCRIPT_NAME);

  // --- CONFIGURATION ---
  const DAYS_TO_LOOK_BACK = 2; // Days in the past to process
  const DAYS_TO_LOOK_AHEAD = 7; // Days in the future to process
  const LARGE_MEETING_THRESHOLD = 8; // Attendees > this count as "Large/Global"
  
  // Keywords to identify specific event types (case-insensitive)
  // Edit these lists to match your specific meeting titles
  const KEYWORDS = {
    FOCUS: ['focus time', 'deep work', 'heads down', 'block'],
    ADMIN: ['admin', 'email', 'catchup', 'catch up', 'expense', 'timesheet', 'review'],
    READINESS: ['readiness'], // Explicitly requested custom label
    BUFFER: ['buffer', 'transition', 'break', 'lunch', 'breathing room'], 
    GLOBAL: ['global', 'all hands', 'town hall', 'wide', 'learning session', 'demo day']
  };

  // Google Calendar EventColor IDs
  // 1:Lavender, 2:Sage, 3:Grape, 4:Flamingo, 5:Banana, 6:Tangerine, 
  // 7:Peacock, 8:Graphite, 9:Blueberry, 10:Basil, 11:Tomato
  const COLORS = {
    LAVENDER: '1',    // Large Meeting (Maybe)
    SAGE: '2',        // Large Meeting (Yes)
    GRAPE: '3',       // Focus Time / Deep Work
    FLAMINGO: '4',    // Buffer Zones / Transitions
    BANANA: '5',      // Maybe (Standard)
    TANGERINE: '6',   // Readiness / Training
    PEACOCK: '7',     // Small Meeting (Yes) / Standard Work
    GRAPHITE: '8',    // Declined
    BASIL: '10',      // Personal / Admin
    TOMATO: '11'      // Owner / Host (High Priority)
  };

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  // Fetch events
  const events = calendar.getEvents(startDate, endDate);
  
  console.log(`Found ${events.length} events from ${startDate.toDateString()} to ${endDate.toDateString()}`);

  var stats = {
    total: events.length,
    updated: 0,
    byCategory: {}
  };

  events.forEach(function(event) {
    if (event.isAllDayEvent()) return; // Typically skip all-day events (like holidays)

    const title = event.getTitle().toLowerCase();
    const status = event.getMyStatus(); // YES, MAYBE, NO, OWNER, INVITED
    const attendees = event.getGuestList();
    const attendeeCount = attendees.length; 
    const isOwner = event.isOwnedByMe();
    
    // Determine the Target Color based on Strategy Rules
    let targetColor = "";
    let ruleMatched = "";

    // --- PRIORITY LOGIC CHAIN ---
    // Rules are evaluated top-to-bottom. First match wins.

    // 1. DECLINED -> Graphite (Rule: "Gray-Out Rule")
    //    Ideally user deletes these, but if they stay, gray them out.
    if (status === CalendarApp.GuestStatus.NO) {
      targetColor = COLORS.GRAPHITE;
      ruleMatched = "Declined";
    }
    
    // 2. FOCUS TIME -> Sage (Rule: "High-Focus & Individual Work")
    else if (matchesAny(title, KEYWORDS.FOCUS)) {
      targetColor = COLORS.SAGE;
      ruleMatched = "Focus Time";
    }
    
    // 3. READINESS -> Tangerine (Rule: "Readiness Training Label")
    else if (matchesAny(title, KEYWORDS.READINESS)) {
      targetColor = COLORS.TANGERINE;
      ruleMatched = "Readiness Training";
    }
    
    // 4. BUFFER/TRANSITION -> Flamingo (Rule: "Buffer Zones")
    else if (matchesAny(title, KEYWORDS.BUFFER)) {
      targetColor = COLORS.FLAMINGO;
      ruleMatched = "Buffer Zone";
    }
    
    // 5. PERSONAL/ADMIN -> Basil (Rule: "Personal/Admin")
    else if (matchesAny(title, KEYWORDS.ADMIN)) {
      targetColor = COLORS.BASIL;
      ruleMatched = "Admin/Personal";
    }

    // 6. OWNER/HOST -> Basil (Rule: "Meetings You Own")
    //    Constraint: Must have attendees to be a "Meeting". 
    //    Overrides "Large Team" because if you own it, you are leading it (High Energy).
    else if (isOwner && attendeeCount > 0) {
      targetColor = COLORS.BASIL;
      ruleMatched = "Owner (Leading)";
    }

    // 7. MAYBE -> Banana vs Lavender (Rule: "Small Group" vs "Global")
    else if (status === CalendarApp.GuestStatus.MAYBE) {
      if (attendeeCount >= LARGE_MEETING_THRESHOLD || matchesAny(title, KEYWORDS.GLOBAL)) {
        targetColor = COLORS.LAVENDER;
        ruleMatched = "Maybe (Large/Global)";
      } else {
        targetColor = COLORS.BANANA;
        ruleMatched = "Maybe (Small)";
      }
    }

    // 8. LARGE TEAM (Yes) -> Sage (Rule: "Global / Large Team")
    //    "We want these to be 'quiet'."
    else if (attendeeCount >= LARGE_MEETING_THRESHOLD || matchesAny(title, KEYWORDS.GLOBAL)) {
      targetColor = COLORS.SAGE;
      ruleMatched = "Large Team (Passive)";
    }

    // 9. STANDARD MEETING (Yes) -> Peacock (Rule: "Small Group / Direct Invitations")
    //    "Blue is the standard 'work' color."
    else if (status === CalendarApp.GuestStatus.YES || status === CalendarApp.GuestStatus.OWNER) {
      targetColor = COLORS.PEACOCK;
      ruleMatched = "Standard Meeting";
    }

    // 10. FALLBACK: SOLO TASKS (Owner, 0 Attendees) -> Peacock/Default
    else if (isOwner && attendeeCount === 0) {
      targetColor = COLORS.PEACOCK; 
      ruleMatched = "Solo Task (General)";
    }

    // --- APPLY CHANGES ---
    // Only call API if color is actually changing (Resource optimization)
    if (targetColor && event.getColor() !== targetColor) {
      try {
        event.setColor(targetColor);
        stats.updated++;
        stats.byCategory[ruleMatched] = (stats.byCategory[ruleMatched] || 0) + 1;
        console.log(`Updated: [${ruleMatched}] "${event.getTitle()}"`);
      } catch (e) {
        console.error(`Failed to update "${event.getTitle()}": ${e.message}`);
      }
    }
  });

  console.log("--- Execution Summary ---");
  console.log(`Total Events Scanned: ${stats.total}`);
  console.log(`Events Updated: ${stats.updated}`);
  console.log(`Breakdown:`, stats.byCategory);
  console.timeEnd(SCRIPT_NAME);
}

// Helper to check if text contains any keyword from the list
function matchesAny(text, keywordsArray) {
  if (!text || !keywordsArray) return false;
  return keywordsArray.some(keyword => text.includes(keyword));
}
