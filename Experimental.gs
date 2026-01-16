/**
 * Experimental: Mark Conflicting Events (Unanswered Only)
 * 
 * Logic:
 * 1. Consider ALL non-declined events as identifying "Busy Time".
 * 2. Identify overlaps.
 * 3. If an event overlaps AND is "Unanswered" (needsAction) -> Color it GRAPHITE.
 */
function markConflicts() {
  const SCRIPT_NAME = 'Conflict Detector';
  console.time(SCRIPT_NAME);

  const DAYS_TO_LOOK_BACK = 7;
  const DAYS_TO_LOOK_AHEAD = 7;
  const COLORS = {
    GRAPHITE: '8' // Gray (Declined/Conflict)
  };

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  console.log(`Scanning for conflicts from ${startDate.toDateString()} to ${endDate.toDateString()}...`);

  // 1. Fetch Candidates (Standard API)
  const allEvents = calendar.getEvents(startDate, endDate);
  const myEmail = Session.getActiveUser().getEmail();
  
  // 2. Filter for "Time Blockers" (Anything NOT Declined)
  // We need to know who is "blocking" the slot.
  const validEvents = allEvents.filter(function(e) {
    if (e.isAllDayEvent()) return false;
    const status = e.getMyStatus();
    return status !== CalendarApp.GuestStatus.NO;
  });

  // 3. Sort by Start Time
  validEvents.sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

  const conflictingEventIds = new Set();

  // 4. Detect Overlaps
  for (let i = 0; i < validEvents.length; i++) {
    const current = validEvents[i];
    const currentStart = current.getStartTime().getTime();
    const currentEnd = current.getEndTime().getTime();

    // Look ahead for overlaps
    for (let j = i + 1; j < validEvents.length; j++) {
      const next = validEvents[j];
      const nextStart = next.getStartTime().getTime();

      // If next event starts after current ends, no overlap possible (due to sorting)
      if (nextStart >= currentEnd) break;

      // Conflict Found!
      conflictingEventIds.add(current.getId());
      conflictingEventIds.add(next.getId());
      
      // console.log(`Conflict: "${current.getTitle()}" vs "${next.getTitle()}"`);
    }
  }

  console.log(`Found ${conflictingEventIds.size} events involved in conflicts.`);

  // 5. Apply Color ONLY to "needsAction" events
  let updatedCount = 0;
  validEvents.forEach(function(e) {
    // Check if it is involved in a conflict
    if (conflictingEventIds.has(e.getId())) {
      const status = e.getMyStatus();
      
      // TARGET: Only 'needsAction' (INVITED)
      // Note: getMyStatus() returns 'INVITED' for needsAction usually, or 'YES'/'NO'/'MAYBE'/'OWNER'
      if (status === CalendarApp.GuestStatus.INVITED) { 
        if (e.getColor() !== COLORS.GRAPHITE) {
          try {
            e.setColor(COLORS.GRAPHITE);
            updatedCount++;
            console.log(`Marked Conflict (Unanswered): "${e.getTitle()}"`);
          } catch (err) {
            console.error(`Failed to update "${e.getTitle()}": ${err.message}`);
          }
        }
      }
    }
  });

  console.log(`Updated ${updatedCount} unanswered conflicting events.`);
  console.timeEnd(SCRIPT_NAME);
}
