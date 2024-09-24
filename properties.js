
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
    newLoader.style.width = '100px';  // Reduced from 200px
    newLoader.style.height = '100px'; // Reduced from 200px
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
    path: 'https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/66f2b5fe696715c9eda11f75_lottieflow-loading-03-000000-easey.json'
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
  if (roomDetails && roomDetails.amenities && roomDetails.amenities.sleeping) {
      return roomDetails.amenities.sleeping
          .filter(bed => bed.name.includes('Bed') && bed.name !== 'SleepingBedLinen')
          .map(bed => bed.text)
          .join('<br>');
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
      console.log('All listings active status:', data.items.map(item => item.is_active));
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
    console.log(`Room details for property ${propertyId}:`, JSON.stringify(data, null, 2));
    return null;
  }
}


function createListingElement(listing) {
  const template = document.createElement('div');
  template.className = 'rental-item w-dyn-item';
  template.innerHTML = `
      <div class="rental-card">
          <a href="https://book.a1abeachvacay.com/en/${(listing.name || '').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9\-]/g, '')}" class="rental-card w-inline-block">
              <div class="card-top-2">
                  <div class="room-quick-info">
                      <div class="intro-card-stats">
                          <!-- Placeholder stats -->
                      </div>
                  </div>
                  <img width="424.5487365722656" height="350" alt="" data-src="${listing.image_url || ''}" class="rental-image-2 static" loading="lazy">
              </div>
              <div class="card-info-3">
                  <!-- Placeholder info -->
              </div>
          </a>
      </div>
  `;
  return template;
}
function populateListingData(element, listing, roomDetails) {
  const nameElement = element.querySelector('.property-name');
  if (nameElement) nameElement.textContent = listing.name || 'Unnamed Property';

  const imageElement = element.querySelector('.rental-image-2');
  if (imageElement) {
      imageElement.src = imageElement.dataset.src;
      imageElement.removeAttribute('data-src');
  }

  // Populate other data fields
  const statsContainer = element.querySelector('.intro-card-stats');
  if (statsContainer) {
      statsContainer.innerHTML = `
          <div class="frame-28">
              <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7638b39a76c3b5fdbb_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
              <div class="text-5">${roomDetails.max_people || 'N/A'}</div>
          </div>
          <div class="frame-28">
              <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf7770b87ba339afa01f_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
              <div class="text-5">${roomDetails?.bedrooms || listing.bedrooms || 'N/A'}</div>
          </div>
          <div class="frame-28">
              <img width="10" height="10" alt="" src="https://cdn.prod.website-files.com/64c3fe68c106f4a98d188386/64daaf78cadfc271a34a9e06_Vectors-Wrapper.svg" loading="lazy" class="vector-icon">
              <div class="text-5">${roomDetails?.beds || listing.bedrooms || 'N/A'}</div>
          </div>
      `;
  }

  const cardInfo = element.querySelector('.card-info-3');
  if (cardInfo) {
      cardInfo.innerHTML = `
          <div class="frame-29">
              <div class="frame-30">
                  <h2 class="property-name truncate">${listing.name || 'Unnamed Property'}</h2>
              </div>
              <div class="specs-wrapper">
                  <div class="w-layout-hflex">
                      <div class="guests-bed-bath-icon number">${roomDetails.max_people || 'N/A'}</div>
                      <div class="guests-bed-bath-icon">Guests</div>
                  </div>
                  <div class="w-layout-hflex">
                      <div class="guests-bed-bath-icon number">${roomDetails?.bedrooms || listing.bedrooms || 'N/A'}</div>
                      <div class="guests-bed-bath-icon">Bedrooms</div>
                  </div>
                  <div class="w-layout-hflex">
                      <div class="guests-bed-bath-icon number"><span class="bed-list">${formatSleepingInfo(roomDetails)}</span></div>
                  </div>
                  <div class="w-layout-hflex">
                      <div class="guests-bed-bath-icon number">${roomDetails?.bathrooms || listing.bathrooms || 'N/A'}</div>
                      <div class="guests-bed-bath-icon">Bathrooms</div>
                  </div>
              </div>
          </div>
          <div class="intro-card-price">
              <div class="price-text">$</div>
<div class="price-text">
                  ${listing.min_price && listing.price_unit_in_days
                      ? Math.round(listing.min_price * listing.price_unit_in_days)
                      : 'N/A'}
              </div>              <div class="price-text unit-text">/night</div>
          </div>
      `;
  }

  const petFriendlyContainer = element.querySelector('.pet-friendly-container');
  if (petFriendlyContainer) {
      petFriendlyContainer.style.display = roomDetails?.pets_allowed ? 'block' : 'none';
  }

  console.log('Populated data for listing:', listing.id);
}

