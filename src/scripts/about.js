// scripts/about.js

/**
 * This module initializes the About modal.
 * It sets up tab switching between the "About" and "Testimonials" sections,
 * shuffles and populates the Testimonials tab with fake reviews,
 * and randomizes the avatar background colors for visual variety.
 */

/**
 * Array of possible avatar background colors for variety.
 */
const avatarColors = [
    "#ff8c00", // Professional orange
    "#e63946", // Red
    "#2a9d8f", // Teal
    "#264653", // Dark slate
    "#f4a261", // Light orange
    "#457b9d", // Steel blue
    "#8a4fff", // Purple
    "#00b4d8", // Cyan
    "#6a994e"  // Greenish
  ];
  
  /**
   * Returns a random color from the avatarColors array.
   * @returns {string} A random hex color code.
   */
  function getRandomAvatarColor() {
    const index = Math.floor(Math.random() * avatarColors.length);
    return avatarColors[index];
  }
  
  /**
   * Array of fake testimonials.
   */
  const fakeTestimonials = [
    { name: "Alice Johnson", review: "Absolutely amazing quality and design. Kaayko never disappoints! My mother in law was disappointed at first but then we fed her to pigs." },
    { name: "Brian Smith", review: "I love the unique style and attention to detail. Highly recommend!" },
    { name: "Catherine Lee", review: "My journey from a Neanderthal to Narayan is complete only because I stumbled on Kaayko!" },
    { name: "David Kim", review: "A premium brand that deserves premium prices. The kids in China are OK with this!" },
    { name: "Emily Davis", review: "The products are as innovative as they are beautiful. Very impressed!" },
    { name: "Frank Moore", review: "Outstanding design and functionality. I wear my Kaayko shirt with pride." },
    { name: "Grace Chen", review: "The detail and care in every product is evident. Love it! My wife loved it and she's a nihilist!" },
    { name: "Henry Patel", review: "High-quality, stylish, and sustainable. Finally something impressed me after that quickly taken corner in Liverpool." },
    { name: "Isabella Rivera", review: "My favorite brand for everyday style and comfort. If kaayko was a religion, I'm the priestess and shall rep it untill the Lord commandeth." },
    { name: "Jack Thompson", review: "The modern aesthetic and premium quality make Kaayko stand out. Do you know who else stands out? Racism." },
    { name: "Katherine Adams", review: "Every piece feels uniquely crafted. I am as loyal a customer as I am a husband and believe me, I've been married a dozen times." },
    { name: "Liam Brown", review: "Top-notch materials and design. A truly remarkable brand. Without Kaayko, you feel nothing!" },
    { name: "Mia Wilson", review: "The blend of tradition and modernity in their products is inspiring. Kaayko is life!" },
    { name: "Noah Martinez", review: "I appreciate the focus on sustainability and quality. Their deforestation operations are highly ethical and tress consent before they are chopped. Wait, that's paper. Paper is made from tress." },
    { name: "Olivia Garcia", review: "Beautifully designed and exceptionally comfortable. Highly recommended! I also highly recommend you staying hydrated." },
    { name: "Paul Anderson", review: "An experience that elevates your style effortlessly. People will ask you, do not tell them." },
    { name: "Quinn Harris", review: "Every product tells a story. I am impressed with the creativity. Some stories are too long but then I remind myself that it's not the stories but my attention span which sucks." },
    { name: "Rachel Clark", review: "The craftsmanship is evident in every detail. A must-have brand! Even my unborn baby has an order placed!" },
    { name: "Samuel Lewis", review: "Bold, innovative, and timeless. Kaayko has it all. If someone is offended, tell them to suck it." },
    { name: "Tina Reynolds", review: "I was hungry for four days and finally I reached a town with a cafe and internet. I bought a t-shirt form Kaayko.com and died hungry. They call me a Corpse with Class." }
  ];
  
  /**
   * Shuffles an array in place using the Fisher-Yates algorithm.
   * @param {Array} array - The array to shuffle.
   * @returns {Array} The shuffled array.
   */
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /**
   * Populates the Testimonials tab with fake reviews.
   */
  function populateTestimonials() {
    const reviewsContainer = document.querySelector("#testimonialsTab .reviews-container");
    if (!reviewsContainer) return;
    
    reviewsContainer.innerHTML = "";
    const testimonials = shuffleArray([...fakeTestimonials]);
    testimonials.forEach(testimonial => {
      const testimonialElem = createTestimonialElement(testimonial);
      reviewsContainer.appendChild(testimonialElem);
    });
  }
  
  /**
   * Creates a testimonial element with a random avatar background.
   * @param {Object} data - The testimonial data containing 'name' and 'review'.
   * @returns {HTMLElement} The testimonial element.
   */
  function createTestimonialElement(data) {
    const container = document.createElement("div");
    container.className = "testimonial";
    
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = data.name.charAt(0).toUpperCase();
    avatar.style.backgroundColor = getRandomAvatarColor();
    
    const content = document.createElement("div");
    content.className = "testimonial-content";
    
    const reviewText = document.createElement("p");
    reviewText.textContent = `"${data.review}"`;
    
    const reviewerName = document.createElement("span");
    reviewerName.className = "name";
    reviewerName.textContent = data.name;
    
    content.appendChild(reviewText);
    content.appendChild(reviewerName);
    container.appendChild(avatar);
    container.appendChild(content);
    
    return container;
  }
  
  /**
   * Initializes tab functionality for the About modal.
   */
  function initAboutTabs() {
    const tabLinks = document.querySelectorAll(".tab-link");
    const tabContents = document.querySelectorAll(".tab-content");
    
    tabLinks.forEach(link => {
      link.addEventListener("click", () => {
        tabLinks.forEach(l => l.classList.remove("active"));
        tabContents.forEach(content => content.classList.remove("active"));
        
        link.classList.add("active");
        const targetId = link.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
        
        if (targetId === "testimonialsTab") {
          populateTestimonials();
        }
      });
    });
  }
  
  /**
   * Initialize the About modal tabs when DOM is ready.
   */
  document.addEventListener("DOMContentLoaded", () => {
    initAboutTabs();
  });