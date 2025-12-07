// Store access control system

let isModalActive = false;
let popstateHandler = null;
let failureCount = 0;

// Security validation layer
const validateAccess = (i) => {
  // Decoy validations (fake keywords to confuse)
  const decoys = ['admin', 'password', 'secret', 'unlock', 'kaayko'];
  if (decoys.includes(i.toLowerCase())) return false;
  
  // Real validation (obfuscated)
  const m = [
    () => String.fromCharCode(0x4d,0x61,0x61,0x75),
    () => window.atob('Q2hhcml6YXJk'),
    () => [78,97,103,112,117,114].map(c=>String.fromCharCode(c)).join('')
  ];
  return m.some(f => f() === i);
};

// Additional security through obscurity
const securityLayer = btoa('access_control_enabled');

// Sarcastic failure messages (South Park style - no mercy)

const getSarcasticMessage = () => {
  failureCount++;
  const messages = [
    // First attempts - Cartman level rudeness
    "Wrong, dumbass. Try again.",
    "Oh my God, you suck at this.",
    "That's not it, genius. What's wrong with you?",
    
    // Getting more brutal - Stan's dry sarcasm
    "Dude, seriously? That's your guess?",
    "This is pretty sad to watch, not gonna lie.",
    "Are you actually stupid or just pretending?",
    
    // Peak brutality - Full Cartman mode
    "Holy crap, you're terrible at this.",
    "I've seen rocks with better problem-solving skills.",
    "Your parents must be so disappointed right now.",
    
    // Ultimate destruction
    "This is pathetic. Even Butters could do better.",
    "You know what? Just give up. This isn't for you.",
    "I'm actually impressed by how bad you are at this."
  ];
  
  const index = Math.min(failureCount - 1, messages.length - 1);
  return messages[index];
};

document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the store page
  const isStorePage = window.location.pathname.includes('store.html') || 
                     window.location.pathname.endsWith('store');
  
  if (!isStorePage) return;
  
  console.log('🔐 Store page detected, checking access...');
  
  // KORTEX BYPASS: ONLY for store access via smart links
  // Check if user came from a Kortex smart link redirect
  const urlParams = new URLSearchParams(window.location.search);
  const hasKortexBypass = urlParams.get('bypass') === 'kortex' && urlParams.has('ref');
  
  if (hasKortexBypass) {
    const linkRef = urlParams.get('ref');
    console.log(`✅ Kortex smart link bypass detected (${linkRef}) - granting store access`);
    const accessKey = atob('a2FheWtvU3RvcmVBY2Nlc3M=');
    localStorage.setItem(accessKey, atob('Z3JhbnRlZA=='));
    
    // Clean URL by removing bypass parameters
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    return; // Skip auth modal entirely
  }
  
  // Check access persistence
  const accessKey = atob('a2FheWtvU3RvcmVBY2Nlc3M=');
  const hasAccess = localStorage.getItem(accessKey) === atob('Z3JhbnRlZA==');
  
  if (!hasAccess) {
    // Add history state to handle back button properly
    history.pushState({ modal: 'secret-store' }, '', window.location.href);
    
    // Add a slight delay to prevent immediate back button interference
    setTimeout(() => {
      showSecretModal();
    }, 100);
  }
});

