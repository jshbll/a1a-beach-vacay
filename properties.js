// Complete Lodgify API Integration Script for Webflow

const LODGIFY_API_KEY = 'wjexqnx5cj/YxHu8K9aSgQxR6+/1echUQQyh8sSNuxfAN/pDBAIFgyaoxkBDExgW';
const LODGIFY_PROPERTIES_ENDPOINT = 'https://api.lodgify.com/v2/properties?wid=410037&includeCount=false&includeInOut=false&page=1&size=50';

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed: ${error.message}`);
      if (i === maxRetries - 1) throw error;
    }
  }
}

async function fetchListingsFromLodgify() {
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-ApiKey': LODGIFY_API_KEY
    }
  };

  try {
    console.log('Fetching listings from Lodgify...');
    const data = await fetchWithRetry(LODGIFY_PROPERTIES_ENDPOINT, options);
    console.log('Fetched listings:', data);
    return data.items; // Assuming the listings are in an 'items' array
  } catch (error) {
    console.error('Error fetching listings from Lodgify:', error);
    return [];
  }
}

async function fetchRoomDetails(propertyId) {
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-ApiKey': LODGIFY_API_KEY
    }
  };

  try {
    const data = await fetchWithRetry(`${LODGIFY_ROOMS_ENDPOINT}${propertyId}/rooms`, options);
    console.log(`Fetched room details for property ${propertyId}:`, data);
    return data[0]; // Assuming we want the first room's details
  } catch (error) {
    console.error(`Error fetching room details for property ${propertyId}:`, error);
    return null;
  }
}

function createListingElement(property, roomDetails) {
  console.log('Creating listing element for:', property);
  const template = document.createElement('div');
  template.className = 'rental-item w-dyn-item';
  
  template.innerHTML = `
    <div class="rental-card">
      <a href="#" class="rental-card w-inline-block">
        <div class="card-top-2">
          <div class="room-quick-info">
            <div class="intro-card-stats">
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7638b39a76c3b5fdbb_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails?.capacity || 'N/A'}</div>
              </div>
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7770b87ba339afa01f_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails?.bedrooms || 'N/A'}</div>
              </div>
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf78cadfc271a34a9e06_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails?.beds || 'N/A'}</div>
              </div>
            </div>
          </div>
          <img width="424.5487365722656" height="350" alt="" src="${property.image_url || ''}" loading="lazy" class="rental-image-2 static">
        </div>
        <div class="card-info-3">
          <div class="frame-29">
            <div class="frame-30">
              <h2 class="property-name truncate">${property.name || 'Unnamed Property'}</h2>
              <div class="property-type">${property.name || ''}</div>
            </div>
            <div class="specs-wrapper">
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.capacity || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Guests</div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.bedrooms || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Bedrooms</div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.beds || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Beds</div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.bathrooms || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Bathrooms</div>
              </div>
            </div>
          </div>
          <div class="intro-card-price">
            <div class="price-text">$</div>
            <div class="price-text">${property.min_price ? Math.round(property.min_price) : 'N/A'}</div>
            <div class="price-text unit-text">/night</div>
          </div>
        </div>
      </a>
    </div>
  `;
  return template;
}

async function populateListings() {
  console.log('Populating listings...');
  const listings = await fetchListingsFromLodgify();
  
  const listingsContainer = document.getElementById('listings-container');
  if (!listingsContainer) {
    console.error('Listings container not found');
    return;
  }

  listingsContainer.innerHTML = '';
  if (listings.length > 0) {
    console.log(`Populating ${listings.length} listings`);
    listings.forEach(listing => {
      try {
        const listingElement = createListingElement(listing);
        listingsContainer.appendChild(listingElement);
      } catch (error) {
        console.error('Error creating listing element:', error);
      }
    });
    console.log('Finished populating listings.');
  } else {
    console.log('No listings found');
    listingsContainer.innerHTML = '<p>No listings available at the moment. Please check back later.</p>';
  }
}

// Initialize the script
function initializeLodgifyIntegration() {
  console.log('Initializing Lodgify integration...');
  populateListings();
}

// Call this function when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLodgifyIntegration);
} else {
  initializeLodgifyIntegration();
}