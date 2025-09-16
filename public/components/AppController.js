// AppController.js - Enhanced application controller with full React functionality
import { dataService } from './DataService.js';
import { riskEngine } from './RiskEngine.js';
import { UIComponents } from './UIComponents.js';

export class AppController {
  constructor() {
    this.state = {
      countries: [],
      weights: [...riskEngine.defaultWeights],
      selectedCountries: ['USA', 'CHN', 'DEU'], // Default selection
      countryVolumes: { USA: 10, CHN: 15, DEU: 8 }, // Default volumes
      countryRisks: {},
      baselineRisk: 0,
      loading: true,
      error: null,
      apiHealthy: false,
      lastUpdate: null,
       isDirty: false // Track if user has made changes
    };

    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.containerElement = null;
    this._waitingForContainer = false;

    // Bind methods to preserve 'this' context
    this.initialize = this.initialize.bind(this);
    this.onWeightsChange = this.onWeightsChange.bind(this);
    this.onCountrySelect = this.onCountrySelect.bind(this);
    this.onVolumeChange = this.onVolumeChange.bind(this);
  }

 // Enhanced initialization with retry logic
  async initialize(containerId) {
    this.containerId = containerId;

    const container = await this._waitForContainer(containerId);
    if (!container) {
      console.error(`❌ Unable to initialize application: container "${containerId}" not found.`);
      return;
    }
    this.containerElement = container;

    try {
      this.showLoadingState();
      
      // Check API health first
      this.state.apiHealthy = await dataService.healthCheck();
      
      if (!this.state.apiHealthy && this.retryCount < this.maxRetries) {
        console.warn(`API not healthy, retry ${this.retryCount + 1}/${this.maxRetries}`);
        this.retryCount++;
        setTimeout(() => this.initialize(containerId), this.retryDelay);
        return;
      }

      await this.loadCountries();
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.render();
      
      console.log('✅ HRDD Risk Assessment Tool initialized successfully');
      
      // Enable auto-save functionality
      this.startAutoSave();
      
    } catch (error) {
      this.handleError(error);
    }
  }

