// AppController.js - Complete 3-Step HRDD Risk Assessment Tool
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
      
      // Step 2: HRDD Strategy
      hrddStrategy: [...riskEngine.defaultHRDDStrategy],
      transparencyEffectiveness: [...riskEngine.defaultTransparencyEffectiveness],
      
      // Step 3: Responsiveness Strategy
      responsivenessStrategy: [...riskEngine.defaultResponsivenessStrategy],
      managedRisk: 0,
      
      loading: true,
      error: null,
      apiHealthy: false,
      lastUpdate: null,
      isDirty: false,
      currentStep: 1
    };

    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.containerElement = null;
    this._waitingForContainer = false;

    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.onWeightsChange = this.onWeightsChange.bind(this);
    this.onCountrySelect = this.onCountrySelect.bind(this);
    this.onVolumeChange = this.onVolumeChange.bind(this);
    this.onHRDDStrategyChange = this.onHRDDStrategyChange.bind(this);
    this.onTransparencyChange = this.onTransparencyChange.bind(this);
    this.onResponsivenessChange = this.onResponsivenessChange.bind(this);
    this.setCurrentStep = this.setCurrentStep.bind(this);
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
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.render();
      console.log('HRDD Risk Assessment Tool (3 Steps) initialized successfully');
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
            Labour Rights Due Diligence Risk Assessment
          </h1>
          <p style="font-size: 16px; color: #6b7280;">
            Complete 3-Step Risk Management Tool
          </p>
        </div>
        <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
          <div style="margin-bottom: 20px;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Loading Components</div>
            <div style="font-size: 14px; color: #6b7280;">
              ${this.retryCount > 0 ? `Retry ${this.retryCount}/${this.maxRetries}` : 'Initializing 3-step risk assessment...'}
            </div>
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

  calculateManagedRisk() {
    try {
      this.state.managedRisk = riskEngine.calculateManagedRisk(
        this.state.baselineRisk,
        this.state.hrddStrategy,
        this.state.transparencyEffectiveness,
        this.state.responsivenessStrategy
      );
      console.log(`Managed risk calculated: ${this.state.managedRisk.toFixed(2)}`);
    } catch (error) {
      console.error('Error calculating managed risk:', error);
      this.state.managedRisk = this.state.baselineRisk;
    }
  }

  // Event Handlers
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
      this.calculateManagedRisk();
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
    this.calculateManagedRisk();
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
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 500);
  }

  onHRDDStrategyChange = (newStrategy) => {
    if (!riskEngine.validateHRDDStrategy(newStrategy)) {
      console.warn('Invalid HRDD strategy provided:', newStrategy);
      return;
    }

    this.state.hrddStrategy = [...newStrategy];
    this.state.isDirty = true;
    
    if (this.strategyTimeout) clearTimeout(this.strategyTimeout);
    
    this.strategyTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  onTransparencyChange = (newTransparency) => {
    if (!riskEngine.validateTransparency(newTransparency)) {
      console.warn('Invalid transparency values provided:', newTransparency);
      return;
    }

    this.state.transparencyEffectiveness = [...newTransparency];
    this.state.isDirty = true;
    
    if (this.transparencyTimeout) clearTimeout(this.transparencyTimeout);
    
    this.transparencyTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  onResponsivenessChange = (newResponsiveness) => {
    if (!riskEngine.validateResponsiveness(newResponsiveness)) {
      console.warn('Invalid responsiveness values provided:', newResponsiveness);
      return;
    }

    this.state.responsivenessStrategy = [...newResponsiveness];
    this.state.isDirty = true;
    
    if (this.responsivenessTimeout) clearTimeout(this.responsivenessTimeout);
    
    this.responsivenessTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  setCurrentStep = (step) => {
    if (step >= 1 && step <= 3) {
      this.state.currentStep = step;
      this.updateUI();
    }
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
    console.log("Rendering complete 3-step HRDD tool");
    
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
        <div style="max-width: 1600px; margin: 0 auto; padding: 20px;">

          <!-- Header with Step Navigation -->
          <header style="text-align: center; margin-bottom: 32px; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="font-size: 36px; font-weight: bold; color: #1f2937; margin-bottom: 12px; line-height: 1.2;">
              Labour Rights Due Diligence Risk Assessment
            </h1>
            <p style="font-size: 18px; color: #6b7280; margin-bottom: 24px;">
              Complete 3-Step Risk Management and Effectiveness Analysis
            </p>
            
            <!-- Step Navigation -->
            <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 16px;">
              <button onclick="window.hrddApp.setCurrentStep(1)" 
                      style="padding: 12px 24px; border: 2px solid ${this.state.currentStep === 1 ? '#3b82f6' : '#d1d5db'}; 
                             background: ${this.state.currentStep === 1 ? '#3b82f6' : 'white'}; 
                             color: ${this.state.currentStep === 1 ? 'white' : '#6b7280'}; 
                             border-radius: 8px; cursor: pointer; font-weight: 600;">
                Step 1: Baseline Risk
              </button>
              <button onclick="window.hrddApp.setCurrentStep(2)" 
                      style="padding: 12px 24px; border: 2px solid ${this.state.currentStep === 2 ? '#3b82f6' : '#d1d5db'}; 
                             background: ${this.state.currentStep === 2 ? '#3b82f6' : 'white'}; 
                             color: ${this.state.currentStep === 2 ? 'white' : '#6b7280'}; 
                             border-radius: 8px; cursor: pointer; font-weight: 600;">
                Step 2: HRDD Strategy
              </button>
              <button onclick="window.hrddApp.setCurrentStep(3)" 
                      style="padding: 12px 24px; border: 2px solid ${this.state.currentStep === 3 ? '#3b82f6' : '#d1d5db'}; 
                             background: ${this.state.currentStep === 3 ? '#3b82f6' : 'white'}; 
                             color: ${this.state.currentStep === 3 ? 'white' : '#6b7280'}; 
                             border-radius: 8px; cursor: pointer; font-weight: 600;">
                Step 3: Managed Risk
              </button>
            </div>

            <!-- Status Bar -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px; color: #6b7280;">
              <div style="display: flex; align-items: center; gap: 4px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${this.state.apiHealthy ? '#22c55e' : '#ef4444'};"></div>
                <span>API ${this.state.apiHealthy ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div>•</div>
              <div>${this.state.countries.length} Countries</div>
              <div>•</div>
              <div>${this.state.selectedCountries.length} Selected</div>
              ${this.state.lastUpdate ? `
                <div>•</div>
                <div>Updated: ${new Date(this.state.lastUpdate).toLocaleTimeString()}</div>
              ` : ''}
            </div>
          </header>

          <!-- Step Content -->
          <div id="stepContent"></div>

          <!-- Always visible risk comparison at bottom -->
          <div id="riskComparison" style="margin-top: 32px;"></div>

        </div>
      </div>
    `;

    this.renderStepContent();
    this.renderRiskComparison();
  }

  renderStepContent() {
    const stepContent = document.getElementById('stepContent');
    if (!stepContent) return;

    switch (this.state.currentStep) {
      case 1:
        this.renderStep1(stepContent);
        break;
      case 2:
        this.renderStep2(stepContent);
        break;
      case 3:
        this.renderStep3(stepContent);
        break;
    }
  }

  renderStep1(container) {
    container.innerHTML = `
      <!-- BASELINE RISK MAP -->
      <div id="baselineMapContainer" style="margin-bottom: 32px;"></div>

      <!-- COUNTRY SELECTION & RESULTS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;" id="selectionGrid">
        <div id="countrySelectionPanel"></div>
        <div id="resultsPanel"></div>
      </div>

      <!-- WEIGHTINGS PANEL -->
      <div id="weightingsPanel"></div>

      <style>
        @media (max-width: 768px) {
          #selectionGrid {
            grid-template-columns: 1fr !important;
          }
        }
      </style>
    `;

    // Render Step 1 components
    UIComponents.createWorldMap('baselineMapContainer', {
      countries: this.state.countries,
      countryRisks: this.state.countryRisks,
      selectedCountries: this.state.selectedCountries,
      onCountrySelect: this.onCountrySelect,
      title: 'Step 1: Baseline Risk Assessment',
      mapType: 'baseline',
      height: 500,
      width: 1200
    });

    UIComponents.createCountrySelectionPanel('countrySelectionPanel', {
      countries: this.state.countries,
      selectedCountries: this.state.selectedCountries,
      countryVolumes: this.state.countryVolumes,
      onCountrySelect: this.onCountrySelect,
      onVolumeChange: this.onVolumeChange
    });

    UIComponents.createResultsPanel('resultsPanel', {
      selectedCountries: this.state.selectedCountries,
      countries: this.state.countries,
      countryRisks: this.state.countryRisks,
      baselineRisk: this.state.baselineRisk
    });

    UIComponents.createWeightingsPanel('weightingsPanel', {
      weights: this.state.weights,
      onWeightsChange: this.onWeightsChange
    });
  }

  renderStep2(container) {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;" id="step2Grid">
        <div id="hrddStrategyPanel"></div>
        <div id="transparencyPanel"></div>
      </div>

      <style>
        @media (max-width: 768px) {
          #step2Grid {
            grid-template-columns: 1fr !important;
          }
        }
      </style>
    `;

    UIComponents.createHRDDStrategyPanel('hrddStrategyPanel', {
      strategy: this.state.hrddStrategy,
      onStrategyChange: this.onHRDDStrategyChange
    });

    UIComponents.createTransparencyPanel('transparencyPanel', {
      transparency: this.state.transparencyEffectiveness,
      onTransparencyChange: this.onTransparencyChange
    });
  }

  renderStep3(container) {
    container.innerHTML = `
      <!-- MANAGED RISK MAP -->
      <div id="managedMapContainer" style="margin-bottom: 32px;"></div>

      <!-- RESPONSIVENESS STRATEGY -->
      <div id="responsivenessPanel" style="margin-bottom: 32px;"></div>

      <!-- FINAL RESULTS -->
      <div id="finalResultsPanel"></div>
    `;

    UIComponents.createWorldMap('managedMapContainer', {
      countries: this.state.countries,
      countryRisks: this.state.countryRisks,
      selectedCountries: this.state.selectedCountries,
      onCountrySelect: this.onCountrySelect,
      title: 'Step 3: Managed Risk After HRDD Implementation',
      mapType: 'managed',
      managedRisk: this.state.managedRisk,
      height: 500,
      width: 1200
    });

    UIComponents.createResponsivenessPanel('responsivenessPanel', {
      responsiveness: this.state.responsivenessStrategy,
      onResponsivenessChange: this.onResponsivenessChange
    });

    UIComponents.createFinalResultsPanel('finalResultsPanel', {
      baselineRisk: this.state.baselineRisk,
      managedRisk: this.state.managedRisk,
      selectedCountries: this.state.selectedCountries,
      countries: this.state.countries,
      hrddStrategy: this.state.hrddStrategy,
      transparencyEffectiveness: this.state.transparencyEffectiveness,
      responsivenessStrategy: this.state.responsivenessStrategy
    });
  }

  renderRiskComparison() {
    const container = document.getElementById('riskComparison');
    if (!container) return;

    UIComponents.createRiskComparisonPanel(container, {
      baselineRisk: this.state.baselineRisk,
      managedRisk: this.state.managedRisk,
      selectedCountries: this.state.selectedCountries
    });
  }

  updateUI() {
    try {
      // Update current step content
      this.renderStepContent();
      this.renderRiskComparison();

      // Update any dropdowns
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

    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }

  // Utility methods
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
        hrddStrategy: this.state.hrddStrategy,
        transparencyEffectiveness: this.state.transparencyEffectiveness,
        responsivenessStrategy: this.state.responsivenessStrategy,
        currentStep: this.state.currentStep,
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
            countryVolumes: parsedState.countryVolumes || this.state.countryVolumes,
            hrddStrategy: parsedState.hrddStrategy || this.state.hrddStrategy,
            transparencyEffectiveness: parsedState.transparencyEffectiveness || this.state.transparencyEffectiveness,
            responsivenessStrategy: parsedState.responsivenessStrategy || this.state.responsivenessStrategy,
            currentStep: parsedState.currentStep || this.state.currentStep
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
    this.calculateManagedRisk();
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
    this.calculateManagedRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

  destroy() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    if (this.weightsTimeout) clearTimeout(this.weightsTimeout);
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    if (this.strategyTimeout) clearTimeout(this.strategyTimeout);
    if (this.transparencyTimeout) clearTimeout(this.transparencyTimeout);
    if (this.responsivenessTimeout) clearTimeout(this.responsivenessTimeout);
    if (this.state.isDirty) this.saveState();
    console.log('App controller cleaned up');
  }
}