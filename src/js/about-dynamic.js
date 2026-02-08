/**
 * Dynamic About Page Content System
 * Supports both store mode (default) and paddling mode (?mode=paddling)
 * Keeps the exact same layout and styling, only changes content
 */

// Store images (shirt designs)
const storeImages = [
  'assets/Lifeisopinion_2.png',
  'assets/AssaultBae_1.png', 
  'assets/Live_3.png',
  'assets/Nagpur_3.png',
  'assets/ShutUp_1.png',
  'assets/StraightOutta_1.png'
];

// Content configurations
const pageContent = {
  store: {
    title: 'Welcome to Kaayko',
    subtitle: 'You deserve it',
    content: `Kaayko offers a chance to wear your beliefs.<br>
              Kaayko will turn heads, spark conversations.<br><br>
              As Seagulls squawk nearby—<br>
              Shoo them away with style<br><br>
              Cloak yourself in Clarity.<br>
              Delegate your beliefs to Kaayko.<br><br>
              Vote now for the fashion of tomorrow.<br>`,
    collageImages: [
      { src: 'assets/Lifeisopinion_2.png', alt: 'Life is Opinion Shirt Design' },
      { src: 'assets/AssaultBae_1.png', alt: 'Assault Bae Shirt Design' },
      { src: 'assets/Live_3.png', alt: 'Live Shirt Design' },
      { src: 'assets/Nagpur_3.png', alt: 'Nagpur Shirt Design' },
      { src: 'assets/ShutUp_1.png', alt: 'Shut Up Shirt Design' },
      { src: 'assets/StraightOutta_1.png', alt: 'Straight Outta Shirt Design' }
    ]
  },
  paddling: {
    title: 'Welcome to Kaayko Paddle',
    subtitle: 'Where waters meet wisdom',
    content: `Kaayko Paddle offers real-time lake conditions.<br>
              Know before you go, paddle with confidence.<br><br>
              As lake winds whisper—<br>
              Navigate with knowledge<br><br>
              Embrace the currents.<br>
              Let Kaayko guide your journey.<br><br>
              Your next great paddle awaits.<br>`,
    collageImages: [] // Will be populated with real lake images from API
  }
};

/**
 * Fetch lake images from the paddling API
 */
async function fetchLakeImages() {
  try {
    // Use the correct API endpoint from paddlingout.js
    const _aboutApiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://127.0.0.1:5001/kaaykostore/us-central1/api'
      : 'https://api-vwcc5j4qda-uc.a.run.app';
    const response = await fetch(`${_aboutApiBase}/paddlingOut`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch lake data');
    }
    
    const lakes = await response.json();
    
    // Extract images from the lake data
    const lakeImages = [];
    
    if (Array.isArray(lakes)) {
      lakes.forEach(lake => {
        // Each lake has an imgSrc array, take the first image from each lake
        if (lake.imgSrc && Array.isArray(lake.imgSrc) && lake.imgSrc.length > 0) {
          lakeImages.push({
            src: lake.imgSrc[0], // Take the first image
            alt: `${lake.title} - ${lake.subtitle}`
          });
        }
      });
    }
    
    // If we don't have enough unique images, add more from same lakes
    if (lakeImages.length < 6) {
      lakes.forEach(lake => {
        if (lake.imgSrc && Array.isArray(lake.imgSrc)) {
          // Add additional images from the same lakes
          for (let i = 1; i < lake.imgSrc.length && lakeImages.length < 12; i++) {
            lakeImages.push({
              src: lake.imgSrc[i],
              alt: `${lake.title} - ${lake.subtitle} (View ${i + 1})`
            });
          }
        }
      });
    }
    
    // Return 6 random lake images
    return shuffleArray(lakeImages).slice(0, 6);
    
  } catch (error) {
    console.error('Error fetching lake images:', error);
    return getFallbackLakeImages();
  }
}

/**
 * Get fallback lake images if API fails
 */
function getFallbackLakeImages() {
  // Use store images as fallback but with lake-themed alt text
  return storeImages.map((src, index) => ({
    src,
    alt: `Lake View ${index + 1} - Scenic Paddle Destination`
  }));
}

/**
 * Detect current mode from URL
 */
function getCurrentMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  // Default to paddling mode instead of store mode
  return (mode === 'store') ? 'store' : 'paddling';
}

/**
 * Update page content based on mode
 */
async function updatePageContent() {
  const mode = getCurrentMode();
  const content = pageContent[mode];
  
  // If paddling mode, fetch real lake images
  if (mode === 'paddling') {
    content.collageImages = await fetchLakeImages();
  }
  
  // Update title and subtitle
  const titleElement = document.querySelector('.about-text h2');
  const subtitleElement = document.querySelector('.about-text h3');
  const contentElement = document.querySelector('.about-text p');
  
  if (titleElement) titleElement.textContent = content.title;
  if (subtitleElement) subtitleElement.textContent = content.subtitle;
  if (contentElement) contentElement.innerHTML = content.content;
  
  // Update collage images
  const collageSlices = document.querySelectorAll('.collage-slice img');
  content.collageImages.forEach((image, index) => {
    if (collageSlices[index]) {
      collageSlices[index].src = image.src;
      collageSlices[index].alt = image.alt;
    }
  });
  
  // Update page title
  document.title = mode === 'paddling' ? 'Kaayko | Paddle Conditions' : 'Kaayko | About';
  
  // Update header title
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.textContent = mode === 'paddling' ? 'Kaayko: Paddle' : 'Kaayko: About';
  }
  
  // Update header subtitle
  const headerSubtitle = document.querySelector('.header-subtitle');
  if (headerSubtitle) {
    headerSubtitle.textContent = mode === 'paddling' ? 'Know Before You Go' : 'Our Mission, Your Money';
  }
}

/**
 * Utility function to shuffle array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', updatePageContent);
