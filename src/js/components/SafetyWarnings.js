/**
 * Safety Warnings Component
 * Displays safety alerts and warnings prominently
 */
class SafetyWarnings {
  constructor() {
    this.element = null;
  }

  render(warnings) {
    if (!warnings) return null;
    
    const warningArray = Array.isArray(warnings) ? warnings : [warnings];
    const warningCount = warningArray.length;
    
    const warningsHTML = `
      <div class="safety-warnings-creative">
        <div class="warning-pulse-container" onclick="this.parentElement.classList.toggle('warnings-revealed')">
          <div class="warning-pulse-ring"></div>
          <div class="warning-pulse-ring delay-1"></div>
          <div class="warning-pulse-ring delay-2"></div>
          <div class="warning-core">
            <span class="warning-emoji">⚠️</span>
            <span class="warning-count-badge">${warningCount}</span>
          </div>
        </div>
        <div class="warnings-revealer">
          <div class="warning-cards-container">
            ${warningArray.map((warning, index) => `
              <div class="warning-card" style="--card-index: ${index}">
                <div class="warning-card-glow"></div>
                <div class="warning-severity-stripe"></div>
                <div class="warning-card-content">
                  <div class="warning-card-icon">🚨</div>
                  <div class="warning-card-text">${warning}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="warnings-footer">
            <div class="warning-tip">💡 Tap warning to dismiss</div>
          </div>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = warningsHTML;
    this.element = container.firstElementChild;
    
    // Add click handlers for individual warning cards
    setTimeout(() => {
      const warningCards = this.element.querySelectorAll('.warning-card');
      warningCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          card.style.transform = 'scale(0.8) rotateX(90deg)';
          card.style.opacity = '0';
          setTimeout(() => card.remove(), 300);
        });
      });
    }, 100);
    
    return this.element;
  }

  getSeverityClass(warning) {
    const severityKeywords = {
      high: ['dangerous', 'unsafe', 'severe', 'extreme'],
      medium: ['caution', 'moderate', 'advised'],
      low: ['minor', 'slight', 'watch']
    };
    
    const warningLower = warning.toLowerCase();
    
    if (severityKeywords.high.some(keyword => warningLower.includes(keyword))) {
      return 'warning-high';
    }
    if (severityKeywords.medium.some(keyword => warningLower.includes(keyword))) {
      return 'warning-medium';
    }
    return 'warning-low';
  }
}

// Export for use in main modal
window.SafetyWarnings = SafetyWarnings;
