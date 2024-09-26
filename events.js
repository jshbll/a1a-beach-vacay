document.addEventListener('DOMContentLoaded', function() {
  if (typeof Airtable === 'undefined') {
    console.error('Airtable library not loaded');
    return;
  }

  function waitForAirtable(callback) {
    if (typeof Airtable !== 'undefined') {
      callback();
    } else {
      setTimeout(() => waitForAirtable(callback), 100);
    }
  }
  
  waitForAirtable(() => {
    console.log('Airtable library loaded');

    // Configure Airtable
    const base = new Airtable({apiKey: 'patRI54IrJU8I3IwQ.517f3355e2ea531f5b714f2926f4d5f92f41c3a6e07fb296e9f1fec5ea8ddb7b'}).base('appsBnDRCFoxPDsyI');

    // Function to fetch events
    async function fetchEvents() {
      try {
        const records = await base('Events').select().all();
        return records.map(record => record.fields);
      } catch (error) {
        console.error('Error fetching events:', error);
        return [];
      }
    }

    // Function to display events
    function displayEvents(events) {
      const eventsContainer = document.getElementById('events-container');
      eventsContainer.innerHTML = '';

      // Featured event (first event in the list)
      const featuredEvent = events[0];
      const featuredEventElement = createFeaturedEventElement(featuredEvent);
      eventsContainer.appendChild(featuredEventElement);

      // List of other events
      const eventList = document.createElement('div');
      eventList.classList.add('event-list');
      
      events.slice(1).forEach(event => {
        const eventElement = createEventListItem(event);
        eventList.appendChild(eventElement);
      });
      
      eventsContainer.appendChild(eventList);
    }

    function createFeaturedEventElement(event) {
      const element = document.createElement('div');
      element.classList.add('featured-event');
      
      const date = new Date(event.Date);
      const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      
      element.innerHTML = `
        <div class="event-date">
          <span class="day">${date.getDate()}</span>
          <span class="month">${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}</span>
        </div>
        <div class="event-image">
          <img src="${event.Photos ? event.Photos[0].url : 'placeholder-image.jpg'}" alt="${event['Event Name']}">
        </div>
        <div class="event-details">
          <span class="category">${event['Event Type']}</span>
          <h2>${event['Event Name']}</h2>
          <p class="location">${event.Location}</p>
          <p class="description">${event.Description}</p>
          <button class="save-spot">Save my spot</button>
        </div>
      `;
      
      return element;
    }

    function createEventListItem(event) {
      const element = document.createElement('div');
      element.classList.add('event-item');
      
      const date = new Date(event.Date);
      const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      
      element.innerHTML = `
        <div class="event-date">
          <span class="day">${date.getDate()}</span>
          <span class="month">${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}</span>
        </div>
        <div class="event-details">
          <h3>${event['Event Name']}</h3>
          <p class="location">${event.Location}</p>
          <p class="description">${event.Description}</p>
        </div>
        <button class="save-spot">Save my spot</button>
      `;
      
      return element;
    }

    // Fetch and display events
    fetchEvents().then(displayEvents);
});