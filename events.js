console.log('Script started');

// Airtable API configuration
const baseId = 'appsBnDRCFoxPDsyI';
const tableIdOrName = 'tblQMJ6cWx0tyynFi';
const apiKey = 'patRI54IrJU8I3IwQ.517f3355e2ea531f5b714f2926f4d5f92f41c3a6e07fb296e9f1fec5ea8ddb7b';

function waitForAirtable(callback) {
  console.log('Checking for Airtable...');
  if (typeof Airtable !== 'undefined') {
    console.log('Airtable found!');
    callback();
  } else {
    console.log('Airtable not found, retrying...');
    setTimeout(() => waitForAirtable(callback), 100);
  }
}

waitForAirtable(() => {
  console.log('Airtable library loaded');

  // Function to fetch all records
  async function fetchRecords() {
    const url = `https://api.airtable.com/v0/${baseId}/${tableIdOrName}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched records:', data);
      return data.records;
    } catch (error) {
      console.error('Error fetching records:', error);
      return [];
    }
  }

  // Function to fetch a single record
  async function fetchSingleRecord(recordId) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableIdOrName}/${recordId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched single record:', data);
      return data;
    } catch (error) {
      console.error('Error fetching single record:', error);
      return null;
    }
  }

  // Function to display events
  function displayEvents(events) {
    console.log('Displaying events:', events);
    const eventsContainer = document.getElementById('events-container');
    if (!eventsContainer) {
      console.error('Events container not found!');
      return;
    }
    eventsContainer.innerHTML = '';

    events.forEach((event) => {
      const eventElement = document.createElement('div');
      eventElement.classList.add('event-item');
      
      const date = new Date(event.fields.Date);
      
      eventElement.innerHTML = `
        <div class="event-date">
          <span class="day">${date.getDate()}</span>
          <span class="month">${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}</span>
        </div>
        <div class="event-details">
          <h3>${event.fields['Event Name']}</h3>
          <p class="location">${event.fields.Location || 'No location specified'}</p>
          <p class="description">${event.fields.Description || 'No description available'}</p>
        </div>
        <button class="save-spot" data-id="${event.id}">Save my spot</button>
      `;
      
      eventsContainer.appendChild(eventElement);
    });

    // Add event listeners to buttons
    document.querySelectorAll('.save-spot').forEach(button => {
      button.addEventListener('click', function() {
        const recordId = this.getAttribute('data-id');
        fetchSingleRecord(recordId).then(record => {
          if (record) {
            alert(`Saved spot for: ${record.fields['Event Name']}`);
          }
        });
      });
    });
  }

  // Fetch and display events
  fetchRecords()
    .then(events => {
      console.log('Events fetched successfully:', events);
      displayEvents(events);
    })
    .catch(error => {
      console.error('Error in fetching or displaying events:', error);
    });
});

console.log('Script execution completed');