async function populateListings() {
  console.log('Populating listings...');
  showLoader();

  const listings = await fetchListingsFromLodgify();
  const shortTermContainer = document.getElementById('w-tabs-0-data-w-pane-0');
  const extendedStayContainer = document.getElementById('w-tabs-0-data-w-pane-1');
  
  if (!shortTermContainer || !extendedStayContainer) {
    console.error('One or both listings containers not found');
    hideLoader();
    return;
  }

  shortTermContainer.innerHTML = ''; // Clear existing content
  extendedStayContainer.innerHTML = ''; // Clear existing content
  shortTermContainer.style.opacity = '0'; // Hide the container
  extendedStayContainer.style.opacity = '0'; // Hide the container

  if (listings.length > 0) {
    console.log(`Sorting ${listings.length} listings`);
    
    const shortTermListings = listings.filter(listing => listing.price_unit_in_days < 30);
    const extendedStayListings = listings.filter(listing => listing.price_unit_in_days >= 30);

    await populateListingsContainer(shortTermContainer, shortTermListings);
    await populateListingsContainer(extendedStayContainer, extendedStayListings);

    shortTermContainer.style.opacity = '1';
    extendedStayContainer.style.opacity = '1';
    shortTermContainer.style.transition = 'opacity 0.5s ease-in-out';
    extendedStayContainer.style.transition = 'opacity 0.5s ease-in-out';
  } else {
    console.log('No active listings found');
    shortTermContainer.innerHTML = '<p>No short-term listings available at the moment. Please check back later.</p>';
    extendedStayContainer.innerHTML = '<p>No extended stay listings available at the moment. Please check back later.</p>';
    shortTermContainer.style.opacity = '1';
    extendedStayContainer.style.opacity = '1';
  }

  hideLoader();
}

async function populateListingsContainer(container, listings) {
  const fragment = document.createDocumentFragment();
  listings.forEach(listing => {
    const listingElement = createListingElement(listing);
    listingElement.style.opacity = '0'; // Start hidden
    fragment.appendChild(listingElement);
  });
  
  container.appendChild(fragment);

  const batchSize = 6;
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    await Promise.all(batch.map(async (listing, index) => {
      const roomDetails = await fetchRoomDetails(listing.id);
      populateListingData(container.children[i + index], listing, roomDetails);
    }));

    // Fade in this batch
    for (let j = i; j < i + batchSize && j < listings.length; j++) {
      container.children[j].style.opacity = '1';
      container.children[j].style.transition = 'opacity 0.3s ease-in-out';
    }
  }
}


  listingsContainer.innerHTML = ''; // Clear existing content
    listingsContainer.style.opacity = '0'; // Hide the container

    if (listings.length > 0) {
        console.log(`Populating ${listings.length} active listings`);
        
        // Pre-build HTML structure for all listings
        const fragment = document.createDocumentFragment();
        listings.forEach(listing => {
            const listingElement = createListingElement(listing);
            listingElement.style.opacity = '0'; // Start hidden
            fragment.appendChild(listingElement);
        });
        
        listingsContainer.appendChild(fragment);

        // Fetch room details and populate data
        const batchSize = 6;
        for (let i = 0; i < listings.length; i += batchSize) {
            const batch = listings.slice(i, i + batchSize);
            await Promise.all(batch.map(async (listing, index) => {
                const roomDetails = await fetchRoomDetails(listing.id);
                populateListingData(listingsContainer.children[i + index], listing, roomDetails);
            }));

            // Fade in this batch
            if (i === 0) {
                listingsContainer.style.opacity = '1';
                listingsContainer.style.transition = 'opacity 0.5s ease-in-out';
            }
            for (let j = i; j < i + batchSize && j < listings.length; j++) {
                listingsContainer.children[j].style.opacity = '1';
                listingsContainer.children[j].style.transition = 'opacity 0.3s ease-in-out';
            }

            if (i + batchSize >= listings.length) {
                console.log('Finished populating all listings.');
            }
        }
    } else {
        console.log('No active listings found');
        listingsContainer.innerHTML = '<p>No active listings available at the moment. Please check back later.</p>';
        listingsContainer.style.opacity = '1';
    }

    hideLoader();
}


function lazyLoadImages() {
  const images = document.querySelectorAll('img[data-src]');
  const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
          if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
          }
      });
  }, options);

  images.forEach(img => observer.observe(img));
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  populateListings();
  lazyLoadImages();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  populateListings();
  lazyLoadImages();
}