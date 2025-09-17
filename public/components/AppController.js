// AppController.js - DEBUG VERSION with obvious visual changes
import { dataService } from './DataService.js';
import { riskEngine } from './RiskEngine.js';
import { UIComponents } from './UIComponents.js';

export class AppController {
  constructor() {
    this.state = {
      countries: [],
      weights: [...riskEngine.defaultWeights],
      selectedCountries: [],
      countryVolumes: {},
      countryRisks: {},
      baselineRisk: 0,
      loading: true,
      error: null,
      apiHealthy: false,
      lastUpdate: null,
      isDirty: false
    };

    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.containerElement = null;
    this._waitingForContainer = false;

    this.initialize = this.initialize.bind(this);
    this.onWeightsChange = this.onWeightsChange.bind(this);
    this.onCountrySelect = this.onCountrySelect.bind(this);
    this.onVolumeChange = this.onVolumeChange.bind(this);
  }

  async initialize(containerId) {
    this.containerId = containerId;
    const container = await this._waitForContainer(containerId);
    if (!container) {
      console.error(`Unable to initialize application: container "${containerId}" not found.`);
      return;
    }
    this.containerElement = container;

    try {
      this.showLoadingState();
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
      console.log('HRDD Risk Assessment Tool initialized successfully - NEW LAYOUT VERSION');
      this.startAutoSave();
    } catch (error) {
      this.handleError(error);
    }
  }

  async _waitForContainer(containerId, timeout = 5000) {
    if (typeof document === 'undefined') return null;
    let container = document.getElementById(containerId);
    if (container) return container;

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
      if (container) return container;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return container || null;
  }

