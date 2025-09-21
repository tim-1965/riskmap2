// AppController.js — cleaned and refactored for the 5-panel structure
// Implements Codex’s recommendations: class-based controller, state store,
// debounced updates, clear separation of data/service/UI concerns.

import { dataService } from './DataService.js';
import { riskEngine } from './RiskEngine.js';
import { UIComponents } from './UIComponents.js';
import { pdfGenerator } from './PDFGenerator.js';

const PANEL_DESCRIPTIONS = {
  1: 'Calculate the global picture of labour rights risks using publicly-available indices from reputable organisations. The map (and its colouring) shows the risk levels and the user can change the weightings of the different indices below it. Then go to panel 2.',
  2: 'Click on the map to select which countries are in your supply chain. Below the map, you can optionally change the weighting of each country. You can weight the countries as you wish (number of suppliers, value of sourcing, number of workers etc..) Then go to panel 3.',
  3: 'Set out your supply chain due diligence progam across six different industry tools and the effectiveness of each. Set the extent to which your efforts are focussed on higher risk countries. Then go to panel 4.',
  4: 'Set out how you respond to issues that are found. Responsiveness is a key tool in managing risks (low response levels can increase risks, active responses can reduce risks). Then go to panel 5.',
  5: 'Here are your results showing your baseline risk level (panel 2) and how well you are managing it. You can see how each element in your strategy impacts your risks. You can print out a report capturing the analysis in full.'
};

function renderPanelDescription(panelNumber) {
  const description = PANEL_DESCRIPTIONS[panelNumber];
  if (!description) return '';
  return `
    <div style="padding:14px 18px;background:rgba(255,255,255,0.9);border:1px solid rgba(226,232,240,0.9);border-radius:12px;box-shadow:0 6px 16px rgba(15,23,42,0.06);">
      <p style="font-size:15px;color:#4b5563;margin:0;line-height:1.5;">${description}</p>
    </div>
  `;
}

export class AppController {
  constructor() {
    // App state (single source of truth)
    this.state = {
      // Data
      countries: [],
      weights: Array.isArray(riskEngine?.defaultWeights)
        ? [...riskEngine.defaultWeights]
        : [20, 20, 20, 20, 20],

      // Selection + volumes
      selectedCountries: [],
      countryVolumes: {},            // { ISO: number }
      countryRisks: {},              // { ISO: number }
      countryManagedRisks: {},       // { ISO: number }

      // Scalars
      baselineRisk: 0,
      managedRisk: 0,
      riskConcentration: 1,
      focus: typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6,

      // Strategy (coverage %) and effectiveness (%)
      hrddStrategy: riskEngine.defaultHRDDStrategy || [35, 15, 25, 60, 80, 90],
      transparencyEffectiveness: this.normalizeTransparencyEffectiveness(
        riskEngine.defaultTransparencyEffectiveness || [90, 45, 25, 15, 12, 5]
      ),
      responsivenessStrategy: riskEngine.defaultResponsivenessStrategy || [35, 5, 25, 25, 10, 10],
      responsivenessEffectiveness: this.normalizeResponsivenessEffectiveness(
        riskEngine.defaultResponsivenessEffectiveness || [70, 85, 35, 25, 15, 5]
      ),

      // Focus analytics (optional, shown when available)
      focusEffectivenessMetrics: null,

      // UI
      currentPanel: 1,      // 1..5
      loading: true,
      error: null,
      apiHealthy: false,
      lastUpdate: null,
      isDirty: false,
      isGeneratingReport: false
    };

    // Debounce timers
    this.weightsTimeout = null;
    this.volumeTimeout = null;
    this.strategyTimeout = null;
    this.transparencyTimeout = null;
    this.responsivenessTimeout = null;
    this.responsivenessEffectivenessTimeout = null;
    this.focusTimeout = null;

    // Retry policy for init
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;

    // Bind handlers (so they can be passed around safely)
    this.initialize = this.initialize.bind(this);
    this.render = this.render.bind(this);
    this.renderCurrentPanel = this.renderCurrentPanel.bind(this);
    this.setCurrentPanel = this.setCurrentPanel.bind(this);

    this.onWeightsChange = this.onWeightsChange.bind(this);
    this.onCountrySelect = this.onCountrySelect.bind(this);
    this.onVolumeChange = this.onVolumeChange.bind(this);
    this.onHRDDStrategyChange = this.onHRDDStrategyChange.bind(this);
    this.onTransparencyChange = this.onTransparencyChange.bind(this);
    this.onResponsivenessChange = this.onResponsivenessChange.bind(this);
    this.onResponsivenessEffectivenessChange = this.onResponsivenessEffectivenessChange.bind(this);
    this.onFocusChange = this.onFocusChange.bind(this);

    this.calculateAllRisks = this.calculateAllRisks.bind(this);
    this.calculateBaselineRisk = this.calculateBaselineRisk.bind(this);
   this.calculateManagedRisk = this.calculateManagedRisk.bind(this);

    this.generatePDFReport = this.generatePDFReport.bind(this);
    this.exportConfiguration = this.exportConfiguration.bind(this);
    this.saveState = this.saveState.bind(this);
    this.restoreState = this.restoreState.bind(this);
    this.loadSavedState = this.loadSavedState.bind(this);
    this.loadDemoData = this.loadDemoData.bind(this);
    this.getState = this.getState.bind(this);
    this.setState = this.setState.bind(this);
    this.setCurrentStep = this.setCurrentStep.bind(this);
    this.addCountry = this.addCountry.bind(this);
    this.removeCountry = this.removeCountry.bind(this);
    this.destroy = this.destroy.bind(this);

    // Container
    this.containerElement = null;

    // Expose for onclick handlers in rendered HTML (panel nav etc.)
    if (typeof window !== 'undefined') {
      window.hrddApp = this;
    }
  }

