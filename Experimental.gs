/**
 * Experimental: Mark Conflicting Events
 * 
 * Logic:
 * 1. Find all "Accepted" or "Owner" events.
 * 2. Sort by Start Time.
 * 3. Identify overlaps (Double bookings).
 * 4. Color overlapping events GRAPHITE (Gray).
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

  // 1. Fetch Candidates (Standard API is fine for this)
  const allEvents = calendar.getEvents(startDate, endDate);
  
  // 2. Filter for Active Events (Accepted or Owned)
  const activeEvents = allEvents.filter(function(e) {
    if (e.isAllDayEvent()) return false;
    const status = e.getMyStatus();
    // GuestStatus.YES or OWNER (and usually OWNER implies YES unless explicitly NO, but let's stick to API)
    return status === CalendarApp.GuestStatus.YES || status === CalendarApp.GuestStatus.OWNER;
  });

  // 3. Sort by Start Time
  activeEvents.sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

  const conflictingEventIds = new Set();

  // 4. Detect Overlaps
  for (let i = 0; i < activeEvents.length; i++) {
    const current = activeEvents[i];
    const currentStart = current.getStartTime().getTime();
    const currentEnd = current.getEndTime().getTime();

    // Look ahead for overlaps
    for (let j = i + 1; j < activeEvents.length; j++) {
      const next = activeEvents[j];
      const nextStart = next.getStartTime().getTime();

      // If next event starts after current ends, no overlap possible (due to sorting)
      if (nextStart >= currentEnd) break;

      // Conflict Found!
      conflictingEventIds.add(current.getId());
      conflictingEventIds.add(next.getId());
      
      console.log(`Conflict found: "${current.getTitle()}" vs "${next.getTitle()}"`);
    }
  }

  console.log(`Found ${conflictingEventIds.size} conflicting events.`);

  // 5. Apply Color
  let updatedCount = 0;
  activeEvents.forEach(function(e) {
    if (conflictingEventIds.has(e.getId())) {
      if (e.getColor() !== COLORS.GRAPHITE) {
        try {
          e.setColor(COLORS.GRAPHITE);
          updatedCount++;
          console.log(`Marked as Conflict (Gray): "${e.getTitle()}"`);
        } catch (err) {
          console.error(`Failed to update "${e.getTitle()}": ${err.message}`);
        }
      }
    }
  });

  console.log(`Updated ${updatedCount} events to Graphite.`);
  console.timeEnd(SCRIPT_NAME);
}
