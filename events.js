console.log('Script started');

// Airtable API configuration
const baseId = 'appsBnDRCFoxPDsyI';
const tableIdOrName = 'tblQMJ6cWx0tyynFi';
const apiKey = 'patRI54IrJU8I3IwQ.517f3355e2ea531f5b714f2926f4d5f92f41c3a6e07fb296e9f1fec5ea8ddb7b';

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
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
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
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
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
  eventsContainer.innerHTML = ''; // Clear any existing content

  events.forEach((event) => {
    // Create the event item container
    const eventItem = document.createElement('div');
    eventItem.classList.add('event-header1_item');

    // Date Wrapper
    const dateWrapper = document.createElement('div');
    dateWrapper.classList.add('event-header1_date-wrapper');

    const date = new Date(event.fields.Date);

    // Day of the week
    const dayOfWeekDiv = document.createElement('div');
    dayOfWeekDiv.textContent = date.toLocaleDateString('default', { weekday: 'short' });

    // Day of the month (padded)
    const dayOfMonthDiv = document.createElement('div');
    dayOfMonthDiv.classList.add('heading-style-h4');
    dayOfMonthDiv.textContent = date.getDate().toString().padStart(2, '0');

    // Month and year
    const monthYearDiv = document.createElement('div');
    monthYearDiv.textContent = date.toLocaleDateString('default', { month: 'short', year: 'numeric' });

    // Assemble date wrapper
    dateWrapper.appendChild(dayOfWeekDiv);
    dateWrapper.appendChild(dayOfMonthDiv);
    dateWrapper.appendChild(monthYearDiv);

    // Event Content
    const eventContent = document.createElement('div');
    eventContent.classList.add('event-header1_item-content');

    // Event Content Top
    const eventContentTop = document.createElement('div');
    eventContentTop.classList.add('event-header1_item-content-top');

    // Event Title
    const eventTitleDiv = document.createElement('div');
    eventTitleDiv.classList.add('heading-style-h5');
    eventTitleDiv.textContent = event.fields['Event Name'] || 'Untitled Event';

    // Sold Out Status
    const isSoldOut = event.fields['Sold Out']; // Assuming this is a checkbox field
    if (isSoldOut) {
      const soldOutDiv = document.createElement('div');
      soldOutDiv.classList.add('tag');
      soldOutDiv.textContent = 'Sold out';
      eventContentTop.appendChild(soldOutDiv);
    }

    // Location
    const locationDiv = document.createElement('div');
    locationDiv.classList.add('text-size-small');
    locationDiv.textContent = event.fields.Location || 'No location specified';

    // Assemble event content top
    eventContentTop.appendChild(eventTitleDiv);
    if (isSoldOut) {
      eventContentTop.appendChild(soldOutDiv);
    }
    eventContentTop.appendChild(locationDiv);

    // Event Description
    const descriptionParagraph = document.createElement('p');
    descriptionParagraph.textContent = event.fields.Description || 'No description available';

    // Assemble event content
    eventContent.appendChild(eventContentTop);
    eventContent.appendChild(descriptionParagraph);

    // Button Group
    const buttonGroup = document.createElement('div');
    buttonGroup.classList.add('button-group');

    const saveSpotButton = document.createElement('a');
    saveSpotButton.href = '#';
    saveSpotButton.textContent = 'Save my spot';
    saveSpotButton.classList.add('button', '5', 'is-secondary', 'is-small');
    saveSpotButton.setAttribute('data-id', event.id);

    // Add event listener to the button
    saveSpotButton.addEventListener('click', function (e) {
      e.preventDefault();
      const recordId = this.getAttribute('data-id');
      fetchSingleRecord(recordId).then(record => {
        if (record) {
          alert(`Saved spot for: ${record.fields['Event Name']}`);
        }
      });
    });

    buttonGroup.appendChild(saveSpotButton);

    // Assemble event item
    eventItem.appendChild(dateWrapper);
    eventItem.appendChild(eventContent);
    eventItem.appendChild(buttonGroup);

    // Append event item to events container
    eventsContainer.appendChild(eventItem);
  });
}

// Fetch and display events
fetchRecords()
  .then(events => {
    console.log('Events fetched successfully:', events);

    // Get current date
const today = new Date();

// Filter out past events
events = events.filter(event => {
  const eventDate = new Date(event.fields.Date);
  return eventDate >= today;
});

// Then sort the events
events.sort((a, b) => {
  const dateA = new Date(a.fields.Date);
  const dateB = new Date(b.fields.Date);
  return dateA - dateB;
}); //ascending order

    displayEvents(events);
  })
  .catch(error => {
    console.error('Error in fetching or displaying events:', error);
  });

console.log('Script execution completed');