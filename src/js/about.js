/**
 * scripts/about.js
 * 
 * Purpose:
 *   - Dynamic About page supporting both "store" and "paddling" modes
 *   - Loads appropriate content and images based on mode
 *   - For paddling mode: fetches random lakes from paddlingOut API
 *   - For store mode: uses existing testimonials and content
 */

// Detect mode from URL parameter or default to paddling for new homepage structure
const urlParams = new URLSearchParams(window.location.search);
const pageMode = urlParams.get('mode') || 'paddling'; // Default to paddling since it's now our main focus

/**
 * Content configurations for different modes
 */
const pageContent = {
  store: {
    title: "Kaayko: About",
    subtitle: "Our Mission, Your Money", 
    mainHeading: "About Kaayko",
    description: "Learn about Kaayko: apparel that accurately represents your thoughts. Discover our vision and exclusive designs.",
    heroText: "Kaayko represents the intersection of thoughtful design and authentic expression. Every piece in our collection is crafted to reflect your unique perspective.",
    founderTitle: "A Message from Our Founder",
    founderMessage: "Kaayko started as a simple idea: what if clothing could be as unique and complex as the thoughts we carry? Today, we continue that mission by creating pieces that don't just look good—they feel authentic to who you are.",
    imageSource: 'testimonials' // Use testimonial avatars
  },
  paddling: {
    title: "Kaayko: Paddling Out",
    subtitle: "Not easy, but pretty",
    mainHeading: "About Paddling Out",
    description: "Discover Kaayko's intelligent paddle condition forecasts with ML-powered safety ratings. Know before you go paddling with Konfidence!",
    heroText: "Paddling Out combines advanced machine learning with real-time weather data to provide accurate paddle condition forecasts. Our mission is to help you paddle with confidence.",
    founderTitle: "A Message from Our Founder", 
    founderMessage: "Water calls to us in ways we barely understand. Paddling Out is our attempt to bridge the gap between passion and preparation, using technology to help you connect safely with the waters you love.",
    imageSource: 'lakes' // Use lake images from API
  }
};

/**
 * Initialize page content based on mode
 */
function initializeAboutPage() {
  const content = pageContent[pageMode];
  
  // Update page title and meta
  document.title = content.title;
  document.querySelector('meta[name="description"]').setAttribute('content', content.description);
  
  // Update header content
  const headerTitle = document.querySelector('.header-title');
  const headerSubtitle = document.querySelector('.header-subtitle');
  if (headerTitle) headerTitle.textContent = content.title;
  if (headerSubtitle) headerSubtitle.textContent = content.subtitle;
  
  // Update main content
  updateMainContent(content);
  
  // Load appropriate images
  if (content.imageSource === 'lakes') {
    loadRandomLakeImages();
  } else {
    loadTestimonialAvatars();
  }
}

/**
 * Update main content sections
 */
function updateMainContent(content) {
  const mainSection = document.querySelector('main');
  if (!mainSection) return;
  
  mainSection.innerHTML = `
    <section class="about-hero">
      <h1>${content.mainHeading}</h1>
      <p class="hero-description">${content.heroText}</p>
    </section>
    
    <section class="image-showcase">
      <div class="image-grid" id="dynamicImageGrid">
        <!-- Images will be loaded dynamically here -->
      </div>
    </section>
    
    <section class="founder-message">
      <h2>${content.founderTitle}</h2>
      <p>${content.founderMessage}</p>
    </section>
  `;
}

/**
 * Load random lake images from paddling API
 */
