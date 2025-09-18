// AppController.js - Updated for 5-panel structure
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
      countryManagedRisks: {},
      baselineRisk: 0,
      riskConcentration: 1,

      // Step 2 & 3 properties
      hrddStrategy: riskEngine.defaultHRDDStrategy || [30, 20, 15, 15, 10, 10],
      transparencyEffectiveness: this.normalizeTransparencyEffectiveness(
        riskEngine.defaultTransparencyEffectiveness || [85, 45, 25, 15, 10, 8]
      ),
      responsivenessStrategy: riskEngine.defaultResponsivenessStrategy || [10, 15, 20, 25, 20, 10],
      responsivenessEffectiveness: this.normalizeResponsivenessEffectiveness(
        riskEngine.defaultResponsivenessEffectiveness || [5, 25, 50, 60, 70, 80]
      ),
      focus: typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6,
      managedRisk: 0,
      currentPanel: 1, // Changed from currentStep to currentPanel
      
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
    this.onHRDDStrategyChange = this.onHRDDStrategyChange.bind(this);
    this.onTransparencyChange = this.onTransparencyChange.bind(this);
    this.onResponsivenessChange = this.onResponsivenessChange.bind(this);
    this.onResponsivenessEffectivenessChange = this.onResponsivenessEffectivenessChange.bind(this);
    this.onFocusChange = this.onFocusChange.bind(this);
    this.setCurrentPanel = this.setCurrentPanel.bind(this); // Changed from setCurrentStep
  }

  normalizeEffectivenessArray(values, expectedLength, defaults, validator) {
    const fallbackSource = Array.isArray(defaults) ? defaults : [];
    const fallback = Array.from({ length: expectedLength }, (_, index) => {
      const fallbackValue = fallbackSource[index];
      return Number.isFinite(fallbackValue)
        ? Math.max(0, Math.min(100, fallbackValue))
        : 0;
    });

    if (!Array.isArray(values)) {
      return [...fallback];
    }

    const numericValues = values.map(value => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    });

    const normalized = [];
    for (let i = 0; i < expectedLength; i++) {
      const candidate = numericValues[i];

      if (candidate === null || candidate === undefined) {
        normalized.push(fallback[i]);
        continue;
      }

      const decimal = riskEngine.normalizeEffectivenessValue(candidate);
      const rawPercentage = Math.max(0, Math.min(100, decimal * 100));
      const percentage = Math.round(rawPercentage * 100) / 100;
      normalized.push(percentage);
    }

    if (typeof validator === 'function' && !validator(normalized)) {
      return [...fallback];
    }

    return normalized;
  }

  normalizeTransparencyEffectiveness(values) {
    return this.normalizeEffectivenessArray(
      values,
      riskEngine.hrddStrategyLabels.length,
      riskEngine.defaultTransparencyEffectiveness,
      array => riskEngine.validateTransparency(array)
    );
  }

  normalizeResponsivenessEffectiveness(values) {
    return this.normalizeEffectivenessArray(
      values,
      riskEngine.responsivenessLabels.length,
      riskEngine.defaultResponsivenessEffectiveness,
      array => riskEngine.validateResponsivenessEffectiveness(array)
    );
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
      console.log('HRDD Risk Assessment Tool (5-Panel) initialized successfully');
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
            Complete 5-Panel Risk Management Tool - Loading...
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
      const portfolioMetrics = riskEngine.calculatePortfolioMetrics(
        this.state.selectedCountries,
        this.state.countryVolumes,
        this.state.countryRisks
      );
      this.state.baselineRisk = portfolioMetrics.baselineRisk;
      this.state.riskConcentration = portfolioMetrics.riskConcentration;
      console.log(`Baseline risk calculated: ${this.state.baselineRisk.toFixed(2)} (K=${this.state.riskConcentration.toFixed(3)})`);
    } catch (error) {
      console.error('Error calculating baseline risk:', error);
      this.state.baselineRisk = 0;
      this.state.riskConcentration = 1;
    }
  }

  calculateManagedRisk() {
    try {
      if (typeof riskEngine.calculateManagedRiskDetails === 'function') {
        const details = riskEngine.calculateManagedRiskDetails(
          this.state.selectedCountries,
          this.state.countryVolumes,
          this.state.countryRisks,
          this.state.hrddStrategy,
          this.state.transparencyEffectiveness,
          this.state.responsivenessStrategy,
          this.state.responsivenessEffectiveness,
          this.state.focus
        );

        this.state.managedRisk = Number.isFinite(details?.managedRisk)
          ? details.managedRisk
          : this.state.baselineRisk;
        this.state.countryManagedRisks = (details && details.countryManagedRisks)
          ? { ...details.countryManagedRisks }
          : {};

        if (Number.isFinite(details?.riskConcentration) && details.riskConcentration > 0) {
          this.state.riskConcentration = Math.max(1, details.riskConcentration);
        }

        console.log(`Managed risk calculated: ${this.state.managedRisk.toFixed(2)}`);
      } else if (typeof riskEngine.calculateManagedRisk === 'function') {
        this.state.managedRisk = riskEngine.calculateManagedRisk(
          this.state.baselineRisk,
          this.state.hrddStrategy,
          this.state.transparencyEffectiveness,
          this.state.responsivenessStrategy,
          this.state.responsivenessEffectiveness,
          this.state.focus,
          this.state.riskConcentration
        );
        this.state.countryManagedRisks = {};
        console.log(`Managed risk calculated: ${this.state.managedRisk.toFixed(2)}`);
      } else {
        this.state.managedRisk = this.state.baselineRisk;
        this.state.countryManagedRisks = {};
        console.log('Using baseline risk as managed risk (fallback)');
      }
    } catch (error) {
      console.error('Error calculating managed risk:', error);
      this.state.managedRisk = this.state.baselineRisk;
      this.state.countryManagedRisks = {};
    }
  }

  // Event handlers
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
    if (!newStrategy || !Array.isArray(newStrategy)) {
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
    if (!newTransparency || !Array.isArray(newTransparency)) {
      console.warn('Invalid transparency values provided:', newTransparency);
      return;
    }

    const normalizedTransparency = this.normalizeTransparencyEffectiveness(newTransparency);
    this.state.transparencyEffectiveness = normalizedTransparency;
    this.state.isDirty = true;

    if (this.transparencyTimeout) clearTimeout(this.transparencyTimeout);

    this.transparencyTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  onFocusChange = (newFocus) => {
    const numericFocus = typeof newFocus === 'number' ? newFocus : parseFloat(newFocus);

    if (isNaN(numericFocus)) {
      console.warn('Invalid focus value provided:', newFocus);
      return;
    }

    const clampedFocus = Math.max(0, Math.min(1, numericFocus));
    this.state.focus = clampedFocus;
    this.state.isDirty = true;

    if (this.focusTimeout) clearTimeout(this.focusTimeout);

    this.focusTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 200);
  }

  onResponsivenessChange = (newResponsiveness) => {
    if (!newResponsiveness || !Array.isArray(newResponsiveness)) {
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

  onResponsivenessEffectivenessChange = (newResponsivenessEffectiveness) => {
    if (!newResponsivenessEffectiveness || !Array.isArray(newResponsivenessEffectiveness)) {
      console.warn('Invalid responsiveness effectiveness values provided:', newResponsivenessEffectiveness);
      return;
    }

    const normalizedEffectiveness = this.normalizeResponsivenessEffectiveness(newResponsivenessEffectiveness);
    this.state.responsivenessEffectiveness = normalizedEffectiveness;
    this.state.isDirty = true;

    if (this.responsivenessEffectivenessTimeout) clearTimeout(this.responsivenessEffectivenessTimeout);

    this.responsivenessEffectivenessTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.updateUI();
      this.state.lastUpdate = new Date().toISOString();
    }, 300);
  }

  setCurrentPanel = (panel) => {
    if (panel >= 1 && panel <= 5) {
      this.state.currentPanel = panel;
      this.render();
      console.log(`Switched to panel ${panel}`);
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
    console.log(`Rendering HRDD tool - Panel ${this.state.currentPanel}`);
    
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

    const panelTitles = {
      1: 'Global Risks',
      2: 'Baseline Risk',
      3: 'HRDD Strategy',
      4: 'Response Strategy',
      5: 'Managed Risk'
    };

    // Main application layout with panel navigation
    container.innerHTML = `
      <div style="min-height: 100vh; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
        <div style="max-width: 1600px; margin: 0 auto; padding: 20px;">

          <!-- Header with Panel Navigation -->
          <header style="text-align: center; margin-bottom: 32px; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="font-size: 36px; font-weight: bold; color: #1f2937; margin-bottom: 12px; line-height: 1.2;">
              Labour Rights Due Diligence Risk Assessment
            </h1>
            <p style="font-size: 18px; color: #6b7280; margin-bottom: 24px;">
              Complete 5-Panel Risk Management and Effectiveness Analysis
            </p>
            
            <!-- Panel Navigation -->
            <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
              ${[1,2,3,4,5].map(panel => `
                <button onclick="window.hrddApp.setCurrentPanel(${panel})" 
                        style="padding: 10px 16px; border: 2px solid ${this.state.currentPanel === panel ? '#3b82f6' : '#d1d5db'}; 
                               background: ${this.state.currentPanel === panel ? '#3b82f6' : 'white'}; 
                               color: ${this.state.currentPanel === panel ? 'white' : '#6b7280'}; 
                               border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">
                  ${panel}. ${panelTitles[panel]}
                </button>
              `).join('')}
            </div>

            <!-- Status Bar -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px; color: #6b7280; flex-wrap: wrap;">
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

          <!-- Panel Content -->
          <div id="panelContent">
            ${this.renderCurrentPanel()}
          </div>

        </div>
      </div>
    `;

    // Call components after DOM is ready
    setTimeout(() => this.renderComponents(), 100);
  }

  renderCurrentPanel() {
    switch (this.state.currentPanel) {
      case 1: // Global Risks
        return `
          <!-- GLOBAL RISK MAP -->
          <div id="globalMapContainer" style="margin-bottom: 32px;"></div>

          <!-- GLOBAL WEIGHTINGS PANEL -->
          <div id="globalWeightingsPanel" style="margin-bottom: 32px;"></div>

          <!-- RISK ASSESSMENT SUMMARY -->
          <div id="globalRiskSummary"></div>
        `;

      case 2: // Baseline Risk
        return `
          <!-- BASELINE RISK MAP -->
          <div id="baselineMapContainer" style="margin-bottom: 32px;"></div>

          <!-- COUNTRY SELECTION & RESULTS -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;" id="selectionGrid">
            <div id="countrySelectionPanel"></div>
            <div id="resultsPanel"></div>
          </div>

          <!-- RISK ASSESSMENT SUMMARY -->
          <div id="baselineRiskSummary"></div>

          <style>
            @media (max-width: 768px) {
              #selectionGrid {
                grid-template-columns: 1fr !important;
              }
            }
          </style>
        `;

     case 3: // HRDD Strategy
        return `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;" id="panel3Grid">
            <div id="hrddStrategyPanel"></div>
            <div id="transparencyPanel"></div>
            <div id="focusPanel" style="grid-column: 1 / -1;"></div>
          </div>

          <style>
            @media (max-width: 768px) {
              #panel3Grid {
                grid-template-columns: 1fr !important;
              }
              #focusPanel {
                grid-column: 1 / -1 !important;
              }
            }
          </style>
        `;

      case 4: // Response Strategy
        return `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;" id="panel4Grid">
            <div id="responsivenessPanel"></div>
            <div id="responsivenessEffectivenessPanel"></div>
          </div>

          <!-- RISK ASSESSMENT SUMMARY -->
          <div id="responseRiskSummary"></div>

          <style>
            @media (max-width: 768px) {
              #panel4Grid {
                grid-template-columns: 1fr !important;
              }
            }
          </style>
        `;

      case 5: // Managed Risk
        return `
          <!-- BASELINE VS MANAGED COMPARISON MAPS -->
          <div style="margin-bottom: 32px;">
            <div id="baselineComparisonMapContainer" style="margin-bottom: 24px;"></div>
            <div id="managedComparisonMapContainer" style="margin-bottom: 24px;"></div>
          </div>

          <!-- FINAL RESULTS -->
          <div id="finalResultsPanel"></div>
        `;

      default:
        return this.renderCurrentPanel.call({...this, state: {...this.state, currentPanel: 1}});
    }
  }

  renderComponents() {
    try {
      const panel = this.state.currentPanel;
      console.log(`Rendering Panel ${panel} components`);

      if (panel === 1) {
        // Panel 1: Global Risks
        UIComponents.createGlobalRiskMap('globalMapContainer', {
          countries: this.state.countries,
          countryRisks: this.state.countryRisks,
          title: 'Global Labour Rights Risk Levels',
          height: 500,
          width: 1200
        });

        UIComponents.createWeightingsPanel('globalWeightingsPanel', {
          weights: this.state.weights,
          onWeightsChange: this.onWeightsChange
        });

        UIComponents.createRiskComparisonPanel('globalRiskSummary', {
          baselineRisk: this.state.baselineRisk,
          managedRisk: this.state.managedRisk,
          selectedCountries: this.state.selectedCountries
        });

      } else if (panel === 2) {
        // Panel 2: Baseline Risk
        UIComponents.createWorldMap('baselineMapContainer', {
          countries: this.state.countries,
          countryRisks: this.state.countryRisks,
          selectedCountries: this.state.selectedCountries,
          onCountrySelect: this.onCountrySelect,
          title: 'Select Countries for Portfolio Risk Assessment',
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

        UIComponents.createRiskComparisonPanel('baselineRiskSummary', {
          baselineRisk: this.state.baselineRisk,
          managedRisk: this.state.managedRisk,
          selectedCountries: this.state.selectedCountries
        });

      } else if (panel === 3) {
       } else if (panel === 3) {
        // Panel 3: HRDD Strategy
        UIComponents.createHRDDStrategyPanel('hrddStrategyPanel', {
          strategy: this.state.hrddStrategy,
          onStrategyChange: this.onHRDDStrategyChange,
          onFocusChange: this.onFocusChange
        });

        UIComponents.createTransparencyPanel('transparencyPanel', {
          transparency: this.state.transparencyEffectiveness,
          onTransparencyChange: this.onTransparencyChange
        });

        UIComponents.createFocusPanel('focusPanel', {
          focus: this.state.focus,
          onFocusChange: this.onFocusChange
        });

      } else if (panel === 4) {
        // Panel 4: Response Strategy
        UIComponents.createResponsivenessPanel('responsivenessPanel', {
          responsiveness: this.state.responsivenessStrategy,
          onResponsivenessChange: this.onResponsivenessChange
        });

        UIComponents.createResponsivenessEffectivenessPanel('responsivenessEffectivenessPanel', {
          effectiveness: this.state.responsivenessEffectiveness,
          onEffectivenessChange: this.onResponsivenessEffectivenessChange
        });

        UIComponents.createRiskComparisonPanel('responseRiskSummary', {
          baselineRisk: this.state.baselineRisk,
          managedRisk: this.state.managedRisk,
          selectedCountries: this.state.selectedCountries
        });

      } else if (panel === 5) {
        // Panel 5: Managed Risk
        UIComponents.createComparisonMap('baselineComparisonMapContainer', {
          countries: this.state.countries,
          countryRisks: this.state.countryRisks,
          selectedCountries: this.state.selectedCountries,
          title: 'Baseline Risk - Selected Countries Only',
          mapType: 'baseline',
          height: 400,
          width: 1200
        });

         UIComponents.createComparisonMap('managedComparisonMapContainer', {
          countries: this.state.countries,
          countryRisks: this.state.countryRisks,
          selectedCountries: this.state.selectedCountries,
          title: 'Managed Risk - Selected Countries Only',
          mapType: 'managed',
          managedRisk: this.state.managedRisk,
          selectedCountryRisks: this.state.countryManagedRisks,
          height: 400,
          width: 1200
        });

        UIComponents.createFinalResultsPanel('finalResultsPanel', {
          baselineRisk: this.state.baselineRisk,
          managedRisk: this.state.managedRisk,
          selectedCountries: this.state.selectedCountries,
          countries: this.state.countries,
          hrddStrategy: this.state.hrddStrategy,
          transparencyEffectiveness: this.state.transparencyEffectiveness,
          responsivenessStrategy: this.state.responsivenessStrategy,
          responsivenessEffectiveness: this.state.responsivenessEffectiveness,
          focus: this.state.focus,
          riskConcentration: this.state.riskConcentration
        });
      }

      console.log(`Panel ${panel} components rendered successfully`);
      
    } catch (error) {
      console.error('Error rendering components:', error);
    }
  }

  updateUI() {
    try {
      this.renderComponents();

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

      // Update selected countries display if exists
      if (typeof UIComponents.updateSelectedCountriesDisplay === 'function') {
        UIComponents.updateSelectedCountriesDisplay(
          this.state.selectedCountries,
          this.state.countries,
          this.state.countryVolumes,
          this.onCountrySelect,
          this.onVolumeChange
        );
      }

    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }

  // Utility methods (unchanged from original)
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
        responsivenessEffectiveness: this.state.responsivenessEffectiveness,
        focus: this.state.focus,
        currentPanel: this.state.currentPanel,
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
          this.state = {
            ...this.state,
            weights: parsedState.weights || this.state.weights,
            selectedCountries: parsedState.selectedCountries || this.state.selectedCountries,
            countryVolumes: parsedState.countryVolumes || this.state.countryVolumes,
            hrddStrategy: parsedState.hrddStrategy || this.state.hrddStrategy,
            transparencyEffectiveness: Object.prototype.hasOwnProperty.call(parsedState, 'transparencyEffectiveness')
              ? this.normalizeTransparencyEffectiveness(parsedState.transparencyEffectiveness)
              : this.state.transparencyEffectiveness,
            responsivenessStrategy: parsedState.responsivenessStrategy || this.state.responsivenessStrategy,
            responsivenessEffectiveness: Object.prototype.hasOwnProperty.call(parsedState, 'responsivenessEffectiveness')
              ? this.normalizeResponsivenessEffectiveness(parsedState.responsivenessEffectiveness)
              : this.state.responsivenessEffectiveness,
            focus: typeof parsedState.focus === 'number' ? parsedState.focus : this.state.focus,
            currentPanel: parsedState.currentPanel || this.state.currentPanel
          };
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
      { name: "India", isoCode: "IND", itucRightsRating: 90.0, corruptionIndex: 62.0, migrantWorkerPrevalence: 0.3, wjpIndex: 49.5, walkfreeSlaveryIndex: 8.0, baseRiskScore: 67 }
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
    const updates = { ...newState };

    if (Object.prototype.hasOwnProperty.call(updates, 'transparencyEffectiveness')) {
      updates.transparencyEffectiveness = this.normalizeTransparencyEffectiveness(updates.transparencyEffectiveness);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'responsivenessEffectiveness')) {
      updates.responsivenessEffectiveness = this.normalizeResponsivenessEffectiveness(updates.responsivenessEffectiveness);
    }

    this.state = { ...this.state, ...updates };
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.calculateManagedRisk();
    this.updateUI();
    this.state.lastUpdate = new Date().toISOString();
  }

  exportConfiguration() {
    try {
      const config = {
        weights: this.state.weights,
        selectedCountries: this.state.selectedCountries,
        countryVolumes: this.state.countryVolumes,
        hrddStrategy: this.state.hrddStrategy,
        transparencyEffectiveness: this.state.transparencyEffectiveness,
        responsivenessStrategy: this.state.responsivenessStrategy,
        responsivenessEffectiveness: this.state.responsivenessEffectiveness,
        baselineRisk: this.state.baselineRisk,
        managedRisk: this.state.managedRisk,
        focus: this.state.focus,
        riskConcentration: this.state.riskConcentration,
        focusMultiplier: (1 - this.state.focus) + this.state.focus * Math.max(1, this.state.riskConcentration),
        exportDate: new Date().toISOString(),
        version: '5.0'
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
    } catch (error) {
      console.error('Failed to export configuration:', error);
    }
  }

  destroy() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    if (this.weightsTimeout) clearTimeout(this.weightsTimeout);
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    if (this.strategyTimeout) clearTimeout(this.strategyTimeout);
    if (this.transparencyTimeout) clearTimeout(this.transparencyTimeout);
    if (this.responsivenessTimeout) clearTimeout(this.responsivenessTimeout);
    if (this.responsivenessEffectivenessTimeout) clearTimeout(this.responsivenessEffectivenessTimeout);
    if (this.focusTimeout) clearTimeout(this.focusTimeout);
    if (this.state.isDirty) this.saveState();
    console.log('App controller cleaned up');
  }
}