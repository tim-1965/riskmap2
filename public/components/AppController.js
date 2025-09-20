// AppController.js — cleaned and refactored for the 5-panel structure
// Implements Codex’s recommendations: class-based controller, state store,
// debounced updates, clear separation of data/service/UI concerns.

import { dataService } from './DataService.js';
import { riskEngine } from './RiskEngine.js';
import { UIComponents } from './UIComponents.js';
import { pdfGenerator } from './PDFGenerator.js';

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
      hrddStrategy: riskEngine.defaultHRDDStrategy || [5, 15, 25, 60, 80, 90],
      transparencyEffectiveness: this.normalizeTransparencyEffectiveness(
        riskEngine.defaultTransparencyEffectiveness || [90, 45, 25, 15, 12, 5]
      ),
      responsivenessStrategy: riskEngine.defaultResponsivenessStrategy || [20, 5, 25, 25, 10, 10],
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

  normalizeResponsivenessEffectiveness(arr) {
    // Expect 0..100 sliders in UI; riskEngine expects 0..100 (as %)
    return Array.isArray(arr) ? arr.map(v => Math.max(0, Math.min(100, parseFloat(v) || 0))) : [70, 85, 35, 25, 15, 5];
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
      this.restoreState();

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
    this.state.selectedCountries = Array.isArray(nextSelected) ? [...nextSelected] : [];
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
    const panelContent = this.containerElement.querySelector('#panelContent');
    if (panelContent) {
      panelContent.innerHTML = this.renderCurrentPanel();
    }
  }

  render() {
    if (!this.containerElement) return;

    const panelTitles = {
      1: 'Global Risks',
      2: 'Baseline Risk',
      3: 'HRDD Strategy',
      4: 'Response Strategy',
      5: 'Managed Risk'
    };

    // Top-level shell (header + panel nav + status bar)
    this.containerElement.innerHTML = `
      <div style="min-height:100vh;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;">
        <div style="max-width:1600px;margin:0 auto;padding:20px;">
          <header id="hrddAppHeader" style="position:sticky;top:16px;z-index:90;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;margin-bottom:24px;padding:18px 24px;background:rgba(255,255,255,0.95);border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,0.12);backdrop-filter:blur(6px);">
            <div style="display:flex;flex-direction:column;gap:6px;">
              <h1 style="font-size:28px;font-weight:700;color:#1f2937;margin:0;line-height:1.25;">Labour Rights Due Diligence Risk Assessment</h1>
              <p style="font-size:15px;color:#4b5563;margin:0;">Complete 5-Panel Coverage-Based Risk Management and Effectiveness Analysis</p>
            </div>

            <div class="panel-nav" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
              ${[1,2,3,4,5].map(panel => `
                <button onclick="window.hrddApp.setCurrentPanel(${panel})"
                        style="padding:8px 14px;border:2px solid ${this.state.currentPanel===panel?'#2563eb':'#d1d5db'};
                               background:${this.state.currentPanel===panel?'#2563eb':'white'};
                               color:${this.state.currentPanel===panel?'white':'#475569'};
                               border-radius:9999px;cursor:pointer;font-weight:600;transition:transform .2s,box-shadow .2s;font-size:13px;box-shadow:${this.state.currentPanel===panel?'0 10px 24px rgba(37,99,235,.3)':'0 4px 10px rgba(15,23,42,.08)'};">
                  ${panel}. ${panelTitles[panel]}
                </button>
              `).join('')}
            </div>

            <div class="status-bar" style="display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;color:#475569;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:8px;height:8px;border-radius:50%;background-color:${this.state.apiHealthy ? '#22c55e' : '#ef4444'};"></div>
                <span>API ${this.state.apiHealthy ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div style="opacity:.5;">•</div>
              <div>${this.state.countries.length} Countries</div>
              <div style="opacity:.5;">•</div>
              <div>${this.state.selectedCountries.length} Selected</div>
              ${this.state.lastUpdate ? `<div style="opacity:.5;">•</div><div>Updated: ${new Date(this.state.lastUpdate).toLocaleTimeString()}</div>` : ''}
            </div>

            <style>
              @media (max-width: 768px) {
                #hrddAppHeader { top: 0; padding: 14px 16px; margin-bottom: 16px; border-radius: 10px; }
                #hrddAppHeader h1 { font-size: 22px !important; }
                #hrddAppHeader p { font-size: 13px !important; }
                #hrddAppHeader .panel-nav { gap: 6px; }
                #hrddAppHeader .panel-nav button { font-size: 12px !important; padding: 7px 12px !important; }
                #hrddAppHeader .status-bar { gap: 8px; font-size: 12px !important; }
              }
            </style>
          </header>

          <div id="panelContent">
            ${this.renderCurrentPanel()}
          </div>
        </div>
      </div>
    `;
  }

  renderCurrentPanel() {
    // Panels are rendered via UIComponents into placeholder containers for flexibility
    // We return the shell here; UIComponents fill the inner divs with rich controls.
    const panel = this.state.currentPanel;

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
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="globalMapContainer"></div>
          <div id="weightingsPanel"></div>
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
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="baselineMapContainer"></div>
          <div id="countrySelectionPanel"></div>
          <div id="resultsPanel"></div>
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
        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div id="strategyRiskSummary"></div>
          <div id="hrddStrategyPanel"></div>
          <div id="transparencyPanel"></div>
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;" id="panel4Grid">
          <div id="responsivenessPanel"></div>
          <div id="responsivenessEffectivenessPanel"></div>
        </div>
        <div style="margin-top:16px;" id="responseRiskSummary"></div>
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

      await pdfGenerator.generate({
        baselineRisk: this.state.baselineRisk,
        managedRisk: this.state.managedRisk,
        selectedCountries: this.state.selectedCountries,
        focusEffectiveness: this.state.focusEffectivenessMetrics,
        hrddStrategy: this.state.hrddStrategy,
        transparencyEffectiveness: this.state.transparencyEffectiveness,
        responsivenessStrategy: this.state.responsivenessStrategy,
        responsivenessEffectiveness: this.state.responsivenessEffectiveness,
        focus: this.state.focus,
        riskConcentration: this.state.riskConcentration,
        countryVolumes: this.state.countryVolumes
      });

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
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed.weights)) this.state.weights = parsed.weights;
      if (Array.isArray(parsed.selectedCountries)) this.state.selectedCountries = parsed.selectedCountries;
      if (Array.isArray(parsed.hrddStrategy)) this.state.hrddStrategy = parsed.hrddStrategy;
      if (Array.isArray(parsed.transparencyEffectiveness)) this.state.transparencyEffectiveness = parsed.transparencyEffectiveness;
      if (Array.isArray(parsed.responsivenessStrategy)) this.state.responsivenessStrategy = parsed.responsivenessStrategy;
      if (Array.isArray(parsed.responsivenessEffectiveness)) this.state.responsivenessEffectiveness = parsed.responsivenessEffectiveness;
      if (typeof parsed.focus === 'number') this.state.focus = this.clamp01(parsed.focus);
      if (typeof parsed.riskConcentration === 'number') this.state.riskConcentration = parsed.riskConcentration;
      if (parsed.countryVolumes && typeof parsed.countryVolumes === 'object') this.state.countryVolumes = parsed.countryVolumes;
    } catch (e) {
      console.warn('restoreState failed:', e);
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