async function loadRandomLakeImages() {
  try {
    // Fetch lakes from the paddlingOut API
    const response = await fetch('/api/lakes'); // Assuming we have an endpoint that lists all lakes
    const lakes = await response.json();
    
    if (!lakes || lakes.length === 0) {
      console.warn('No lakes data available');
      return;
    }
    
    // Get 5 random unique lakes
    const shuffledLakes = shuffleArray([...lakes]);
    const selectedLakes = shuffledLakes.slice(0, 5);
    
    const imageGrid = document.getElementById('dynamicImageGrid');
    if (!imageGrid) return;
    
    imageGrid.innerHTML = selectedLakes.map(lake => `
      <div class="image-item">
        <img src="${lake.image || '/assets/default-lake.jpg'}" alt="${lake.name}" />
        <div class="image-caption">
          <strong>${lake.name}</strong>
          <span class="location">${lake.location}</span>
          <a href="/paddlingout.html?lake=${encodeURIComponent(lake.name)}" class="view-link">
            View Conditions
          </a>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading lake images:', error);
    // Fallback to placeholder images
    loadPlaceholderLakeImages();
  }
}

/**
 * Fallback lake images if API fails
 */
function loadPlaceholderLakeImages() {
  const placeholderLakes = [
    { name: "Ambazari Lake", location: "Nagpur, Maharashtra", image: "/assets/Nagpur_3.png" },
    { name: "Marine Drive", location: "Mumbai, Maharashtra", image: "/assets/AssaultBae_1.png" },
    { name: "Venna Lake", location: "Mahabaleshwar, Maharashtra", image: "/assets/Live_3.png" },
    { name: "Rankala Lake", location: "Kolhapur, Maharashtra", image: "/assets/StraightOutta_1.png" },
    { name: "Powai Lake", location: "Mumbai, Maharashtra", image: "/assets/ShutUp_1.png" }
  ];
  
  const imageGrid = document.getElementById('dynamicImageGrid');
  if (!imageGrid) return;
  
  imageGrid.innerHTML = placeholderLakes.map(lake => `
    <div class="image-item">
      <img src="${lake.image}" alt="${lake.name}" />
      <div class="image-caption">
        <strong>${lake.name}</strong>
        <span class="location">${lake.location}</span>
        <a href="/paddlingout.html?lake=${encodeURIComponent(lake.name)}" class="view-link">
          View Conditions
        </a>
      </div>
    </div>
  `).join('');
}
    /**
 * Load testimonial avatars for store mode
 */
function loadTestimonialAvatars() {
  const fakeTestimonials = [
    { name: "Alice Johnson", review: "Absolutely amazing quality and design. Kaayko never disappoints!" },
    { name: "Brian Smith", review: "I love the unique style and attention to detail. Highly recommend!" },
    { name: "Catherine Lee", review: "My journey from a Neanderthal to Narayan is complete only because I stumbled on Kaayko!" },
    { name: "David Kim", review: "A premium brand that deserves premium prices." },
    { name: "Emily Davis", review: "The products are as innovative as they are beautiful. Very impressed!" }
  ];
  
  const imageGrid = document.getElementById('dynamicImageGrid');
  if (!imageGrid) return;
  
  const avatarColors = ["#ff8c00", "#e63946", "#2a9d8f", "#264653", "#f4a261"];
  
  imageGrid.innerHTML = fakeTestimonials.map((testimonial, index) => `
    <div class="image-item">
      <div class="avatar-placeholder" style="background-color: ${avatarColors[index]}; width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
        <span style="font-size: 48px; color: white; font-weight: bold;">${testimonial.name.charAt(0)}</span>
      </div>
      <div class="image-caption">
        <strong>${testimonial.name}</strong>
        <span class="review">"${testimonial.review.substring(0, 50)}..."</span>
        <a href="/testimonials.html" class="view-link">
          Read More
        </a>
      </div>
    </div>
  `).join('');
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

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAboutPage);

// Export for legacy compatibility
export const fakeTestimonials = [
  { name: "Alice Johnson", review: "Absolutely amazing quality and design. Kaayko never disappoints!" },
  { name: "Brian Smith", review: "I love the unique style and attention to detail. Highly recommend!" },
  { name: "Catherine Lee", review: "My journey from a Neanderthal to Narayan is complete only because I stumbled on Kaayko!" },
  { name: "David Kim", review: "A premium brand that deserves premium prices." },
  { name: "Emily Davis", review: "The products are as innovative as they are beautiful. Very impressed!" }
];

/**
 * Shuffles an array in place using the Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
