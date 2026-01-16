/**
 * Simple Calendar Colorizer
 * 
 * LOGIC:
 * 1. Look back 1 day, look ahead 2 days.
 * 2. If I own the event -> Color it GREEN (Basil).
 */

function colorizeCalendar() {
  const SCRIPT_NAME = 'Simple Calendar Colorizer';
  console.time(SCRIPT_NAME);

  // --- CONFIGURATION ---
  const DAYS_TO_LOOK_BACK = 7; 
  const DAYS_TO_LOOK_AHEAD = 7; 

  const COLORS = {
    BASIL: '10',    // Green (Owner)
    SAGE: '2',      // Light Green (Accepted)
    FLAMINGO: '4'   // Light Red (Declined)
  };

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  console.log(`Scanning from ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  const events = calendar.getEvents(startDate, endDate);
  let updatedCount = 0;

  events.forEach(function(event) {
    if (event.isAllDayEvent()) return;

    const status = event.getMyStatus();
    let targetColor = "";
    
    // Rule 1: Declined -> Light Red (Flamingo)
    // (Priority: If I said NO, it should look declined regardless of other factors)
    if (status === CalendarApp.GuestStatus.NO) {
      targetColor = COLORS.FLAMINGO;
    }
    // Rule 2: Owner -> Green (Basil)
    else if (event.isOwnedByMe()) {
      targetColor = COLORS.BASIL;
    }
    // Rule 3: Accepted (Yes) -> Light Green (Sage)
    else if (status === CalendarApp.GuestStatus.YES) {
      targetColor = COLORS.SAGE;
    }

    // Apply Change if needed
    if (targetColor) {
      const currentColor = event.getColor();
      
      // Only update if not matching target to save API quota
      if (currentColor !== targetColor) {
        try {
          event.setColor(targetColor);
          updatedCount++;
          console.log(`Updated: "${event.getTitle()}" -> ${targetColor === COLORS.BASIL ? 'Green' : (targetColor === COLORS.SAGE ? 'Light Green' : 'Light Red')}`);
        } catch (e) {
          console.error(`Error updating "${event.getTitle()}": ${e.message}`);
        }
      }
    }
  });

  console.log(`Total updated: ${updatedCount}`);
  console.timeEnd(SCRIPT_NAME);
}
