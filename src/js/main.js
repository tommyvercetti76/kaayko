/**
 * Main Application Entry Point
 * Initializes all systems and ensures proper loading order
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Kaayko Application Starting...');
  
  // Wait for critical services to be available
  await waitForServices();
  
  // Initialize API client
  if (window.apiClient) {
    console.log('✅ API Client initialized');
    console.log('🔧 Current mode:', window.apiClient.getMode());
  }
  
  // Initialize data transformer
  if (window.dataTransformer) {
    console.log('✅ Data Transformer initialized');
  }
  
  // Initialize lake modal system
  if (window.LakeModal) {
    window.lakeModal = new window.LakeModal();
    console.log('✅ Lake Modal system initialized');
  }
  
  console.log('🎉 Kaayko Application Ready!');
});

/**
 * Wait for essential services to load
 */
async function waitForServices() {
  const maxWait = 5000; // 5 seconds max
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const checkServices = () => {
      const hasApiClient = !!window.apiClient;
      const hasDataTransformer = !!window.dataTransformer;
      const hasLakeModal = !!window.LakeModal;
      const hasComponents = !!(window.RatingHero && window.SafetyWarnings && window.WeatherStats && window.KonditionsHeatmap);
      
      if (hasApiClient && hasDataTransformer && hasLakeModal && hasComponents) {
        console.log('✅ All services loaded successfully');
        resolve();
      } else if (Date.now() - startTime > maxWait) {
        console.warn('⚠️ Timeout waiting for services, proceeding anyway');
        console.log('🔍 Service status:', {
          apiClient: hasApiClient,
          dataTransformer: hasDataTransformer,
          lakeModal: hasLakeModal,
          components: hasComponents
        });
        resolve();
      } else {
        setTimeout(checkServices, 100);
      }
    };
    
    checkServices();
  });
}