function showSecretModal() {
  if (isModalActive) return; // Prevent multiple modals
  
  isModalActive = true;
  failureCount = 0; // Reset sarcasm level for fresh attempts
  
  // Blur the main content
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.style.filter = 'blur(10px)';
    mainContent.style.pointerEvents = 'none';
  }
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'secret-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(8px);
    font-family: 'Josefin_Medium', 'Josefin Sans', Arial, sans-serif;
  `;
  
  // Create modal content with gold and black theme
  const modal = document.createElement('div');
  modal.id = 'secret-modal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #ffffff;
    border-radius: 20px;
    padding: 48px;
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: 
      0 25px 50px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(212, 175, 55, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 2px solid #d4af37;
    position: relative;
    transform-origin: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: 'Josefin_Medium', 'Josefin Sans', Arial, sans-serif;
  `;
  
  modal.innerHTML = `
    <div style="
      font-size: 4rem; 
      margin-bottom: 24px;
      background: linear-gradient(45deg, #d4af37, #ffd700);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 2px 4px rgba(212, 175, 55, 0.3));
    ">🔐</div>
    
    <h2 style="
      margin: 0 0 20px 0; 
      font-size: 2rem; 
      font-weight: 700;
      color: #d4af37;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      letter-spacing: -0.02em;
      font-family: 'Josefin_Bold', 'Josefin Sans', Arial, sans-serif;
    ">Secret Store Access</h2>
    
    <p style="
      margin: 0 0 32px 0; 
      color: #cccccc; 
      line-height: 1.6;
      font-size: 16px;
      font-weight: 400;
      font-family: 'Josefin_Light', 'Josefin Sans', Arial, sans-serif;
    ">
      This exclusive store requires a secret keyword to access. Enter the magic word to continue your journey.
    </p>
    
    <input 
      type="text" 
      id="secret-input" 
      placeholder="Enter secret keyword..."
      style="
        width: 100%;
        padding: 18px 24px;
        border: 2px solid #444444;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 500;
        text-align: center;
        margin-bottom: 24px;
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
        box-sizing: border-box;
        transition: all 0.3s ease;
        font-family: 'Josefin_Medium', 'Josefin Sans', Arial, sans-serif;
        backdrop-filter: blur(10px);
      "
      autocomplete="off"
      spellcheck="false"
    />
    
    <button 
      id="secret-submit" 
      style="
        background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
        color: #1a1a1a;
        border: none;
        padding: 18px 36px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        width: 100%;
        margin-bottom: 20px;
        font-family: 'Josefin_Bold', 'Josefin Sans', Arial, sans-serif;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        box-shadow: 
          0 4px 15px rgba(212, 175, 55, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
      "
    >
      Enter Store
    </button>
    
    <div id="error-message" style="
      color: #ff6b6b;
      font-size: 14px;
      margin-top: 12px;
      min-height: 24px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    "></div>
    
    <p style="
      margin: 24px 0 0 0; 
      font-size: 13px; 
      color: #888888;
      font-weight: 400;
      line-height: 1.4;
      font-family: 'Josefin_Light', 'Josefin Sans', Arial, sans-serif;
    ">
      Don't know the keyword? You can still access other menu options.<br>
      <span style="color: #d4af37; font-weight: 500; font-family: 'Josefin_Medium', 'Josefin Sans', Arial, sans-serif;">Press back to return to previous page.</span>
    </p>
  `;
  
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
  
  // Focus on input
  const input = document.getElementById('secret-input');
  const submitBtn = document.getElementById('secret-submit');
  const errorMsg = document.getElementById('error-message');
  
  // Enhanced input styling on focus
  input.addEventListener('focus', function() {
    this.style.borderColor = '#d4af37 !important';
    this.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.2) !important';
    this.style.outline = 'none !important';
  });
  
  input.addEventListener('blur', function() {
    this.style.borderColor = '#444444 !important';
    this.style.boxShadow = 'none !important';
    this.style.outline = 'none !important';
  });
  
  // Enhanced button hover effect
  submitBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 8px 25px rgba(212, 175, 55, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
  });
  
  submitBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
  });
  
  input.focus();
  
  // Handle browser back button to close modal gracefully
  popstateHandler = function(e) {
    console.log('🔙 Back button pressed, closing modal and navigating away');
    closeModal();
    // Navigate away from store page
    window.location.href = 'paddlingout.html';
  };
  
  // Add popstate listener for back button
  window.addEventListener('popstate', popstateHandler);
  
  // Function to close modal cleanly
  function closeModal() {
    isModalActive = false;
    
    // Remove the popstate handler
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }
    
    if (mainContent) {
      mainContent.style.filter = 'none';
      mainContent.style.pointerEvents = 'auto';
    }
    
    if (modalOverlay && modalOverlay.parentNode) {
      modalOverlay.remove();
    }
  }
  
  // Handle form submission
  function handleSubmit() {
    const enteredKeyword = input.value.trim();
    
    console.log('🔑 Validating access...');
    
    if (validateAccess(enteredKeyword)) {
      console.log('✅ Access granted');
      // Grant persistent access
      localStorage.setItem(atob('a2FheWtvU3RvcmVBY2Nlc3M='), atob('Z3JhbnRlZA=='));
      
      // Success animation with gold theme
      modal.style.transform = 'scale(1.05)';
      modal.style.background = 'linear-gradient(135deg, #d4af37 0%, #b8941f 100%)';
      modal.style.color = '#1a1a1a';
      
      // Escalating success message based on failure count - South Park style
      let successMessage;
      if (failureCount === 0) {
        successMessage = 'Nice. You got it on the first try. You might actually have a brain.';
      } else if (failureCount <= 2) {
        successMessage = 'Finally! Jesus, that only took you forever.';
      } else if (failureCount <= 5) {
        successMessage = 'Holy crap, you actually did it! I honestly didnt think you had it in you.';
      } else {
        successMessage = 'MIRACLE ALERT! You got it right! Someone call Guinness World Records, this is unprecedented.';
      }
      
      errorMsg.innerHTML = successMessage;
      errorMsg.style.color = '#ffffff';
      errorMsg.style.fontWeight = '700';
      errorMsg.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
      
      setTimeout(() => {
        closeModal();
        // Remove the history state since access is granted
        if (history.state && history.state.modal === 'secret-store') {
          history.back();
        }
      }, 1500);
      
    } else {
      console.log('❌ Access denied');
      // Shake animation and sarcastic error
      shakeModal(modal);
      errorMsg.innerHTML = getSarcasticMessage();
      input.value = '';
      input.focus();
    }
  }
  
  // Event listeners
  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });
  
  // Handle escape key to go back to home
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape' && isModalActive) {
      console.log('⌨️ Escape pressed, closing modal and navigating away');
      document.removeEventListener('keydown', escapeHandler);
      closeModal();
      window.location.href = 'paddlingout.html';
    }
  });
  
  // Prevent closing modal by clicking outside, but show sarcastic message
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      shakeModal(modal);
      const bypassMessages = [
        "Oh, trying to click your way out? What are you, five years old?",
        "Nice try, jackass. This isn't some cheap website you can just click around.",
        "Wow, clicking outside the box. Real genius move there, Einstein.",
        "Let me guess, next you'll try turning it off and on again?",
        "This is embarrassing. Just enter the damn keyword already.",
        "You know what? Just give up. This clearly isn't for you."
      ];
      errorMsg.innerHTML = bypassMessages[Math.floor(Math.random() * bypassMessages.length)];
    }
  });
}

