function inspectEvent() {
  const eventId = 'hms4p1s6fp0ggmkqpp3e254ftg';
  const calendarId = 'primary';
  
  try {
    const event = Calendar.Events.get(calendarId, eventId);
    console.log(JSON.stringify(event, null, 2));
    
    // Check our logic
    const myEmail = Session.getActiveUser().getEmail();
    let status = "needsAction";
    if (event.attendees) {
      const me = event.attendees.find(a => a.email === myEmail || a.self);
      if (me) status = me.responseStatus;
      console.log("Found me:", me);
    } else {
      console.log("No attendees list found.");
    }
    
    console.log("attendeesOmitted:", event.attendeesOmitted);
    console.log("Calculated Status:", status);
    
  } catch (e) {
    console.error(e.message);
  }
}
