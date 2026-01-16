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
    BASIL: '10' // Green
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

    // Rule: Owner = Green
    if (event.isOwnedByMe()) {
      const currentColor = event.getColor();
      const targetColor = COLORS.BASIL;

      // Only update if not already green to save API quota
      if (currentColor !== targetColor) {
        try {
          event.setColor(targetColor);
          updatedCount++;
          console.log(`Updated: "${event.getTitle()}" -> Green`);
        } catch (e) {
          console.error(`Error updating "${event.getTitle()}": ${e.message}`);
        }
      }
    }
  });

  console.log(`Total updated: ${updatedCount}`);
  console.timeEnd(SCRIPT_NAME);
}
