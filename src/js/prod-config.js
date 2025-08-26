/**
 * Production Configuration Override
 * Force frontend to use production APIs even when running locally
 */

// Override the API_BASE constant to force production mode
window.FORCE_PRODUCTION_MODE = true;

// Set the correct production API URL
window.PRODUCTION_API_BASE = "https://api-vwcc5j4qda-uc.a.run.app";

console.log("🚀 PRODUCTION MODE FORCED - Using:", window.PRODUCTION_API_BASE);
