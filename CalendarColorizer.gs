/**
 * Fast Calendar Colorizer (Batch Mode)
 * 
 * Performance:
 * - Uses Advanced Calendar Service (Calendar API v3) for fetching and patching.
 * - Processing: In-memory.
 * - Updates: Sent in a single 'multipart/mixed' batch request.
 */

function colorizeCalendar() {
  const SCRIPT_NAME = 'Fast Calendar Colorizer';
  console.time(SCRIPT_NAME);

  // --- CONFIGURATION ---
  const DAYS_TO_LOOK_BACK = 7; 
  const DAYS_TO_LOOK_AHEAD = 7; 
  const CALENDAR_ID = 'primary';

  const COLORS = {
    BASIL: '10',    // Green (Owner)
    SAGE: '2',      // Light Green (Accepted)
    FLAMINGO: '4'   // Light Red (Declined)
  };

  // --- 1. FETCH EVENTS (API v3) ---
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - DAYS_TO_LOOK_BACK);
  const endDate = new Date();
  endDate.setDate(now.getDate() + DAYS_TO_LOOK_AHEAD);

  const optionalArgs = {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false
  };

  console.log(`Scanning [${startDate.toISOString()}] to [${endDate.toISOString()}]...`);
  
  // Use Advanced Service for speed (returns JSON, not heavy Objects)
  let items = [];
  try {
    const response = Calendar.Events.list(CALENDAR_ID, optionalArgs);
    items = response.items || [];
  } catch (e) {
    console.error(`Status: Failed to fetch events. Ensure 'Calendar' service is enabled in appsscript.json. Error: ${e.message}`);
    return;
  }
  
  console.log(`Found ${items.length} events.`);

  // --- 2. COMPUTE UPDATES (In-Memory) ---
  const batchRequests = [];
  const myEmail = Session.getActiveUser().getEmail();

  items.forEach(function(event) {
    if (event.start.date) return; // Skip all-day events if preferred (start.date exists for all-day)

    const title = event.summary || "";
    let status = "needsAction"; 
    let isOwner = false;

    // Determine Status & Ownership from JSON
    if (event.organizer && (event.organizer.email === myEmail || event.organizer.self)) {
        isOwner = true;
    }
    
    // Find my response status
    if (event.attendees) {
      const me = event.attendees.find(a => a.email === myEmail || a.self);
      if (me) status = me.responseStatus; // 'accepted', 'declined', 'needsAction', 'tentative'
    } else if (isOwner) {
      status = 'accepted'; // Owner usually implies accepted unless stated otherwise
    }

    // Determine Target Color
    let targetColor = "";
    
    // Rule 1: Declined -> Light Red (Flamingo)
    if (status === 'declined') {
      targetColor = COLORS.FLAMINGO;
    }
    // Rule 2: Owner -> Green (Basil)
    else if (isOwner) {
      targetColor = COLORS.BASIL;
    }
    // Rule 3: Accepted (Yes) -> Light Green (Sage)
    else if (status === 'accepted') {
      targetColor = COLORS.SAGE;
    }

    // Check if Update Needed
    // Event color might be undefined if default, 'colorId' field
    if (targetColor && event.colorId !== targetColor) {
        // Construct Batch Request Entry
        batchRequests.push({
            method: 'PATCH',
            endpoint: `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${event.id}`,
            body: { colorId: targetColor }
        });
        console.log(`Queue Update: "${title}" -> ${targetColor} (${isOwner ? 'Owner' : status})`);
    }
  });

  // --- 3. EXECUTE BATCH ---
  if (batchRequests.length > 0) {
    console.log(`Sending ${batchRequests.length} updates in batch...`);
    runBatch(batchRequests);
  } else {
    console.log("No updates needed.");
  }

  console.timeEnd(SCRIPT_NAME);
}

/**
 * Executes a batch of HTTP requests using multipart/mixed
 * @param {Array} requests - Array of {method, endpoint, body}
 */
function runBatch(requests) {
  const boundary = "BATCH_BOUNDARY";
  let payload = "";

  requests.forEach((req, index) => {
    payload += `--${boundary}\r\n`;
    payload += `Content-Type: application/http\r\n`;
    payload += `Content-ID: ${index}\r\n\r\n`;
    payload += `${req.method} ${req.endpoint}\r\n`;
    payload += `Content-Type: application/json\r\n\r\n`;
    payload += `${JSON.stringify(req.body)}\r\n\r\n`;
  });
  payload += `--${boundary}--`;

  const params = {
    method: "post",
    contentType: `multipart/mixed; boundary=${boundary}`,
    payload: payload,
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch("https://www.googleapis.com/batch/calendar/v3", params);
    console.log(`Batch Response Code: ${response.getResponseCode()}`);
    // console.log(response.getContentText()); // Debug if needed
  } catch (e) {
    console.error(`Batch Failed: ${e.message}`);
  }
}