function shakeModal(modal) {
  // Enhanced shake animation with gold theme
  modal.style.transform = 'translateX(-8px) scale(1.02)';
  setTimeout(() => modal.style.transform = 'translateX(8px) scale(1.02)', 100);
  setTimeout(() => modal.style.transform = 'translateX(-4px) scale(1.01)', 200);
  setTimeout(() => modal.style.transform = 'translateX(4px) scale(1.01)', 300);
  setTimeout(() => modal.style.transform = 'translateX(0) scale(1)', 400);
  
  // Add gold error border briefly
  const originalBorder = modal.style.borderColor;
  modal.style.borderColor = '#ff6b6b';
  modal.style.boxShadow = `
    0 25px 50px rgba(255, 107, 107, 0.3),
    0 0 0 1px rgba(255, 107, 107, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1)
  `;
  
  setTimeout(() => {
    modal.style.borderColor = originalBorder;
    modal.style.boxShadow = `
      0 25px 50px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(212, 175, 55, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `;
  }, 1000);
}

// Also protect store navigation links
document.addEventListener('click', function(e) {
  const target = e.target;
  const isStoreLink = target.tagName === 'A' && 
                     (target.getAttribute('href') === 'store.html' || 
                      target.textContent.trim() === 'Store');
  
  if (isStoreLink) {
    const accessKey = atob('a2FheWtvU3RvcmVBY2Nlc3M=');
    const hasAccess = localStorage.getItem(accessKey) === atob('Z3JhbnRlZA==');
    if (!hasAccess) {
      e.preventDefault();
      console.log('🔐 Store link clicked without access, redirecting to keyword entry');
      // Redirect to store page which will show the modal
      window.location.href = 'store.html';
    }
  }
});

// Development utility (obfuscated)
window[atob('Y2xlYXJTdG9yZUFjY2Vzcw==')] = function() {
  if (btoa(prompt('Dev key?')) === 'YWRtaW4xMjM=') {
    localStorage.removeItem(atob('a2FheWtvU3RvcmVBY2Nlc3M='));
    console.log('Dev mode: Access cleared');
  }
};