  async _waitForContainer(containerId, timeout = 5000) {
    if (typeof document === 'undefined') return null;

    let container = document.getElementById(containerId);
    if (container) {
      return container;
    }

    if (document.readyState === 'loading' && !this._waitingForContainer) {
      this._waitingForContainer = true;
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', () => {
          this._waitingForContainer = false;
          resolve();
        }, { once: true });
      });
    }

    const start = Date.now();
    while (!container && Date.now() - start < timeout) {
      container = document.getElementById(containerId);
      if (container) {
        return container;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return container || null;
  }

  // Enhanced loading state
  showLoadingState() {
    const container = this.containerElement || document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">
            Human Rights Due Diligence Risk Assessment Tool
          </h1>
          <p style="font-size: 16px; color: #6b7280;">
            Initializing application and loading country data...
          </p>
        </div>
        
        <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
          <div style="margin-bottom: 20px;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Loading Components</div>
            <div style="font-size: 14px; color: #6b7280;">
              ${this.retryCount > 0 ? `Retry ${this.retryCount}/${this.maxRetries}` : 'Connecting to API and loading data...'}
            </div>
          </div>
          
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 12px; border-radius: 6px; font-size: 14px;">
            <strong>Please wait:</strong> Loading country risk data and initializing interactive components.
          </div>
        </div>
      </div>
      
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  // Enhanced country loading with better error handling
  async loadCountries() {
    try {
      this.state.loading = true;
      const countries = await dataService.getAllCountries();
      
      if (!countries || countries.length === 0) {
        throw new Error('No countries data received from API');
      }
      
      this.state.countries = Array.isArray(countries) ? countries : [];
      this.state.loading = false;
      this.state.error = null;
      
      console.log(`✅ Loaded ${this.state.countries.length} countries`);
    } catch (error) {
      this.state.loading = false;
      this.state.error = 'Failed to load countries: ' + error.message;
      throw error;
    }
  }

  // Enhanced risk calculations with validation
  calculateAllRisks() {
    try {
      const newCountryRisks = {};
      let calculatedCount = 0;
      
      this.state.countries.forEach(country => {
        if (this.validateCountryData(country)) {
          newCountryRisks[country.isoCode] = riskEngine.calculateWeightedRisk(country, this.state.weights);
          calculatedCount++;
        } else {
          console.warn(`Invalid data for country: ${country.name || country.isoCode}`);
        }
      });
      
      this.state.countryRisks = newCountryRisks;
      console.log(`📊 Calculated risks for ${calculatedCount} countries`);
    } catch (error) {
      console.error('Error calculating country risks:', error);
      this.handleError(new Error('Failed to calculate country risks'));
    }
  }

  // Validate country data before calculations
  validateCountryData(country) {
    if (!country || !country.isoCode) return false;
    
    const requiredFields = ['itucRightsRating', 'corruptionIndex', 'migrantWorkerPrevalence', 'wjpIndex', 'walkfreeSlaveryIndex'];
    return requiredFields.some(field => typeof country[field] === 'number' && country[field] >= 0);
  }

  // Enhanced baseline risk calculation
  calculateBaselineRisk() {
    try {
      this.state.baselineRisk = riskEngine.calculateBaselineRisk(
        this.state.selectedCountries,
        this.state.countryVolumes,
        this.state.countryRisks
      );
      
      console.log(`📈 Baseline risk calculated: ${this.state.baselineRisk.toFixed(2)}`);
    } catch (error) {
      console.error('Error calculating baseline risk:', error);
      this.state.baselineRisk = 0;
    }
  }

  // Enhanced weight change handler with debouncing
  onWeightsChange = (newWeights) => {
    if (!riskEngine.validateWeights(newWeights)) {
      console.warn('Invalid weights provided:', newWeights);
      return;
    }

    this.state.weights = [...newWeights];
    this.state.isDirty = true;
    
    // Debounced recalculation
    if (this.weightsTimeout) {
      clearTimeout(this.weightsTimeout);
    }
    
    this.weightsTimeout = setTimeout(() => {
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300); // 300ms debounce
  }

  // Enhanced country selection with validation
  onCountrySelect = (countryCode) => {
    if (!countryCode || typeof countryCode !== 'string') {
      console.warn('Invalid country code provided:', countryCode);
      return;
    }

    // Verify country exists in our data
    const country = this.state.countries.find(c => c.isoCode === countryCode);
    if (!country) {
      console.warn('Country not found in data:', countryCode);
      return;
    }

    this.state.isDirty = true;

    if (this.state.selectedCountries.includes(countryCode)) {
      // Remove country
      this.state.selectedCountries = this.state.selectedCountries.filter(code => code !== countryCode);
      delete this.state.countryVolumes[countryCode];
      console.log(`➖ Removed country: ${country.name}`);
    } else {
      // Add country with default volume
      this.state.selectedCountries.push(countryCode);
      this.state.countryVolumes[countryCode] = 10;
      console.log(`➕ Added country: ${country.name}`);
    }
    
    this.calculateBaselineRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

  // Enhanced volume change handler with validation
  onVolumeChange = (countryCode, volume) => {
    const numericVolume = parseFloat(volume);
    
    if (isNaN(numericVolume) || numericVolume < 0) {
      console.warn('Invalid volume provided:', volume);
      return;
    }

    const country = this.state.countries.find(c => c.isoCode === countryCode);
    if (!country) {
      console.warn('Country not found for volume change:', countryCode);
      return;
    }

    this.state.countryVolumes[countryCode] = Math.max(0, numericVolume);
    this.state.isDirty = true;
    
    // Debounced recalculation
    if (this.volumeTimeout) {
      clearTimeout(this.volumeTimeout);
    }
    
    this.volumeTimeout = setTimeout(() => {
      this.calculateBaselineRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 500); // 500ms debounce for volume changes
  }

  // Enhanced error handling with user-friendly messages
  handleError(error) {
    console.error('Application error:', error);
    
    const userFriendlyMessage = this.getUserFriendlyErrorMessage(error);
    this.state.error = userFriendlyMessage;
    this.state.loading = false;
    this.render();
  }

  getUserFriendlyErrorMessage(error) {
    if (error.message.includes('Failed to load countries')) {
      return 'Unable to connect to the data server. Please check your internet connection and try again.';
    }
    if (error.message.includes('Failed to calculate risk')) {
      return 'Error processing risk calculations. The data may be incomplete or corrupted.';
    }
    if (error.message.includes('No countries data')) {
      return 'No country data available. The server may be experiencing issues.';
    }
    
    return `Application error: ${error.message}`;
  }

   // Enhanced rendering with better layout and responsiveness
  render() {
    const container = this.containerElement || document.getElementById(this.containerId);
    if (!container) return;
    this.containerElement = container;

    if (this.state.loading) {
      this.showLoadingState();
      return;
    }

    if (this.state.error) {
      container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <div style="background-color: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 24px; border-radius: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
            <div style="font-weight: 600; font-size: 18px; margin-bottom: 12px;">Error Loading Application</div>
            <div style="margin-bottom: 16px;">${this.state.error}</div>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button onclick="window.hrddApp.initialize('${this.containerId}')" 
                      style="padding: 12px 20px; background-color: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Retry Connection
              </button>
              <button onclick="window.hrddApp.loadDemoData()" 
                      style="padding: 12px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Load Demo Data
              </button>
            </div>
            <div style="font-size: 12px; margin-top: 16px; opacity: 0.8;">
              If the problem persists, please contact support or try again later.
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Main application layout with enhanced styling
    container.innerHTML = `
      <div style="min-height: 100vh; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
        <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
          <header style="text-align: center; margin-bottom: 40px; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="font-size: 36px; font-weight: bold; color: #1f2937; margin-bottom: 12px; line-height: 1.2;">
              Human Rights Due Diligence Risk Assessment Tool
            </h1>
            <p style="font-size: 18px; color: #6b7280; margin-bottom: 16px;">
              Step 1: Calculate Baseline Risk for Supply Chain Countries
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px; color: #6b7280;">
              <div style="display: flex; align-items: center; gap: 4px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${this.state.apiHealthy ? '#22c55e' : '#ef4444'};"></div>
                <span>API ${this.state.apiHealthy ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div>•</div>
              <div>${this.state.countries.length} Countries Loaded</div>
              ${this.state.lastUpdate ? `
                <div>•</div>
                <div>Updated: ${new Date(this.state.lastUpdate).toLocaleTimeString()}</div>
              ` : ''}
            </div>
          </header>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 24px;" id="mainGrid">
            <div id="controlPanel" style="min-height: 600px;">
              <!-- Control Panel will be rendered here -->
            </div>
            <div id="mapContainer" style="min-height: 600px;">
              <!-- Map will be rendered here -->
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%); border: 1px solid #93c5fd; color: #1e40af; padding: 24px; border-radius: 12px; margin-top: 24px;">
            <div style="display: flex; align-items: start; gap: 16px;">
              <div style="font-size: 24px;">🚀</div>
              <div>
                <h3 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Next Steps:</h3>
                <p style="font-size: 14px; margin-bottom: 8px;">
                  Step 2 will allow you to configure HRDD strategies (monitoring, audits, etc.)<br>
                  Step 3 will measure responsiveness effectiveness to calculate managed risk levels.
                </p>
                <div style="font-size: 12px; opacity: 0.8;">
                  Your current configuration is automatically saved and can be restored when you return.
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          @media (max-width: 768px) {
            #mainGrid {
              grid-template-columns: 1fr !important;
            }
          }
          
          .loading-shimmer {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }
          
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        </style>
      </div>
    `;

    // Render individual components
    this.renderComponents();
  }

  // Enhanced component rendering
  renderComponents() {
    try {
      // Render control panel
      UIComponents.createControlPanel('controlPanel', {
        weights: this.state.weights,
        onWeightsChange: this.onWeightsChange,
        countries: this.state.countries,
        selectedCountries: this.state.selectedCountries,
        countryVolumes: this.state.countryVolumes,
        onCountrySelect: this.onCountrySelect,
        onVolumeChange: this.onVolumeChange,
        baselineRisk: this.state.baselineRisk
      });

      // Render enhanced world map
      UIComponents.createWorldMap('mapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        onCountrySelect: this.onCountrySelect,
        title: 'Baseline Risk Assessment Map',
        height: 500,
        width: 960
      });
      
    } catch (error) {
      console.error('Error rendering components:', error);
      this.handleError(new Error('Failed to render application components'));
    }
  }

  // Enhanced UI update method
  updateUI() {
    try {
      // Update control panel baseline display
      const baselineDisplay = document.getElementById('baselineDisplay');
      if (baselineDisplay) {
        const riskColor = riskEngine.getRiskColor(this.state.baselineRisk);
        const riskBand = riskEngine.getRiskBand(this.state.baselineRisk);
        
        baselineDisplay.style.backgroundColor = `${riskColor}20`;
        baselineDisplay.style.borderColor = riskColor;
        baselineDisplay.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: bold; color: ${riskColor}; margin-bottom: 8px;">
              ${this.state.baselineRisk.toFixed(1)}
            </div>
            <div style="font-size: 20px; font-weight: 600; color: ${riskColor}; margin-bottom: 8px;">
              ${riskBand} Risk
            </div>
            <div style="font-size: 14px; color: #6b7280;">
              Based on ${this.state.selectedCountries.length} selected ${this.state.selectedCountries.length === 1 ? 'country' : 'countries'}
            </div>
          </div>
        `;
      }

      // Update selected countries display
      UIComponents.updateSelectedCountriesDisplay(
        this.state.selectedCountries,
        this.state.countries,
        this.state.countryVolumes,
        this.onCountrySelect,
        this.onVolumeChange
      );

      // Update country dropdown
      const countrySelect = document.getElementById('countrySelect');
      if (countrySelect) {
        const currentValue = countrySelect.value;
        countrySelect.innerHTML = '<option value="">Select a country...</option>';
        this.state.countries
          .filter(country => !this.state.selectedCountries.includes(country.isoCode))
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(country => {
            const option = document.createElement('option');
            option.value = country.isoCode;
            option.textContent = country.name;
            countrySelect.appendChild(option);
          });
        countrySelect.value = currentValue;
      }

      // Re-render map with updated data
      UIComponents.createWorldMap('mapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        onCountrySelect: this.onCountrySelect,
        title: 'Baseline Risk Assessment Map',
        height: 500,
        width: 960
      });

    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }

  // Auto-save functionality
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      if (this.state.isDirty) {
        this.saveState();
        this.state.isDirty = false;
      }
    }, 30000); // Save every 30 seconds if dirty
  }

  // Save state to localStorage (if available)
  saveState() {
    try {
      const stateToSave = {
        weights: this.state.weights,
        selectedCountries: this.state.selectedCountries,
        countryVolumes: this.state.countryVolumes,
        lastSaved: new Date().toISOString()
      };
      
      // Note: localStorage might not be available in all Wix environments
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hrdd-risk-state', JSON.stringify(stateToSave));
        console.log('💾 State saved automatically');
      }
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }

  // Load saved state
  loadSavedState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('hrdd-risk-state');
        if (saved) {
          const parsedState = JSON.parse(saved);
          this.setState({
            weights: parsedState.weights || this.state.weights,
            selectedCountries: parsedState.selectedCountries || this.state.selectedCountries,
            countryVolumes: parsedState.countryVolumes || this.state.countryVolumes
          });
          console.log('📂 Loaded saved state from:', parsedState.lastSaved);
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error);
    }
    return false;
  }

  // Load demo data fallback
  loadDemoData() {
    const demoCountries = [
      { name: "United States of America", isoCode: "USA", itucRightsRating: 67.5, corruptionIndex: 35.0, migrantWorkerPrevalence: 9.9, wjpIndex: 43.7, walkfreeSlaveryIndex: 3.3, baseRiskScore: 48 },
      { name: "China", isoCode: "CHN", itucRightsRating: 90.0, corruptionIndex: 57.0, migrantWorkerPrevalence: 0.1, wjpIndex: 68.3, walkfreeSlaveryIndex: 4.0, baseRiskScore: 68 },
      { name: "Germany", isoCode: "DEU", itucRightsRating: 0.0, corruptionIndex: 25.0, migrantWorkerPrevalence: 15.2, wjpIndex: 16.8, walkfreeSlaveryIndex: 0.6, baseRiskScore: 20 },
      { name: "United Kingdom", isoCode: "GBR", itucRightsRating: 67.5, corruptionIndex: 29.0, migrantWorkerPrevalence: 16.5, wjpIndex: 30.7, walkfreeSlaveryIndex: 1.8, baseRiskScore: 43 },
      { name: "Japan", isoCode: "JPN", itucRightsRating: 22.5, corruptionIndex: 29.0, migrantWorkerPrevalence: 2.8, wjpIndex: 24.7, walkfreeSlaveryIndex: 1.1, baseRiskScore: 24 },
      { name: "India", isoCode: "IND", itucRightsRating: 90.0, corruptionIndex: 62.0, migrantWorkerPrevalence: 0.3, wjpIndex: 49.5, walkfreeSlaveryIndex: 8.0, baseRiskScore: 67 },
      { name: "Brazil", isoCode: "BRA", itucRightsRating: 67.5, corruptionIndex: 66.0, migrantWorkerPrevalence: 0.7, wjpIndex: 52.2, walkfreeSlaveryIndex: 5.0, baseRiskScore: 60 },
      { name: "France", isoCode: "FRA", itucRightsRating: 22.5, corruptionIndex: 33.0, migrantWorkerPrevalence: 7.9, wjpIndex: 23.3, walkfreeSlaveryIndex: 2.1, baseRiskScore: 26 }
    ];

    this.state.countries = demoCountries;
    this.state.error = null;
    this.state.loading = false;
    this.state.apiHealthy = false; // Demo mode
    
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.render();
    
    console.log('📄 Loaded demo data with', demoCountries.length, 'countries');
  }

  // Get current state (useful for debugging or external access)
  getState() {
    return { ...this.state };
  }

  // Set state (useful for loading saved configurations)
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

  // Export current configuration
  exportConfiguration() {
    const config = {
      weights: this.state.weights,
      selectedCountries: this.state.selectedCountries,
      countryVolumes: this.state.countryVolumes,
      baselineRisk: this.state.baselineRisk,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hrdd-risk-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📥 Configuration exported');
  }

  // Cleanup method
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.weightsTimeout) {
      clearTimeout(this.weightsTimeout);
    }
    if (this.volumeTimeout) {
      clearTimeout(this.volumeTimeout);
    }
    
    // Save final state before cleanup
    if (this.state.isDirty) {
      this.saveState();
    }
    
    console.log('🧹 App controller cleaned up');
  }
}