  showLoadingState() {
    const container = this.containerElement || document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">
            Measuring the effectiveness of supply chain due diligence
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
      console.log(`Loaded ${this.state.countries.length} countries`);
    } catch (error) {
      this.state.loading = false;
      this.state.error = 'Failed to load countries: ' + error.message;
      throw error;
    }
  }

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
      console.log(`Calculated risks for ${calculatedCount} countries`);
    } catch (error) {
      console.error('Error calculating country risks:', error);
      this.handleError(new Error('Failed to calculate country risks'));
    }
  }

  validateCountryData(country) {
    if (!country || !country.isoCode) return false;
    const requiredFields = ['itucRightsRating', 'corruptionIndex', 'migrantWorkerPrevalence', 'wjpIndex', 'walkfreeSlaveryIndex'];
    return requiredFields.some(field => typeof country[field] === 'number' && country[field] >= 0);
  }

  calculateBaselineRisk() {
    try {
      this.state.baselineRisk = riskEngine.calculateBaselineRisk(
        this.state.selectedCountries,
        this.state.countryVolumes,
        this.state.countryRisks
      );
      console.log(`Baseline risk calculated: ${this.state.baselineRisk.toFixed(2)}`);
    } catch (error) {
      console.error('Error calculating baseline risk:', error);
      this.state.baselineRisk = 0;
    }
  }

  onWeightsChange = (newWeights) => {
    if (!riskEngine.validateWeights(newWeights)) {
      console.warn('Invalid weights provided:', newWeights);
      return;
    }

    this.state.weights = [...newWeights];
    this.state.isDirty = true;
    
    if (this.weightsTimeout) clearTimeout(this.weightsTimeout);
    
    this.weightsTimeout = setTimeout(() => {
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  onCountrySelect = (countryCode) => {
    if (!countryCode || typeof countryCode !== 'string') {
      console.warn('Invalid country code provided:', countryCode);
      return;
    }

    const country = this.state.countries.find(c => c.isoCode === countryCode);
    if (!country) {
      console.warn('Country not found in data:', countryCode);
      return;
    }

    this.state.isDirty = true;

    if (this.state.selectedCountries.includes(countryCode)) {
      this.state.selectedCountries = this.state.selectedCountries.filter(code => code !== countryCode);
      delete this.state.countryVolumes[countryCode];
      console.log(`Removed country: ${country.name}`);
    } else {
      this.state.selectedCountries.push(countryCode);
      this.state.countryVolumes[countryCode] = 10;
      console.log(`Added country: ${country.name}`);
    }
    
    this.calculateBaselineRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

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
    
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    
    this.volumeTimeout = setTimeout(() => {
      this.calculateBaselineRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 500);
  }

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

  render() {
    console.log("DEBUG: render() method called - NEW LAYOUT VERSION");
    
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
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="min-height: 100vh; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
        <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">

          <!-- Header -->
          <header style="text-align: center; margin-bottom: 40px; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="font-size: 36px; font-weight: bold; color: #1f2937; margin-bottom: 12px; line-height: 1.2;">
              Human Rights Due Diligence Risk Assessment Tool
            </h1>
            <p style="font-size: 18px; color: #6b7280; margin-bottom: 16px;">
              Step 1: Calculate Baseline Risk for Supply Chain Countries
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px; color: #6b7280; margin-top: 16px;">
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

          <!-- MAP SECTION (TOP) - FULL WIDTH -->
          <div id="mapContainer" style="margin-bottom: 32px; background: #fff3cd; border: 3px solid #ffc107; border-radius: 8px; padding: 10px;">
          <div style="background: #ffc107; color: #856404; padding: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; border-radius: 4px;">␊
              Labour rights: base line risk
            </div>
            <!-- Map will be rendered here -->
          </div>

          <!-- MIDDLE SECTION: Country Selection + Results -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; background: #d1ecf1; border: 3px solid #17a2b8; border-radius: 8px; padding: 10px;" id="middleGrid">
            <div id="countrySelectionPanel" style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 4px; padding: 10px;">
              <div style="background: #dc3545; color: white; padding: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; border-radius: 4px;">
                📋 COUNTRY SELECTION - LEFT PANEL
              </div>
              <!-- Country Selection Panel will be rendered here -->
            </div>
            <div id="resultsPanel" style="background: #d4edda; border: 2px solid #28a745; border-radius: 4px; padding: 10px;">
              <div style="background: #28a745; color: white; padding: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; border-radius: 4px;">
                📊 RESULTS - RIGHT PANEL
              </div>
              <!-- Results Panel will be rendered here -->
            </div>
          </div>

          <!-- BOTTOM SECTION: Risk Factor Weightings -->
          <div id="weightingsPanel" style="margin-bottom: 24px; background: #e2e3e5; border: 3px solid #6c757d; border-radius: 8px; padding: 10px;">
            <div style="background: #6c757d; color: white; padding: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; border-radius: 4px;">
              ⚖️ WEIGHTINGS PANEL - NOW AT BOTTOM (FULL WIDTH)
            </div>
            <!-- Weightings Panel will be rendered here -->
          </div>
        </div>

        <style>
          @media (max-width: 768px) {
            #middleGrid {
              grid-template-columns: 1fr !important;
            }
          }
        </style>
      </div>
    `;

    console.log("DEBUG: About to call renderComponents()");
    this.renderComponents();
  }

  renderComponents() {
    console.log("DEBUG: renderComponents() called");
    try {
      // Render map at top (larger size)
      console.log("DEBUG: Rendering map component");
      UIComponents.createWorldMap('mapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        onCountrySelect: this.onCountrySelect,
        title: 'Global Human Rights Risk Assessment Map',
        height: 600,
        width: 1200
      });

      // Render country selection panel (middle left)
      console.log("DEBUG: Rendering country selection panel");
      UIComponents.createCountrySelectionPanel('countrySelectionPanel', {
        countries: this.state.countries,
        selectedCountries: this.state.selectedCountries,
        countryVolumes: this.state.countryVolumes,
        onCountrySelect: this.onCountrySelect,
        onVolumeChange: this.onVolumeChange
      });

      // Render results panel (middle right)
      console.log("DEBUG: Rendering results panel");
      UIComponents.createResultsPanel('resultsPanel', {
        selectedCountries: this.state.selectedCountries,
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        baselineRisk: this.state.baselineRisk
      });

      // Render weightings panel (bottom)
      console.log("DEBUG: Rendering weightings panel");
      UIComponents.createWeightingsPanel('weightingsPanel', {
        weights: this.state.weights,
        onWeightsChange: this.onWeightsChange
      });

      console.log("DEBUG: All components rendered successfully");
      
    } catch (error) {
      console.error('DEBUG: Error rendering components:', error);
      this.handleError(new Error('Failed to render application components'));
    }
  }

  updateUI() {
    try {
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

      UIComponents.updateSelectedCountriesDisplay(
        this.state.selectedCountries,
        this.state.countries,
        this.state.countryVolumes,
        this.onCountrySelect,
        this.onVolumeChange
      );

      UIComponents.updateResultsPanel(this.state.selectedCountries, this.state.countries, this.state.countryRisks, this.state.baselineRisk);

      UIComponents.createWorldMap('mapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        onCountrySelect: this.onCountrySelect,
        title: 'Global Human Rights Risk Assessment Map',
        height: 600,
        width: 1200
      });
    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }

  startAutoSave() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      if (this.state.isDirty) {
        this.saveState();
        this.state.isDirty = false;
      }
    }, 30000);
  }

  saveState() {
    try {
      const stateToSave = {
        weights: this.state.weights,
        selectedCountries: this.state.selectedCountries,
        countryVolumes: this.state.countryVolumes,
        lastSaved: new Date().toISOString()
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hrdd-risk-state', JSON.stringify(stateToSave));
        console.log('State saved automatically');
      }
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }

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
          console.log('Loaded saved state from:', parsedState.lastSaved);
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error);
    }
    return false;
  }

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
    this.state.apiHealthy = false;
    
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.render();
    console.log('Loaded demo data with', demoCountries.length, 'countries');
  }

  getState() {
    return { ...this.state };
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

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
    console.log('Configuration exported');
  }

  destroy() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    if (this.weightsTimeout) clearTimeout(this.weightsTimeout);
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    if (this.state.isDirty) this.saveState();
    console.log('App controller cleaned up');
  }
}