  /* --------------------------- Normalizers --------------------------- */

  normalizeTransparencyEffectiveness(arr) {
    // Expect 0..100 sliders in UI; riskEngine expects 0..1
    return Array.isArray(arr) ? arr.map(v => this.clamp01((parseFloat(v) || 0) / 100)) : [0.9, 0.45, 0.25, 0.15, 0.12, 0.05];
  }

  normalizeTransparencyEffectiveness(arr) {
    if (!Array.isArray(arr)) {
      return [90, 45, 25, 15, 12, 5];
    }

    return arr.map(value => {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed)) return 0;

      const scaled = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
      return Math.max(0, Math.min(100, scaled));
    });
  }

  normalizeResponsivenessEffectiveness(arr) {
    const defaultValues = Array.isArray(riskEngine?.defaultResponsivenessEffectiveness)
      ? [...riskEngine.defaultResponsivenessEffectiveness]
      : [70, 85, 35, 25, 15, 5];

    const expectedLength = Array.isArray(riskEngine?.responsivenessLabels)
      ? riskEngine.responsivenessLabels.length
      : defaultValues.length;

    const sanitized = new Array(expectedLength);

    for (let i = 0; i < expectedLength; i += 1) {
      const fallback = Number.isFinite(defaultValues[i]) ? defaultValues[i] : 0;

      if (!Array.isArray(arr)) {
        sanitized[i] = Math.max(0, Math.min(100, fallback));
        continue;
      }

      const parsed = parseFloat(arr[i]);
      if (!Number.isFinite(parsed)) {
        sanitized[i] = Math.max(0, Math.min(100, fallback));
        continue;
      }

      const scaled = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
      sanitized[i] = Math.max(0, Math.min(100, scaled));
    }

    return sanitized;
  }
  
  clamp01(v) {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  /* ----------------------------- Init ------------------------------- */

  async initialize(containerId) {
    try {
      this.containerElement = document.getElementById(containerId);
      if (!this.containerElement) {
        throw new Error('Container not found: ' + containerId);
      }

      this.state.loading = true;
      this.state.error = null;
      this.render();

      // Load countries from API / cache
      const countries = await dataService.getCountries();
      this.state.apiHealthy = true;
      this.state.countries = Array.isArray(countries) ? countries : [];

       // Restore any prior state (if present)
      this.loadSavedState();

      // Compute initial risks
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.calculateManagedRisk();

      this.state.loading = false;
      this.state.lastUpdate = new Date().toISOString();
      this.render();
    } catch (err) {
      console.error('Initialize failed:', err);
      this.state.loading = false;
      this.state.error = 'Failed to initialize: ' + (err?.message || 'Unknown error');
      this.state.apiHealthy = false;

      if (this.retryCount < this.maxRetries) {
        this.retryCount += 1;
        setTimeout(() => this.initialize(containerId), this.retryDelay);
      } else {
        this.render();
      }
    }
  }

  /* --------------------------- Calculations ------------------------- */

  validateCountryData(country) {
    return country && country.isoCode && typeof country === 'object';
  }

  calculateAllRisks() {
    try {
      const newCountryRisks = {};
      let calculated = 0;

      this.state.countries.forEach(country => {
        if (this.validateCountryData(country)) {
          newCountryRisks[country.isoCode] = riskEngine.calculateWeightedRisk(country, this.state.weights);
          calculated += 1;
        }
      });

      this.state.countryRisks = newCountryRisks;
      // console.log(`Calculated risks for ${calculated} countries`);
    } catch (e) {
      console.error('calculateAllRisks error:', e);
      this.state.error = 'Failed to calculate country risks';
    }
  }

  calculateBaselineRisk() {
    const { selectedCountries, countries, countryRisks, countryVolumes } = this.state;
    const summary = riskEngine.generateBaselineSummary(selectedCountries, countries, countryRisks, countryVolumes);
    this.state.baselineRisk = Number.isFinite(summary?.baselineRisk) ? summary.baselineRisk : 0;
  }

  calculateManagedRisk() {
    const {
      baselineRisk,
      selectedCountries,
      hrddStrategy,
      transparencyEffectiveness,
      responsivenessStrategy,
      responsivenessEffectiveness,
      focus,
      riskConcentration,
      countryVolumes,
      countryRisks
    } = this.state;

    const summary = riskEngine.generateRiskSummary(
      baselineRisk,
      null, // managedRisk (engine returns this)
      selectedCountries,
      hrddStrategy,
      transparencyEffectiveness,
      responsivenessStrategy,
      responsivenessEffectiveness,
      this.clamp01(focus),
      riskConcentration,
      countryVolumes,
      countryRisks
    ) || {};

    const managed = Number.isFinite(summary?.managed?.score) ? summary.managed.score : 0;
    this.state.managedRisk = managed;
    this.state.focusEffectivenessMetrics = summary?.focusEffectiveness || null;
    this.state.countryManagedRisks = summary?.countryManagedRisks || {};
  }

  /* ----------------------------- Handlers --------------------------- */

  onWeightsChange(newWeights) {
    if (!Array.isArray(newWeights)) return;
    clearTimeout(this.weightsTimeout);
    this.state.weights = [...newWeights];
    this.state.isDirty = true;

    this.weightsTimeout = setTimeout(() => {
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onCountrySelect(nextSelected) {
    let updatedSelection;

    if (Array.isArray(nextSelected)) {
      updatedSelection = nextSelected
        .map(code => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
        .filter(Boolean);
    } else if (typeof nextSelected === 'string') {
      const trimmed = nextSelected.trim().toUpperCase();
      if (!trimmed) return;
      const selectionSet = new Set(
        Array.isArray(this.state.selectedCountries)
          ? this.state.selectedCountries.map(code => (typeof code === 'string' ? code.trim().toUpperCase() : code))
          : []
      );
      if (selectionSet.has(trimmed)) {
        selectionSet.delete(trimmed);
      } else {
        selectionSet.add(trimmed);
      }
      updatedSelection = Array.from(selectionSet);
    } else {
      updatedSelection = [];
    }

    this.state.selectedCountries = updatedSelection;
    this.state.isDirty = true;

    // Recalculate baseline + managed on selection
    this.calculateBaselineRisk();
    this.calculateManagedRisk();
    this.state.lastUpdate = new Date().toISOString();
    this.updateUI();
  }
  

  onVolumeChange(isoCode, volume) {
    clearTimeout(this.volumeTimeout);
    const v = Math.max(0, parseFloat(volume) || 0);
    this.state.countryVolumes = { ...this.state.countryVolumes, [isoCode]: v };
    this.state.isDirty = true;

    this.volumeTimeout = setTimeout(() => {
      this.calculateBaselineRisk();
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onHRDDStrategyChange(next) {
    if (!Array.isArray(next)) return;
    clearTimeout(this.strategyTimeout);
    this.state.hrddStrategy = [...next];
    this.state.isDirty = true;

    this.strategyTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onTransparencyChange(next) {
    if (!Array.isArray(next)) return;
    clearTimeout(this.transparencyTimeout);
    this.state.transparencyEffectiveness = this.normalizeTransparencyEffectiveness(next);
    this.state.isDirty = true;

    this.transparencyTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onResponsivenessChange(next) {
    if (!Array.isArray(next)) return;
    clearTimeout(this.responsivenessTimeout);
    this.state.responsivenessStrategy = [...next];
    this.state.isDirty = true;

    this.responsivenessTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onResponsivenessEffectivenessChange(next) {
    if (!Array.isArray(next)) return;
    clearTimeout(this.responsivenessEffectivenessTimeout);
    this.state.responsivenessEffectiveness = this.normalizeResponsivenessEffectiveness(next);
    this.state.isDirty = true;

    this.responsivenessEffectivenessTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 300);
  }

  onFocusChange(next) {
    clearTimeout(this.focusTimeout);
    this.state.focus = this.clamp01(next);
    this.state.isDirty = true;

    this.focusTimeout = setTimeout(() => {
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.updateUI();
    }, 200);
  }

  /* ------------------------------- UI -------------------------------- */

  setCurrentPanel(panel) {
    if (panel >= 1 && panel <= 5) {
      this.state.currentPanel = panel;
      this.render();
    }
  }

   updateUI() {
    // Fast re-render for panels that depend on managed/baseline numbers
    if (!this.containerElement) return;

    const apiIndicator = this.containerElement.querySelector('#hrddApiIndicator');
    if (apiIndicator) {
      apiIndicator.style.backgroundColor = this.state.apiHealthy ? '#22c55e' : '#ef4444';
    }

    const apiStatus = this.containerElement.querySelector('#hrddApiStatus');
    if (apiStatus) {
      apiStatus.textContent = `API ${this.state.apiHealthy ? 'Connected' : 'Disconnected'}`;
    }

    const countryCountEl = this.containerElement.querySelector('#hrddCountryCount');
    if (countryCountEl) {
      countryCountEl.textContent = this.state.countries.length;
    }

    const selectedCountEl = this.containerElement.querySelector('#hrddSelectedCount');
    if (selectedCountEl) {
      selectedCountEl.textContent = this.state.selectedCountries.length;
    }

    const lastUpdatedGroup = this.containerElement.querySelector('#hrddLastUpdatedGroup');
    const lastUpdatedEl = this.containerElement.querySelector('#hrddLastUpdated');
    if (lastUpdatedGroup && lastUpdatedEl) {
      if (this.state.lastUpdate) {
        let formatted = '';
        try {
          formatted = new Date(this.state.lastUpdate).toLocaleTimeString();
        } catch (error) {
          formatted = '';
        }
        lastUpdatedGroup.style.display = 'flex';
        lastUpdatedEl.textContent = formatted ? `Updated: ${formatted}` : '';
      } else {
        lastUpdatedGroup.style.display = 'none';
        lastUpdatedEl.textContent = '';
      }
    }

    const panelContent = this.containerElement.querySelector('#panelContent');
    if (panelContent) {
      panelContent.innerHTML = this.renderCurrentPanel();
    }
  }

// In AppController.js, modify the render() method
// Replace the existing header and main sections with this updated version:

// In AppController.js, replace the render() method with this updated version:

// In AppController.js - Complete replacement for render() method only:

render() {
  if (!this.containerElement) return;

  const panelTitles = {
    1: 'Global Risks',
    2: 'Baseline Risk',
    3: 'HRDD Strategy',
    4: 'Response Strategy',
    5: 'Managed Risk'
  };

  this.containerElement.innerHTML = `
    <!-- Fixed Header -->
    <header style="position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(248,250,252,0.98);padding:20px 20px 12px;box-sizing:border-box;border-bottom:1px solid rgba(226,232,240,0.5);backdrop-filter:blur(10px);">
      <div style="width:100%;max-width:1600px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:12px 20px;background:rgba(255,255,255,0.9);border:1px solid rgba(226,232,240,0.8);border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.08);">
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
          <h1 style="font-size:28px;font-weight:700;color:#1f2937;margin:0;line-height:1.25;">Labour Rights Due Diligence Risk Assessment</h1>
          <p style="font-size:15px;color:#4b5563;margin:0;">Complete 5-Panel Coverage-Based Risk Management and Effectiveness Analysis</p>
        </div>

        <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
          ${[1,2,3,4,5].map(panel => `
            <button onclick="window.hrddApp.setCurrentPanel(${panel})"
                    style="padding:6px 12px;border:1px solid ${this.state.currentPanel===panel?'#2563eb':'#d1d5db'};
                           background:${this.state.currentPanel===panel?'#2563eb':'rgba(255,255,255,0.9)'};
                           color:${this.state.currentPanel===panel?'white':'#475569'};
                           border-radius:9999px;cursor:pointer;font-weight:600;transition:all .2s;font-size:12px;box-shadow:${this.state.currentPanel===panel?'0 8px 18px rgba(37,99,235,.25)':'0 3px 8px rgba(15,23,42,.08)'};">
              ${panel}. ${panelTitles[panel]}
            </button>
          `).join('')}
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#475569;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:50%;background-color:${this.state.apiHealthy ? '#22c55e' : '#ef4444'};"></div>
            <span>API ${this.state.apiHealthy ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div style="opacity:.5;">•</div>
          <div><span>${this.state.countries.length}</span> Countries</div>
          <div style="opacity:.5;">•</div>
          <div><span>${this.state.selectedCountries.length}</span> Selected</div>
          ${this.state.lastUpdate ? `
            <div style="opacity:.5;">•</div>
            <div>Updated: ${new Date(this.state.lastUpdate).toLocaleTimeString()}</div>
          ` : ''}
        </div>
      </div>
    </header>

    <!-- Content with padding for fixed header -->
    <main style="padding-top:180px;min-height:100vh;background-color:#f8fafc;box-sizing:border-box;">
      <div style="width:100%;max-width:1600px;margin:0 auto;padding:0 20px 40px;box-sizing:border-box;">
        <div id="panelContent">
          ${this.renderCurrentPanel()}
        </div>
      </div>
    </main>

    <style>
      /* Simple reset for consistent scrolling */
      html {
        scroll-behavior: smooth;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        background-color: #f8fafc;
      }
      
      /* Responsive header */
      @media (max-width: 768px) {
        main {
          padding-top: 160px !important;
        }
      }
      
      /* High z-index for overlays */
      .map-tooltip {
        z-index: 10000 !important;
      }
      
      #pdfLoadingModal {
        z-index: 10001 !important;
      }
    </style>
  `;
}

// Keep your existing renderCurrentPanel() method as is, but ensure each panel returns content with sufficient height:
renderCurrentPanel() {
  const panel = this.state.currentPanel;

  if (this.state.loading) {
    return `
      <div style="display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 220px);padding:20px;">
        <div style="padding:16px 20px;border:1px solid #e5e7eb;border-radius:10px;background:white;box-shadow:0 8px 20px rgba(2,6,23,.08);">
          Loading data…
        </div>
      </div>
    `;
  }
  
  if (this.state.error) {
    return `
      <div style="min-height:calc(100vh - 220px);padding:20px;">
        <div style="padding:16px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2;color:#7f1d1d;">
          ${this.state.error}
        </div>
      </div>
    `;
  }

  // For panels 1-4, ensure minimum height to guarantee scrollability
  const ensureMinHeight = (content) => `
    <div style="min-height:calc(100vh - 200px);padding-bottom:40px;">
      ${content}
    </div>
  `;

  if (panel === 1) {
    // Global Risks (overview map + weightings)
    const html = ensureMinHeight(`
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${renderPanelDescription(panel)}
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="globalMapContainer" style="min-height:500px;"></div>
          <div id="weightingsPanel" style="min-height:400px;"></div>
        </div>
      </div>
    `);

    queueMicrotask(() => {
      UIComponents.createWorldMap('globalMapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        onCountrySelect: this.onCountrySelect,
        title: 'Global Risk Overview',
        height: 500,
        width: 1200
      });

      UIComponents.createWeightingsPanel('weightingsPanel', {
        weights: this.state.weights,
        onWeightsChange: this.onWeightsChange
      });
    });
    return html;
  }

  if (panel === 2) {
    // Baseline Risk (selection map + country list + summary)
    const html = ensureMinHeight(`
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${renderPanelDescription(panel)}
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="baselineMapContainer" style="min-height:500px;"></div>
          <div id="countrySelectionPanel" style="min-height:300px;"></div>
          <div id="resultsPanel" style="min-height:400px;"></div>
        </div>
      </div>
    `);

    queueMicrotask(() => {
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
    });
    return html;
  }

  if (panel === 3) {
    // HRDD Strategy (coverage + transparency + focus + summary)
    const html = ensureMinHeight(`
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${renderPanelDescription(panel)}
        <div id="strategyRiskSummary" style="min-height:300px;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;" id="panel3Grid">
          <div id="hrddStrategyPanel" style="min-height:600px;"></div>
          <div id="transparencyPanel" style="min-height:600px;"></div>
        </div>
        <div id="focusPanel" style="min-height:400px;"></div>
      </div>
    `);

    queueMicrotask(() => {
      UIComponents.createRiskComparisonPanel('strategyRiskSummary', {
        baselineRisk: this.state.baselineRisk,
        managedRisk: this.state.managedRisk,
        selectedCountries: this.state.selectedCountries,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
      });

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
        onFocusChange: this.onFocusChange,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
      });
    });
    return html;
  }

  if (panel === 4) {
    // Response Strategy (mix + effectiveness + risk summary)
    const html = ensureMinHeight(`
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${renderPanelDescription(panel)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;" id="panel4Grid">
          <div id="responsivenessPanel" style="min-height:600px;"></div>
          <div id="responsivenessEffectivenessPanel" style="min-height:600px;"></div>
        </div>
        <div id="responseRiskSummary" style="min-height:300px;"></div>
      </div>
    `);

    queueMicrotask(() => {
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
        selectedCountries: this.state.selectedCountries,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
      });
    });
    return html;
  }

  // Panel 5 - Managed Risk (comparison maps + final results + export/report)
  const html = ensureMinHeight(`
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${renderPanelDescription(panel)}
      <div style="display:grid;grid-template-columns:1fr;gap:16px;">
        <div id="baselineComparisonMapContainer" style="min-height:400px;"></div>
        <div id="managedComparisonMapContainer" style="min-height:400px;"></div>
        <div id="finalResultsPanel" style="min-height:600px;"></div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button id="btnExportConfig" style="padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;background:white;cursor:pointer;">Export Configuration (JSON)</button>
          <button id="btnGeneratePDF" style="padding:10px 14px;border:1px solid #2563eb;background:#2563eb;color:white;border-radius:8px;cursor:pointer;">
            ${this.state.isGeneratingReport ? 'Generating…' : 'Generate PDF Report'}
          </button>
        </div>
      </div>
    </div>
  `);
  
  queueMicrotask(() => {
    UIComponents.createComparisonMap('baselineComparisonMapContainer', {
      countries: this.state.countries,
      countryRisks: this.state.countryRisks,
      selectedCountries: this.state.selectedCountries,
      title: 'Baseline Risk - Selected Countries Only',
      mapType: 'baseline',
      baselineRisk: this.state.baselineRisk,
      focus: this.state.focus,
      focusEffectivenessMetrics: this.state.focusEffectivenessMetrics,
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
      focus: this.state.focus,
      focusEffectivenessMetrics: this.state.focusEffectivenessMetrics,
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
      riskConcentration: this.state.riskConcentration,
      countryVolumes: this.state.countryVolumes,
      countryRisks: this.state.countryRisks,
      focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
    });

    const btnExport = document.getElementById('btnExportConfig');
    if (btnExport) btnExport.onclick = this.exportConfiguration;

    const btnPDF = document.getElementById('btnGeneratePDF');
    if (btnPDF) btnPDF.onclick = this.generatePDFReport;
  });
  return html;
}

  renderCurrentPanel() {
    // Panels are rendered via UIComponents into placeholder containers for flexibility
    // We return the shell here; UIComponents fill the inner divs with rich controls.
    const panel = this.state.currentPanel;
    
    // Add this at the start of renderCurrentPanel() method:
    function renderPanelDescription(panelNumber) {
      const description = PANEL_DESCRIPTIONS[panelNumber];
      if (!description) return '';
    return `
      <div style="padding:14px 18px;background:rgba(255,255,255,0.9);border:1px solid rgba(226,232,240,0.9);border-radius:12px;box-shadow:0 6px 16px rgba(15,23,42,0.06);">
      <p style="font-size:15px;color:#4b5563;margin:0;line-height:1.5;">${description}</p>
      </div>
      `;
    }
    
    if (this.state.loading) {
      return `
        <div style="display:flex;align-items:center;justify-content:center;height:40vh;">
          <div style="padding:16px 20px;border:1px solid #e5e7eb;border-radius:10px;background:white;box-shadow:0 8px 20px rgba(2,6,23,.08);">
            Loading data…
          </div>
        </div>
      `;
    }
    if (this.state.error) {
      return `
        <div style="padding:16px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2;color:#7f1d1d;">
          ${this.state.error}
        </div>
      `;
    }

     if (panel === 1) {
      // Global Risks (overview map + weightings)
      // Shell:
      const html = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${renderPanelDescription(panel)}
          <div style="display:grid;grid-template-columns:1fr;gap:16px;">
            <div id="globalMapContainer"></div>
            <div id="weightingsPanel"></div>
          </div>
        </div>
      `;

      // Defer actual rendering to next microtask so the nodes exist
      queueMicrotask(() => {
        UIComponents.createWorldMap('globalMapContainer', {
          countries: this.state.countries,
          countryRisks: this.state.countryRisks,
          selectedCountries: this.state.selectedCountries,
          onCountrySelect: this.onCountrySelect,
          title: 'Global Risk Overview',
          height: 500,
          width: 1200
        });

        UIComponents.createWeightingsPanel('weightingsPanel', {
          weights: this.state.weights,
          onWeightsChange: this.onWeightsChange
        });
      });
      return html;
    }

    if (panel === 2) {
      // Baseline Risk (selection map + country list + summary)
      const html = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${renderPanelDescription(panel)}
          <div style="display:grid;grid-template-columns:1fr;gap:16px;">
            <div id="baselineMapContainer"></div>
            <div id="countrySelectionPanel"></div>
            <div id="resultsPanel"></div>
          </div>
        </div>
      `;

      queueMicrotask(() => {
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
      });
      return html;
    }

     if (panel === 3) {
      // HRDD Strategy (coverage + transparency + focus + summary)
      const html = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${renderPanelDescription(panel)}
          <div id="strategyRiskSummary"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;" id="panel3Grid">
            <div id="hrddStrategyPanel" style="height:100%;"></div>
            <div id="transparencyPanel" style="height:100%;"></div>
          </div>
          <div id="focusPanel"></div>
        </div>
      `;

      queueMicrotask(() => {
        UIComponents.createRiskComparisonPanel('strategyRiskSummary', {
          baselineRisk: this.state.baselineRisk,
          managedRisk: this.state.managedRisk,
          selectedCountries: this.state.selectedCountries,
          focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
        });

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
          onFocusChange: this.onFocusChange,
          focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
        });
      });
      return html;
    }

    if (panel === 4) {
      // Response Strategy (mix + effectiveness + risk summary)
      const html = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${renderPanelDescription(panel)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;" id="panel4Grid">
            <div id="responsivenessPanel"></div>
            <div id="responsivenessEffectivenessPanel"></div>
          </div>
          <div id="responseRiskSummary"></div>
        </div>
      `;

      queueMicrotask(() => {
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
          selectedCountries: this.state.selectedCountries,
          focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
        });
      });
      return html;
    }

    // Panel 5 — Managed Risk (comparison maps + final results + export/report)
     const html = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${renderPanelDescription(panel)}
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="baselineComparisonMapContainer"></div>
          <div id="managedComparisonMapContainer"></div>
          <div id="finalResultsPanel"></div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="btnExportConfig" style="padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;background:white;cursor:pointer;">Export Configuration (JSON)</button>
            <button id="btnGeneratePDF" style="padding:10px 14px;border:1px solid #2563eb;background:#2563eb;color:white;border-radius:8px;cursor:pointer;">
              ${this.state.isGeneratingReport ? 'Generating…' : 'Generate PDF Report'}
            </button>
          </div>
        </div>
      </div>
    `;
    
    queueMicrotask(() => {
      UIComponents.createComparisonMap('baselineComparisonMapContainer', {
        countries: this.state.countries,
        countryRisks: this.state.countryRisks,
        selectedCountries: this.state.selectedCountries,
        title: 'Baseline Risk - Selected Countries Only',
        mapType: 'baseline',
        baselineRisk: this.state.baselineRisk,
        focus: this.state.focus,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics,
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
        focus: this.state.focus,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics,
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
        riskConcentration: this.state.riskConcentration,
        countryVolumes: this.state.countryVolumes,
        countryRisks: this.state.countryRisks,
        focusEffectivenessMetrics: this.state.focusEffectivenessMetrics
      });

      const btnExport = document.getElementById('btnExportConfig');
      if (btnExport) btnExport.onclick = this.exportConfiguration;

      const btnPDF = document.getElementById('btnGeneratePDF');
      if (btnPDF) btnPDF.onclick = this.generatePDFReport;
    });
    return html;
  }

  /* ------------------------ Export & Reporting ----------------------- */

  async generatePDFReport() {
    if (typeof document === 'undefined') {
      console.warn('PDF report generation is only available in a browser environment.');
      return;
    }

    try {
      this.state.isGeneratingReport = true;
      this.updateUI();

    await pdfGenerator.generateReport(this);

      console.log('PDF generated');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      this.state.isGeneratingReport = false;
      this.updateUI();
    }
  }

  exportConfiguration = async () => {
    try {
      const config = {
        exportedAt: new Date().toISOString(),
        version: '5.0',
        data: (() => ({
          countries: this.state.countries,
          selectedCountries: this.state.selectedCountries,
          weights: this.state.weights,
          hrddStrategy: this.state.hrddStrategy,
          transparencyEffectiveness: this.state.transparencyEffectiveness,
          responsivenessStrategy: this.state.responsivenessStrategy,
          responsivenessEffectiveness: this.state.responsivenessEffectiveness,
          focus: this.state.focus,
          riskConcentration: this.state.riskConcentration,
          countryVolumes: this.state.countryVolumes
        }))()
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
  };

  /* ----------------------- External Integrations ------------------------ */

  loadSavedState() {
    const restored = this.restoreState();
    if (restored) {
      this.calculateAllRisks();
      this.calculateBaselineRisk();
      this.calculateManagedRisk();
      this.state.lastUpdate = new Date().toISOString();
      this.state.isDirty = false;
    }
    return restored;
  }

  loadDemoData() {
    const demoCountries = [
      {
        name: 'Bangladesh',
        isoCode: 'BGD',
        itucRightsRating: 68,
        corruptionIndex: 25,
        migrantWorkerPrevalence: 42,
        wjpIndex: 30,
        walkfreeSlaveryIndex: 48,
        baseRiskScore: 58
      },
      {
        name: 'Vietnam',
        isoCode: 'VNM',
        itucRightsRating: 64,
        corruptionIndex: 36,
        migrantWorkerPrevalence: 29,
        wjpIndex: 45,
        walkfreeSlaveryIndex: 38,
        baseRiskScore: 52
      },
      {
        name: 'Brazil',
        isoCode: 'BRA',
        itucRightsRating: 52,
        corruptionIndex: 38,
        migrantWorkerPrevalence: 24,
        wjpIndex: 54,
        walkfreeSlaveryIndex: 32,
        baseRiskScore: 46
      },
      {
        name: 'Germany',
        isoCode: 'DEU',
        itucRightsRating: 18,
        corruptionIndex: 80,
        migrantWorkerPrevalence: 12,
        wjpIndex: 79,
        walkfreeSlaveryIndex: 15,
        baseRiskScore: 28
      }
    ];

    this.state.countries = demoCountries.map(country => ({ ...country }));
    this.state.selectedCountries = demoCountries.slice(0, 3).map(country => country.isoCode);
    this.state.countryVolumes = {
      BGD: 30,
      VNM: 20,
      BRA: 15
    };
    this.state.apiHealthy = false;
    this.state.error = null;
    this.state.loading = false;

    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.calculateManagedRisk();

    this.state.lastUpdate = new Date().toISOString();
    this.state.isDirty = false;

    if (this.containerElement) {
      this.render();
    }
  }

  getState() {
    const snapshot = {
      ...this.state,
      countries: Array.isArray(this.state.countries)
        ? this.state.countries.map(country => ({ ...country }))
        : [],
      selectedCountries: Array.isArray(this.state.selectedCountries)
        ? [...this.state.selectedCountries]
        : [],
      weights: Array.isArray(this.state.weights) ? [...this.state.weights] : [],
      hrddStrategy: Array.isArray(this.state.hrddStrategy) ? [...this.state.hrddStrategy] : [],
      transparencyEffectiveness: Array.isArray(this.state.transparencyEffectiveness)
        ? [...this.state.transparencyEffectiveness]
        : [],
      responsivenessStrategy: Array.isArray(this.state.responsivenessStrategy)
        ? [...this.state.responsivenessStrategy]
        : [],
      responsivenessEffectiveness: Array.isArray(this.state.responsivenessEffectiveness)
        ? [...this.state.responsivenessEffectiveness]
        : [],
      countryVolumes: this.state.countryVolumes ? { ...this.state.countryVolumes } : {},
      countryRisks: this.state.countryRisks ? { ...this.state.countryRisks } : {},
      countryManagedRisks: this.state.countryManagedRisks ? { ...this.state.countryManagedRisks } : {}
    };

    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(snapshot);
      }
    } catch (error) {
      console.warn('structuredClone failed, falling back to JSON clone:', error);
    }

    return JSON.parse(JSON.stringify(snapshot));
  }

  setState(partialState = {}) {
    if (!partialState || typeof partialState !== 'object') {
      return;
    }

    const assignArray = (key, normalizer) => {
      if (Array.isArray(partialState[key])) {
        this.state[key] = normalizer(partialState[key]);
        return true;
      }
      return false;
    };

    assignArray('countries', arr => arr.map(country => ({ ...country })));
    assignArray('selectedCountries', arr => Array.from(new Set(arr)));
    assignArray('weights', arr => [...arr]);
    assignArray('hrddStrategy', arr => [...arr]);
    assignArray('transparencyEffectiveness', arr => this.normalizeTransparencyEffectiveness(arr));
    assignArray('responsivenessStrategy', arr => [...arr]);
    assignArray('responsivenessEffectiveness', arr => this.normalizeResponsivenessEffectiveness(arr));

    if (typeof partialState.focus === 'number') {
      this.state.focus = this.clamp01(partialState.focus);
    }
    if (typeof partialState.riskConcentration === 'number') {
      this.state.riskConcentration = partialState.riskConcentration;
    }
    if (partialState.countryVolumes && typeof partialState.countryVolumes === 'object') {
      const normalizedVolumes = {};
      Object.entries(partialState.countryVolumes).forEach(([key, value]) => {
        if (typeof key === 'string') {
          normalizedVolumes[key.trim().toUpperCase()] = value;
        }
      });
      this.state.countryVolumes = normalizedVolumes;
    }
    if (partialState.countryRisks && typeof partialState.countryRisks === 'object') {
      const normalizedRisks = {};
      Object.entries(partialState.countryRisks).forEach(([key, value]) => {
        if (typeof key === 'string') {
          normalizedRisks[key.trim().toUpperCase()] = value;
        }
      });
      this.state.countryRisks = normalizedRisks;
    }
    if (partialState.countryManagedRisks && typeof partialState.countryManagedRisks === 'object') {
      const normalizedManaged = {};
      Object.entries(partialState.countryManagedRisks).forEach(([key, value]) => {
        if (typeof key === 'string') {
          normalizedManaged[key.trim().toUpperCase()] = value;
        }
      });
      this.state.countryManagedRisks = normalizedManaged;
    }

    const simpleKeys = [
      'baselineRisk',
      'managedRisk',
      'loading',
      'error',
      'apiHealthy',
      'lastUpdate',
      'isGeneratingReport'
    ];
    simpleKeys.forEach(key => {
      if (partialState[key] !== undefined) {
        this.state[key] = partialState[key];
      }
    });

    if (typeof partialState.currentPanel === 'number') {
      this.state.currentPanel = Math.max(1, Math.min(5, Math.round(partialState.currentPanel)));
    }

    this.state.isDirty = true;
    this.calculateAllRisks();
    this.calculateBaselineRisk();
    this.calculateManagedRisk();
    this.state.lastUpdate = new Date().toISOString();

    if (this.containerElement) {
      this.render();
    }
  }

  setCurrentStep(step) {
    this.setCurrentPanel(step);
  }

  addCountry(isoCode, volume = null) {
    if (typeof isoCode !== 'string') return;
    const normalized = isoCode.trim().toUpperCase();
    if (!normalized) return;

    const nextSelection = Array.from(new Set([...this.state.selectedCountries, normalized]));
    this.onCountrySelect(nextSelection);

    if (volume !== null) {
      this.onVolumeChange(normalized, volume);
    }
  }

  removeCountry(isoCode) {
    if (typeof isoCode !== 'string') return;
    const normalized = isoCode.trim().toUpperCase();
    if (!normalized) return;

    const { [normalized]: _, ...remainingVolumes } = this.state.countryVolumes || {};
    this.state.countryVolumes = remainingVolumes;

    const nextSelection = this.state.selectedCountries.filter(code => code !== normalized);
    this.onCountrySelect(nextSelection);
  }

  /* ---------------------------- Persistence -------------------------- */

  saveState() {
    try {
      const snapshot = {
        selectedCountries: this.state.selectedCountries,
        weights: this.state.weights,
        hrddStrategy: this.state.hrddStrategy,
        transparencyEffectiveness: this.state.transparencyEffectiveness,
        responsivenessStrategy: this.state.responsivenessStrategy,
        responsivenessEffectiveness: this.state.responsivenessEffectiveness,
        focus: this.state.focus,
        riskConcentration: this.state.riskConcentration,
        countryVolumes: this.state.countryVolumes
      };
      localStorage.setItem('hrdd_app_state_v5', JSON.stringify(snapshot));
      this.state.isDirty = false;
    } catch (e) {
      console.warn('saveState failed:', e);
    }
  }

  restoreState() {
    try {
      const raw = localStorage.getItem('hrdd_app_state_v5');
      if (!raw) return false;
      const parsed = JSON.parse(raw);

      let restored = false;

      if (Array.isArray(parsed.weights)) {
        this.state.weights = [...parsed.weights];
        restored = true;
      }
      if (Array.isArray(parsed.selectedCountries)) {
        this.state.selectedCountries = parsed.selectedCountries
          .map(code => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
          .filter(Boolean);
        restored = true;
      }
      if (Array.isArray(parsed.hrddStrategy)) {
        this.state.hrddStrategy = [...parsed.hrddStrategy];
        restored = true;
      }
      if (Array.isArray(parsed.transparencyEffectiveness)) {
        this.state.transparencyEffectiveness = this.normalizeTransparencyEffectiveness(parsed.transparencyEffectiveness);
        restored = true;
      }
      if (Array.isArray(parsed.responsivenessStrategy)) {
        this.state.responsivenessStrategy = [...parsed.responsivenessStrategy];
        restored = true;
      }
      if (Array.isArray(parsed.responsivenessEffectiveness)) {
        this.state.responsivenessEffectiveness = this.normalizeResponsivenessEffectiveness(parsed.responsivenessEffectiveness);
        restored = true;
      }
      if (typeof parsed.focus === 'number') {
        this.state.focus = this.clamp01(parsed.focus);
        restored = true;
      }
      if (typeof parsed.riskConcentration === 'number') {
        this.state.riskConcentration = parsed.riskConcentration;
        restored = true;
      }
      if (parsed.countryVolumes && typeof parsed.countryVolumes === 'object') {
        const normalizedVolumes = {};
        Object.entries(parsed.countryVolumes).forEach(([key, value]) => {
          if (typeof key === 'string') {
            normalizedVolumes[key.trim().toUpperCase()] = value;
          }
        });
        this.state.countryVolumes = normalizedVolumes;
        restored = true;
      }

      this.state.isDirty = false;
      return restored;
    } catch (e) {
      console.warn('restoreState failed:', e);
      return false;
    }
  }

  /* ------------------------------ Cleanup ---------------------------- */

  destroy() {
    if (this.weightsTimeout) clearTimeout(this.weightsTimeout);
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    if (this.strategyTimeout) clearTimeout(this.strategyTimeout);
    if (this.transparencyTimeout) clearTimeout(this.transparencyTimeout);
    if (this.responsivenessTimeout) clearTimeout(this.responsivenessTimeout);
    if (this.responsivenessEffectivenessTimeout) clearTimeout(this.responsivenessEffectivenessTimeout);
    if (this.focusTimeout) clearTimeout(this.focusTimeout);

    if (this.state.isDirty) this.saveState();
    console.log('AppController cleaned up');
  }
}
