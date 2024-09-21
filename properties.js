// Updated Lodgify API Integration with Room Details Fetch

const LODGIFY_API_KEY = 'wjexqnx5cj/YxHu8K9aSgQxR6+/1echUQQyh8sSNuxfAN/pDBAIFgyaoxkBDExgW';
const LODGIFY_PROPERTIES_ENDPOINT = 'https://api.lodgify.com/v2/properties?wid=410037&includeCount=false&includeInOut=false&page=1&size=50';
const LODGIFY_ROOMS_ENDPOINT = 'https://api.lodgify.com/v2/properties/';


let loadingAnimation;

function showLoader() {
    const loaderContainer = document.getElementById('lottie-loader');
    if (!loaderContainer) {
      console.error('Loader container not found. Creating one...');
      const newLoader = document.createElement('div');
      newLoader.id = 'lottie-loader';
      newLoader.style.width = '200px';
      newLoader.style.height = '200px';
      newLoader.style.margin = 'auto';
      newLoader.style.position = 'fixed';
      newLoader.style.top = '50%';
      newLoader.style.left = '50%';
      newLoader.style.transform = 'translate(-50%, -50%)';
      newLoader.style.zIndex = '1000';
      document.body.appendChild(newLoader);
    }
    
    const updatedLoaderContainer = document.getElementById('lottie-loader');
    updatedLoaderContainer.style.display = 'block';
    loadingAnimation = lottie.loadAnimation({
      container: updatedLoaderContainer,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'https://assets3.lottiefiles.com/packages/lf20_usmfx6bp.json'
    });
  }

  function hideLoader() {
    const loaderContainer = document.getElementById('lottie-loader');
    if (loaderContainer) {
      loaderContainer.style.display = 'none';
      if (loadingAnimation) {
        loadingAnimation.destroy();
      }
    }
  }
  if (typeof lottie === 'undefined') {
    console.error('Lottie library not loaded. Please check your script inclusions.');
  }

function formatSleepingInfo(roomDetails) {
    if (roomDetails.amenities && roomDetails.amenities.sleeping) {
      return roomDetails.amenities.sleeping
        .filter(bed => bed.name.includes('Bed') && bed.name !== 'SleepingBedLinen')
        .map(bed => bed.text)
        .join('<br>'); // Use <br> for line breaks in HTML
    }
    return 'N/A';
  }
  
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
      // Filter active listings
      const activeListings = data.items.filter(listing => listing.is_active === true);
      console.log('Active listings:', activeListings.length);
      return activeListings;
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
  console.log(`Room details for property ${propertyId}:`, JSON.stringify(data, null, 2));
}

function createListingElement(property, roomDetails) {
  console.log('Creating listing element for:', property);
  const template = document.createElement('div');
  template.className = 'rental-item w-dyn-item';
  
  template.innerHTML = `
    <div class="rental-card">
      <a href="https://book.a1abeachvacay.com/en/${(property.name || '').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9\-]/g, '')}" class="rental-card w-inline-block">
        <div class="card-top-2">
          <div class="room-quick-info">
            <div class="intro-card-stats">
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7638b39a76c3b5fdbb_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails.max_people || 'N/A'}</div>
              </div>
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7770b87ba339afa01f_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails?.bedrooms || property.bedrooms || 'N/A'}</div>
              </div>
              <div class="frame-28">
                <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf78cadfc271a34a9e06_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
                <div class="text-5">${roomDetails?.beds || property.bedrooms || 'N/A'}</div>
              </div>
            </div>
          </div>
          <img width="424.5487365722656" height="350" alt="" src="${property.image_url || ''}" loading="lazy" class="rental-image-2 static">
          <!-- Pet Friendly Animation Container -->
        <div class="pet-friendly-container">
        ${roomDetails?.pets_allowed || 'N/A'}
        <lottie-player
            src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/6524583ac4f1a7a09822ef94_Pet%20Friendly%20(3).lottie"
            background="transparent"
            speed="1"
            loop
            autoplay
            style="width: 50px; height: 50px;"
        ></lottie-player>
        <div class="text-block-2">Pet Friendly</div>
        </div>

        </div>
        <div class="card-info-3">
          <div class="frame-29">
            <div class="frame-30">
              <h2 class="property-name truncate">${property.name || 'Unnamed Property'}</h2>
              <div class="property-type">${property.name || ''}</div>
            </div>
            <div class="specs-wrapper">
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.max_people || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Guests</div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.bedrooms || property.bedrooms || 'N/A'}</div>
                <div class="guests-bed-bath-icon">Bedrooms</div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number"><span class="bed-list">${formatSleepingInfo(roomDetails)}</span></div>
              </div>
              <div class="w-layout-hflex">
                <div class="guests-bed-bath-icon number">${roomDetails?.bathrooms || property.bathrooms || 'N/A'}</div>
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
  console.log('Property data:', JSON.stringify(property, null, 2));
  console.log('Room details:', JSON.stringify(roomDetails, null, 2));
  return template;



}

async function populateListings() {
    console.log('Populating listings...');
    showLoader(); // Show the loader before fetching listings
  
    const listings = await fetchListingsFromLodgify();
    
    const listingsContainer = document.getElementById('listings-container');
    if (!listingsContainer) {
      console.error('Listings container not found');
      hideLoader(); // Hide loader if there's an error
      return;
    }
  
    listingsContainer.innerHTML = '';
    if (listings.length > 0) {
      console.log(`Populating ${listings.length} active listings`);
      for (const listing of listings) {
        try {
          const roomDetails = await fetchRoomDetails(listing.id);
          const listingElement = createListingElement(listing, roomDetails);
          listingsContainer.appendChild(listingElement);
        } catch (error) {
          console.error('Error creating listing element:', error);
        }
      }
      console.log('Finished populating active listings.');
    } else {
      console.log('No active listings found');
      listingsContainer.innerHTML = '<p>No active listings available at the moment. Please check back later.</p>';
    }
  
    hideLoader(); // Hide the loader after all listings are processed
  }

// Call this function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    populateListings();
  });

// Additional check in case the script loads after DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  populateListings();
}

console.log('All listings active status:', data.items.map(item => item.is_active));