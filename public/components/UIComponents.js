// UIComponents.js - Updated for 5-panel HRDD tool structure
import { riskEngine } from './RiskEngine.js';

export class UIComponents {
  
  // Panel 1: Global Risk Map (non-interactive, shows all countries with current risk levels)
  static async createGlobalRiskMap(containerId, { countries, countryRisks, title, height = 500, width = 960 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="global-risk-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>
        <div id="map-loading" style="padding: 40px; color: #6b7280;">
          <div>Loading global risk map...</div>
          <div style="font-size: 14px; margin-top: 8px;">Hover over countries to see their risk levels.</div>
        </div>
        <div id="map-wrapper" style="width: 100%; display: flex; justify-content: center; margin-bottom: 16px;">
          <!-- D3 Map will be inserted here -->
        </div>
        <div class="risk-legend" id="mapLegend" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          <!-- Legend will be inserted here -->
        </div>
      </div>
    `;

    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    try {
      await this._loadD3();
      const worldData = await this._loadWorldData();

      if (worldData?.type === 'Topology') {
        try {
          await this._loadTopoJSON();
        } catch (topojsonError) {
          console.warn('TopoJSON library unavailable - using internal converter instead.', topojsonError);
        }
      }

      this._renderGlobalD3Map(worldData, {
        container: 'map-wrapper',
        countries,
        countryRisks: safeCountryRisks,
        width,
        height: Math.max(height, 400)
      });

      this._createMapLegend('mapLegend');
      
      const loadingElement = document.getElementById('map-loading');
      if (loadingElement) loadingElement.remove();

    } catch (error) {
      console.error('Error creating global risk map:', error);
      this._createFallbackMap(containerId, {
        countries,
        countryRisks: safeCountryRisks,
        title,
        interactive: false
      });
    }
  }

  // Panel 5: Comparison Maps (shows only selected countries)
  static async createComparisonMap(containerId, { countries, countryRisks, selectedCountries, title, mapType = 'baseline', managedRisk = null, height = 400, width = 960 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const displayTitle = mapType === 'managed' ? 
      `${title} - Overall Risk: ${managedRisk ? managedRisk.toFixed(1) : 'N/A'}` : 
      title;

    container.innerHTML = `
      <div class="comparison-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${displayTitle}</h3>
        <div id="comp-map-loading-${mapType}" style="padding: 30px; color: #6b7280;">
          <div>Loading comparison map...</div>
          <div style="font-size: 14px; margin-top: 8px;">Showing selected countries only for comparison.</div>
        </div>
        <div id="comp-map-wrapper-${mapType}" style="width: 100%; display: flex; justify-content: center; margin-bottom: 16px;">
          <!-- D3 Map will be inserted here -->
        </div>
        <div class="risk-legend" id="compMapLegend-${mapType}" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          <!-- Legend will be inserted here -->
        </div>
      </div>
    `;

    const safeSelectedCountries = Array.isArray(selectedCountries) ? selectedCountries : [];
    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    // Filter to show only selected countries
    const selectedCountriesData = countries.filter(country => 
      safeSelectedCountries.includes(country.isoCode)
    );

    if (selectedCountriesData.length === 0) {
      const loadingElement = document.getElementById(`comp-map-loading-${mapType}`);
      if (loadingElement) {
        loadingElement.innerHTML = `
          <div style="padding: 20px; color: #6b7280; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">🏭</div>
            <p>No countries selected for comparison</p>
            <p style="font-size: 14px; margin-top: 8px;">Select countries in Panel 2 to see the comparison maps.</p>
          </div>
        `;
      }
      return;
    }

    try {
      await this._loadD3();
      const worldData = await this._loadWorldData();

      if (worldData?.type === 'Topology') {
        try {
          await this._loadTopoJSON();
        } catch (topojsonError) {
          console.warn('TopoJSON library unavailable - using internal converter instead.', topojsonError);
        }
      }

      // For managed risk map, use the single managed risk value for all selected countries
      const displayRisks = mapType === 'managed' && managedRisk !== null ? 
        this._createManagedRiskDisplay(safeSelectedCountries, managedRisk) : 
        safeCountryRisks;

      this._renderComparisonD3Map(worldData, {
        container: `comp-map-wrapper-${mapType}`,
        countries: selectedCountriesData, // Only selected countries
        countryRisks: displayRisks,
        selectedCountries: safeSelectedCountries,
        width,
        height: Math.max(height, 300),
        mapType
      });

      this._createMapLegend(`compMapLegend-${mapType}`);
      
      const loadingElement = document.getElementById(`comp-map-loading-${mapType}`);
      if (loadingElement) loadingElement.remove();

    } catch (error) {
      console.error('Error creating comparison map:', error);
      this._createFallbackComparisonMap(containerId, {
        countries: selectedCountriesData,
        countryRisks: safeCountryRisks,
        selectedCountries: safeSelectedCountries,
        title: displayTitle,
        mapType
      });
    }
  }

  static _createManagedRiskDisplay(selectedCountries, managedRisk) {
    const managedRiskDisplay = {};
    selectedCountries.forEach(countryCode => {
      managedRiskDisplay[countryCode] = managedRisk;
    });
    return managedRiskDisplay;
  }

  // Enhanced World Map Component (keeps existing functionality for Panel 2)
  static async createWorldMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title, mapType = 'baseline', managedRisk = null, height = 500, width = 960 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const displayTitle = mapType === 'managed' ? 
      `${title} - Managed Risk: ${managedRisk ? managedRisk.toFixed(1) : 'N/A'}` : 
      title;

    container.innerHTML = `
      <div class="world-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${displayTitle}</h3>
        <div id="map-loading" style="padding: 40px; color: #6b7280;">
          <div>Loading world map...</div>
          <div style="font-size: 14px; margin-top: 8px;">Click on countries to select them for your portfolio.</div>
        </div>
        <div id="map-wrapper" style="width: 100%; display: flex; justify-content: center; margin-bottom: 16px;">
          <!-- D3 Map will be inserted here -->
        </div>
        <div class="risk-legend" id="mapLegend" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          <!-- Legend will be inserted here -->
        </div>
      </div>
    `;

    const safeSelectedCountries = Array.isArray(selectedCountries) ? selectedCountries : [];
    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    try {
      await this._loadD3();
      const worldData = await this._loadWorldData();

      if (worldData?.type === 'Topology') {
        try {
          await this._loadTopoJSON();
        } catch (topojsonError) {
          console.warn('TopoJSON library unavailable - using internal converter instead.', topojsonError);
        }
      }

      const displayRisks = mapType === 'managed' && managedRisk !== null ? 
        this._createManagedRiskDisplay(safeSelectedCountries, managedRisk) : 
        safeCountryRisks;

      this._renderD3Map(worldData, {
        container: 'map-wrapper',
        countries,
        countryRisks: displayRisks,
        selectedCountries: safeSelectedCountries,
        onCountrySelect,
        width,
        height: Math.max(height, 600),
        mapType
      });

      this._createMapLegend('mapLegend');
      
      const loadingElement = document.getElementById('map-loading');
      if (loadingElement) loadingElement.remove();

    } catch (error) {
      console.error('Error creating world map:', error);
      this._createFallbackMap(containerId, {
        countries,
        countryRisks: safeCountryRisks,
        selectedCountries: safeSelectedCountries,
        onCountrySelect,
        title: displayTitle
      });
    }
  }

  // Risk Comparison Panel (used in multiple panels)
  static createRiskComparisonPanel(containerId, { baselineRisk, managedRisk, selectedCountries }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hasSelections = selectedCountries.length > 0;
    
    if (!hasSelections) {
      container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
          <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #1f2937;">Risk Assessment Summary</h2>
          <div style="color: #6b7280; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🏭</div>
            <p>Select countries in Panel 2 to see your risk assessment summary</p>
          </div>
        </div>
      `;
      return;
    }

    const summary = riskEngine.generateRiskSummary(
      baselineRisk,
      managedRisk,
      selectedCountries,
      [], [], [], [], 0, 1 // Using empty arrays for strategies since this is used across panels
    );

    const baselineScore = Number.isFinite(summary.baseline?.score) ? summary.baseline.score : 0;
    const baselineColor = summary.baseline?.color || riskEngine.getRiskColor(baselineScore);
    const baselineBand = summary.baseline?.band || riskEngine.getRiskBand(baselineScore);
    const managedScore = Number.isFinite(summary.managed?.score) ? summary.managed.score : 0;
    const managedColor = summary.managed?.color || riskEngine.getRiskColor(managedScore);
    const managedBand = summary.managed?.band || riskEngine.getRiskBand(managedScore);
    const riskReduction = Number.isFinite(summary.improvement?.riskReduction)
      ? summary.improvement.riskReduction
      : 0;
    const absoluteReduction = Number.isFinite(summary.improvement?.absoluteReduction)
      ? summary.improvement.absoluteReduction
      : 0;
    const changePrefix = riskReduction > 0 ? '-' : riskReduction < 0 ? '+' : '';
    const changeColor = riskReduction > 0 ? '#22c55e' : riskReduction < 0 ? '#ef4444' : '#6b7280';
    const changeLabel = riskReduction > 0 ? 'Improvement' : riskReduction < 0 ? 'Increase' : 'No Change';
    const changeDetail = Math.abs(absoluteReduction) > 0
      ? `${absoluteReduction > 0 ? 'Risk reduced' : 'Risk increased'} by ${Math.abs(absoluteReduction).toFixed(1)} pts`
      : 'Risk level unchanged';

    container.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-top: 4px solid #3b82f6;">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: center; color: #1f2937;">
          Risk Assessment Summary
        </h2>

        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: stretch; margin-bottom: 20px;">
          <!-- Baseline Risk -->
          <div style="padding: 24px; border-radius: 12px; border: 3px solid ${baselineColor}; background-color: ${baselineColor}15; text-align: center;">
            <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">BASELINE RISK</div>
            <div style="font-size: 48px; font-weight: bold; color: ${baselineColor}; margin-bottom: 8px;">
              ${baselineScore.toFixed(1)}
            </div>
            <div style="font-size: 16px; font-weight: 600; color: ${baselineColor};">
              ${baselineBand}
            </div>
          </div>

          <!-- Risk Change -->
          <div style="padding: 24px; border-radius: 12px; border: 3px solid ${changeColor}; background-color: ${changeColor}15; text-align: center;">
            <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">RISK CHANGE</div>
            <div style="font-size: 48px; font-weight: bold; color: ${changeColor}; margin-bottom: 8px;">
              ${changePrefix}${Math.abs(riskReduction).toFixed(1)}%
            </div>
            <div style="font-size: 16px; font-weight: 600; color: ${changeColor};">
              ${changeLabel}
            </div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 6px;">
              ${changeDetail}
            </div>
          </div>

          <!-- Managed Risk -->
          <div style="padding: 24px; border-radius: 12px; border: 3px solid ${managedColor}; background-color: ${managedColor}15; text-align: center;">
            <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">MANAGED RISK</div>
            <div style="font-size: 48px; font-weight: bold; color: ${managedColor}; margin-bottom: 8px;">
              ${managedScore.toFixed(1)}
            </div>
            <div style="font-size: 16px; font-weight: 600; color: ${managedColor};">
              ${managedBand}
            </div>
          </div>
        </div>

        <div style="text-align: center; padding: 12px; background-color: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd;">
          <span style="font-size: 14px; color: #0369a1;">
            Portfolio: ${selectedCountries.length} countries • 
            ${riskReduction > 0 ? 'Strategy shows improvement' : 'Consider refining your approach'}
          </span>
        </div>
      </div>

      <style>
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      </style>
    `;
  }

  // Panel 3: HRDD Strategy Panel (unchanged)
  static createHRDDStrategyPanel(containerId, { strategy, focus, onStrategyChange, onFocusChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const strategyLabels = riskEngine.hrddStrategyLabels;
    const strategyDescriptions = [
      'Always-on digital or in-person worker voice capturing daily conditions.',
      'Structured worker surveys undertaken at least quarterly.',
      'Surprise third-party social audits without advance warning.',
      'Planned or supplier-arranged social audits.',
      'Supplier self-reporting and self-assessment questionnaires.',
      'Desk-based risk assessment only with no direct engagement.'
    ];

    let localStrategy = [...strategy];
    const defaultFocus = typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6;
    let localFocus = typeof focus === 'number' ? focus : defaultFocus;

    const describeFocus = (value) => {
      if (value >= 0.9) return 'Crisis / SEV surge posture';
      if (value >= 0.7) return 'Targeted worker voice & triage';
      if (value >= 0.4) return 'Risk-led monitoring programme';
      if (value >= 0.1) return 'Legacy calendar-led audits';
      return 'Even portfolio coverage';
    };

    const updateStrategy = () => {
      const total = localStrategy.reduce((sum, w) => sum + w, 0);
      const totalElement = document.getElementById('totalStrategy');
      if (totalElement) {
        totalElement.textContent = total;
        totalElement.style.color = '#374151';
      }
      if (onStrategyChange) onStrategyChange([...localStrategy]);
    };

    container.innerHTML = `
      <div class="hrdd-strategy-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">HRDD Strategy Mix</h2>
          <button id="resetStrategy" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Reset to Default
          </button>
        </div>
        
        <div id="strategyContainer" style="margin-bottom: 20px;"></div>
        
        <div style="font-size: 14px; color: #6b7280; padding: 12px; background-color: #f9fafb; border-radius: 6px; text-align: center;">
          Total Strategy Weight: <span id="totalStrategy" style="font-weight: 600; font-size: 16px;">${localStrategy.reduce((sum, w) => sum + w, 0)}</span>%
          <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">(can exceed 100% - represents strategy mix allocation)</span>
        </div>

        <div style="background-color: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Strategy Guide:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Higher percentages = more resources allocated to that monitoring tool.</li>
            <li>Combine approaches to mirror your actual HRDD portfolio.</li>
            <li>Each tool carries an evidence-based transparency assumption (Step 2B).</li>
          </ul>
        </div>

        <div style="margin-top: 24px; padding: 20px; border-radius: 10px; border: 1px solid #bfdbfe; background-color: #eff6ff;">
          <h3 style="font-size: 16px; font-weight: 600; color: #1d4ed8; margin-bottom: 8px;">Focus on High-Risk Countries</h3>
          <p style="font-size: 13px; color: #1e3a8a; margin-bottom: 12px;">
            Focus concentrates your monitoring and remediation effort on the highest-risk countries without increasing total effort.
          </p>
          <div style="font-size: 14px; color: #1f2937; font-weight: 600;">
            Focus Level: <span id="focusValue">${localFocus.toFixed(2)}</span>
            <span style="font-size: 13px; font-weight: 500; color: #1d4ed8;">(<span id="focusPercent">${Math.round(localFocus * 100)}</span>% effort • <span id="focusDescriptor">${describeFocus(localFocus)}</span>)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 12px;">
            <input type="range" min="0" max="1" step="0.05" value="${localFocus.toFixed(2)}" id="focusSlider" style="flex: 1; height: 8px; border-radius: 4px; background-color: #bfdbfe;">
            <input type="number" min="0" max="1" step="0.05" value="${localFocus.toFixed(2)}" id="focusNumber" style="width: 90px; padding: 8px 12px; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 14px; text-align: center;">
          </div>
          <ul style="margin-top: 12px; font-size: 12px; color: #1e3a8a; padding-left: 18px; line-height: 1.5;">
            <li><strong>0.00 – 0.10:</strong> Even effort across the portfolio.</li>
            <li><strong>0.10 – 0.30:</strong> Legacy audit programmes, calendar-driven.</li>
            <li><strong>0.40 – 0.60:</strong> Risk-led programmes with targeted surveys.</li>
            <li><strong>0.70 – 0.90:</strong> Continuous worker voice with triaged CAPs.</li>
            <li><strong>0.90 – 1.00:</strong> Crisis posture concentrating on hotspots.</li>
          </ul>
        </div>
      </div>
    `;

    const strategyContainer = document.getElementById('strategyContainer');
    strategyLabels.forEach((label, index) => {
      const strategyControl = document.createElement('div');
      strategyControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
      strategyControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
          ${label} <span id="strategyValue_${index}" style="font-weight: 600; color: #1f2937;">(${localStrategy[index]}%)</span>
        </label>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
          ${strategyDescriptions[index]}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="100" value="${localStrategy[index]}" id="strategy_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
          <input type="number" min="0" max="100" value="${localStrategy[index]}" id="strategyNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
      `;
      strategyContainer.appendChild(strategyControl);

      const rangeInput = document.getElementById(`strategy_${index}`);
      const numberInput = document.getElementById(`strategyNum_${index}`);
      const valueDisplay = document.getElementById(`strategyValue_${index}`);

      const updateStrategyWeight = (value) => {
        const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
        localStrategy[index] = newValue;
        rangeInput.value = newValue;
        numberInput.value = newValue;
        valueDisplay.textContent = `(${newValue}%)`;
        updateStrategy();
      };

      rangeInput.addEventListener('input', (e) => updateStrategyWeight(e.target.value));
      numberInput.addEventListener('input', (e) => updateStrategyWeight(e.target.value));
    });

    const focusSlider = document.getElementById('focusSlider');
    const focusNumber = document.getElementById('focusNumber');
    const focusValueDisplay = document.getElementById('focusValue');
    const focusPercentDisplay = document.getElementById('focusPercent');
    const focusDescriptorDisplay = document.getElementById('focusDescriptor');

    const updateFocus = (value, { emit = true } = {}) => {
      const numericValue = parseFloat(value);
      if (Number.isNaN(numericValue)) return;

      const clamped = Math.max(0, Math.min(1, numericValue));
      localFocus = clamped;

      const formatted = clamped.toFixed(2);
      if (focusSlider) focusSlider.value = formatted;
      if (focusNumber) focusNumber.value = formatted;
      if (focusValueDisplay) focusValueDisplay.textContent = formatted;
      if (focusPercentDisplay) focusPercentDisplay.textContent = Math.round(clamped * 100);
      if (focusDescriptorDisplay) focusDescriptorDisplay.textContent = describeFocus(clamped);

      if (emit && typeof onFocusChange === 'function') {
        onFocusChange(clamped);
      }
    };

    if (focusSlider) {
      focusSlider.addEventListener('input', (e) => updateFocus(e.target.value));
    }
    if (focusNumber) {
      focusNumber.addEventListener('input', (e) => updateFocus(e.target.value));
    }

    const resetButton = document.getElementById('resetStrategy');
    resetButton.addEventListener('click', () => {
      localStrategy = [...riskEngine.defaultHRDDStrategy];
      localStrategy.forEach((weight, index) => {
        document.getElementById(`strategy_${index}`).value = weight;
        document.getElementById(`strategyNum_${index}`).value = weight;
        document.getElementById(`strategyValue_${index}`).textContent = `(${weight}%)`;
      });
      updateStrategy();
      updateFocus(defaultFocus);
    });

    updateFocus(localFocus, { emit: false });
  }

  // Panel 3: Transparency Effectiveness Panel (unchanged)
  static createTransparencyPanel(containerId, { transparency, onTransparencyChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const strategyLabels = riskEngine.hrddStrategyLabels;
    const effectivenessDescriptions = [
      '0.80 – 0.90 of actual risks revealed (continuous worker voice).',
      '0.40 – 0.50 of risks revealed (quarterly worker surveys).',
      '0.20 – 0.30 of risks revealed (unannounced audits).',
      '0.10 – 0.20 of risks revealed (announced audits).',
      '0.05 – 0.15 of risks revealed (supplier self-reporting).',
      '0.05 – 0.10 of risks revealed (desk-based assessments).' 
    ];

    let localTransparency = [...transparency];

    const updateTransparency = () => {
      if (onTransparencyChange) onTransparencyChange([...localTransparency]);
    };

    container.innerHTML = `
      <div class="transparency-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Transparency Effectiveness</h2>
          <button id="resetTransparency" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Reset to Default
          </button>
        </div>
        
        <div id="transparencyContainer" style="margin-bottom: 20px;"></div>

        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #78350f;">Understanding Transparency:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Higher percentages = a greater share of hidden labour risks uncovered.</li>
            <li>Values represent mid-point assumptions for each monitoring tool.</li>
            <li>Your strategy mix (Panel 3A) weights these assumptions into an overall transparency score.</li>
          </ul>
        </div>
      </div>
    `;

    const transparencyContainer = document.getElementById('transparencyContainer');
    strategyLabels.forEach((label, index) => {
      const effectivenessColor = localTransparency[index] >= 70 ? '#22c55e' : 
                                 localTransparency[index] >= 40 ? '#f59e0b' : '#ef4444';
      
      const transparencyControl = document.createElement('div');
      transparencyControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
      transparencyControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
          ${label}
          <span id="transparencyValue_${index}" style="font-weight: 600; color: ${effectivenessColor};">(${localTransparency[index]}%)</span>
        </label>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
          ${effectivenessDescriptions[index]}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="100" value="${localTransparency[index]}" id="transparency_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
          <input type="number" min="0" max="100" value="${localTransparency[index]}" id="transparencyNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
        <div style="margin-top: 8px; height: 4px; background-color: #e5e7eb; border-radius: 2px;">
          <div style="height: 100%; width: ${localTransparency[index]}%; background-color: ${effectivenessColor}; border-radius: 2px; transition: all 0.3s;"></div>
        </div>
      `;
      transparencyContainer.appendChild(transparencyControl);

      const rangeInput = document.getElementById(`transparency_${index}`);
      const numberInput = document.getElementById(`transparencyNum_${index}`);
      const valueDisplay = document.getElementById(`transparencyValue_${index}`);

      const updateTransparencyValue = (value) => {
        const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
        const newColor = newValue >= 70 ? '#22c55e' : newValue >= 40 ? '#f59e0b' : '#ef4444';
        
        localTransparency[index] = newValue;
        rangeInput.value = newValue;
        numberInput.value = newValue;
        valueDisplay.textContent = `(${newValue}%)`;
        valueDisplay.style.color = newColor;
        
        const progressBar = transparencyControl.querySelector('div:last-child div');
        if (progressBar) {
          progressBar.style.width = `${newValue}%`;
          progressBar.style.backgroundColor = newColor;
        }
        
        updateTransparency();
      };

      rangeInput.addEventListener('input', (e) => updateTransparencyValue(e.target.value));
      numberInput.addEventListener('input', (e) => updateTransparencyValue(e.target.value));
    });

    const resetButton = document.getElementById('resetTransparency');
    resetButton.addEventListener('click', () => {
      localTransparency = [...riskEngine.defaultTransparencyEffectiveness];
      localTransparency.forEach((effectiveness, index) => {
        const newColor = effectiveness >= 70 ? '#22c55e' : effectiveness >= 40 ? '#f59e0b' : '#ef4444';
        document.getElementById(`transparency_${index}`).value = effectiveness;
        document.getElementById(`transparencyNum_${index}`).value = effectiveness;
        document.getElementById(`transparencyValue_${index}`).textContent = `(${effectiveness}%)`;
        document.getElementById(`transparencyValue_${index}`).style.color = newColor;
        
        const progressBar = transparencyContainer.children[index].querySelector('div:last-child div');
        if (progressBar) {
          progressBar.style.width = `${effectiveness}%`;
          progressBar.style.backgroundColor = newColor;
        }
      });
      updateTransparency();
    });
  }

  // Panel 4: Responsiveness Strategy Panel (unchanged)
  static createResponsivenessPanel(containerId, { responsiveness, onResponsivenessChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const responsivenessLabels = riskEngine.responsivenessLabels;
    const responsivenessDescriptions = [
      'No structured remediation. Issues are left unaddressed or dismissed.',
      'Case-by-case fixes when problems surface, without systemic change.',
      'Corrective action plans agreed with suppliers to fix identified problems.',
      'Longer-term capability building with suppliers (training, incentives).',
      'Commercial requirements align purchasing power to rights outcomes.',
      'Collective agreements or binding frameworks that shift sector behaviour.'
    ];

    let localResponsiveness = [...responsiveness];

    const updateResponsiveness = () => {
      const total = localResponsiveness.reduce((sum, w) => sum + w, 0);
      const totalElement = document.getElementById('totalResponsiveness');
      if (totalElement) {
        totalElement.textContent = total;
        totalElement.style.color = '#374151';
      }
      if (onResponsivenessChange) onResponsivenessChange([...localResponsiveness]);
    };

    container.innerHTML = `
      <div class="responsiveness-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Response Strategy Mix</h2>
          <button id="resetResponsiveness" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Reset to Default
          </button>
        </div>
        
        <div id="responsivenessContainer" style="margin-bottom: 20px;"></div>
        
        <div style="font-size: 14px; color: #6b7280; padding: 12px; background-color: #f9fafb; border-radius: 6px; text-align: center;">
          Total Strategy Weight: <span id="totalResponsiveness" style="font-weight: 600; font-size: 16px;">${localResponsiveness.reduce((sum, w) => sum + w, 0)}</span>%
          <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">(can exceed 100% - represents strategy allocation)</span>
        </div>

        <div style="background-color: #e0f2fe; border: 1px solid #0891b2; color: #0e7490; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #155e75;">Response Strategy Portfolio:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Higher percentages = deeper investment in that remediation lever.</li>
            <li>Combine quick fixes with systemic levers for durable change.</li>
            <li>Effectiveness assumptions for each lever are set out in Panel 4B.</li>
          </ul>
        </div>
      </div>
    `;

    const responsivenessContainer = document.getElementById('responsivenessContainer');
    responsivenessLabels.forEach((label, index) => {
      const responsivenessControl = document.createElement('div');
      responsivenessControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
      responsivenessControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
          ${label} <span id="responsivenessValue_${index}" style="font-weight: 600; color: #1f2937;">(${localResponsiveness[index]}%)</span>
        </label>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
          ${responsivenessDescriptions[index]}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="100" value="${localResponsiveness[index]}" id="responsiveness_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
          <input type="number" min="0" max="100" value="${localResponsiveness[index]}" id="responsivenessNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
      `;
      responsivenessContainer.appendChild(responsivenessControl);

      const rangeInput = document.getElementById(`responsiveness_${index}`);
      const numberInput = document.getElementById(`responsivenessNum_${index}`);
      const valueDisplay = document.getElementById(`responsivenessValue_${index}`);

      const updateResponsivenessValue = (value) => {
        const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
        localResponsiveness[index] = newValue;
        rangeInput.value = newValue;
        numberInput.value = newValue;
        valueDisplay.textContent = `(${newValue}%)`;
        updateResponsiveness();
      };

      rangeInput.addEventListener('input', (e) => updateResponsivenessValue(e.target.value));
      numberInput.addEventListener('input', (e) => updateResponsivenessValue(e.target.value));
    });

    const resetButton = document.getElementById('resetResponsiveness');
    resetButton.addEventListener('click', () => {
      localResponsiveness = [...riskEngine.defaultResponsivenessStrategy];
      localResponsiveness.forEach((weight, index) => {
        document.getElementById(`responsiveness_${index}`).value = weight;
        document.getElementById(`responsivenessNum_${index}`).value = weight;
        document.getElementById(`responsivenessValue_${index}`).textContent = `(${weight}%)`;
      });
      updateResponsiveness();
    });
  }

  // Panel 4: Responsiveness Effectiveness Panel (unchanged)
  static createResponsivenessEffectivenessPanel(containerId, { effectiveness, onEffectivenessChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const responsivenessLabels = riskEngine.responsivenessLabels;
    const effectivenessDescriptions = [
      '0.00 – 0.10 reduction in risk (little to no remediation).',
      '0.20 – 0.30 reduction when issues are handled reactively.',
      '0.40 – 0.60 reduction delivered via corrective action plans.',
      '0.50 – 0.70 reduction through supplier capability building.',
      '0.60 – 0.80 reduction when commercial levers are binding.',
      '0.70 – 0.90 reduction through industry collaboration.'
    ];

    let localEffectiveness = [...effectiveness];

    const updateEffectiveness = () => {
      if (onEffectivenessChange) onEffectivenessChange([...localEffectiveness]);
    };

    container.innerHTML = `
      <div class="responsiveness-effectiveness-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Response Effectiveness</h2>
          <button id="resetResponsivenessEffectiveness" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Reset to Default
          </button>
        </div>
        
        <div id="responsivenessEffectivenessContainer" style="margin-bottom: 20px;"></div>

        <div style="background-color: #e0f2fe; border: 1px solid #0891b2; color: #0e7490; padding: 16px; border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #155e75;">Understanding Response Effectiveness:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Higher percentages = deeper reductions in residual risk when issues are addressed.</li>
            <li>Ranges reflect evidence-informed assumptions for each remediation lever.</li>
            <li>Your Panel 4A portfolio weights these assumptions into an overall response effectiveness score.</li>
          </ul>
        </div>
      </div>
    `;

    const effectivenessContainer = document.getElementById('responsivenessEffectivenessContainer');
    responsivenessLabels.forEach((label, index) => {
      const effectivenessColor = localEffectiveness[index] >= 75 ? '#15803d' :
                                 localEffectiveness[index] >= 60 ? '#22c55e' :
                                 localEffectiveness[index] >= 50 ? '#84cc16' :
                                 localEffectiveness[index] >= 30 ? '#facc15' :
                                 localEffectiveness[index] >= 15 ? '#f97316' : '#ef4444';
      
      const effectivenessControl = document.createElement('div');
      effectivenessControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
      effectivenessControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
          ${label}
          <span id="effectivenessValue_${index}" style="font-weight: 600; color: ${effectivenessColor};">(${localEffectiveness[index]}%)</span>
        </label>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
          ${effectivenessDescriptions[index]}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="100" value="${localEffectiveness[index]}" id="effectiveness_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
          <input type="number" min="0" max="100" value="${localEffectiveness[index]}" id="effectivenessNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
        <div style="margin-top: 8px; height: 4px; background-color: #e5e7eb; border-radius: 2px;">
          <div style="height: 100%; width: ${localEffectiveness[index]}%; background-color: ${effectivenessColor}; border-radius: 2px; transition: all 0.3s;"></div>
        </div>
      `;
      effectivenessContainer.appendChild(effectivenessControl);

      const rangeInput = document.getElementById(`effectiveness_${index}`);
      const numberInput = document.getElementById(`effectivenessNum_${index}`);
      const valueDisplay = document.getElementById(`effectivenessValue_${index}`);

      const updateEffectivenessValue = (value) => {
        const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
        const newColor = newValue >= 75 ? '#15803d' :
                        newValue >= 60 ? '#22c55e' :
                        newValue >= 50 ? '#84cc16' :
                        newValue >= 30 ? '#facc15' :
                        newValue >= 15 ? '#f97316' : '#ef4444';
        
        localEffectiveness[index] = newValue;
        rangeInput.value = newValue;
        numberInput.value = newValue;
        valueDisplay.textContent = `(${newValue}%)`;
        valueDisplay.style.color = newColor;
        
        const progressBar = effectivenessControl.querySelector('div:last-child div');
        if (progressBar) {
          progressBar.style.width = `${newValue}%`;
          progressBar.style.backgroundColor = newColor;
        }
        
        updateEffectiveness();
      };

      rangeInput.addEventListener('input', (e) => updateEffectivenessValue(e.target.value));
      numberInput.addEventListener('input', (e) => updateEffectivenessValue(e.target.value));
    });

    const resetButton = document.getElementById('resetResponsivenessEffectiveness');
    resetButton.addEventListener('click', () => {
      localEffectiveness = [...riskEngine.defaultResponsivenessEffectiveness];
      localEffectiveness.forEach((effectiveness, index) => {
        const newColor = effectiveness >= 75 ? '#15803d' :
                        effectiveness >= 60 ? '#22c55e' :
                        effectiveness >= 50 ? '#84cc16' :
                        effectiveness >= 30 ? '#facc15' :
                        effectiveness >= 15 ? '#f97316' : '#ef4444';
                        
        document.getElementById(`effectiveness_${index}`).value = effectiveness;
        document.getElementById(`effectivenessNum_${index}`).value = effectiveness;
        document.getElementById(`effectivenessValue_${index}`).textContent = `(${effectiveness}%)`;
        document.getElementById(`effectivenessValue_${index}`).style.color = newColor;
        
        const progressBar = effectivenessContainer.children[index].querySelector('div:last-child div');
        if (progressBar) {
          progressBar.style.width = `${effectiveness}%`;
          progressBar.style.backgroundColor = newColor;
        }
      });
      updateEffectiveness();
    });
  }

  // Panel 5: Final Results Panel (unchanged but without Risk Assessment Summary)
  static createFinalResultsPanel(containerId, { baselineRisk, managedRisk, selectedCountries, countries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus = 0, riskConcentration = 1 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const riskReduction = riskEngine.calculateRiskReduction(baselineRisk, managedRisk);
    const isImprovement = managedRisk < baselineRisk;
    const summary = riskEngine.generateRiskSummary(baselineRisk, managedRisk, selectedCountries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus, riskConcentration);
    const focusData = summary.strategy?.focus || { level: 0, portfolioMultiplier: 1, concentration: 1 };
    const focusPercent = Math.round((focusData.level || 0) * 100);
    const focusMultiplier = focusData.portfolioMultiplier || 1;
    const concentrationFactor = summary.portfolio?.riskConcentration ?? 1;

    container.innerHTML = `
      <div class="final-results-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Final Risk Assessment Results</h2>

        <!-- Strategy Effectiveness Analysis -->
        <div style="margin-bottom: 24px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #374151;">Strategy Effectiveness Analysis</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
            <div>
              <h4 style="font-size: 14px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">TRANSPARENCY EFFECTIVENESS</h4>
              <div style="font-size: 28px; font-weight: bold; color: #3b82f6; margin-bottom: 4px;">
                ${(summary.strategy.overallTransparency * 100).toFixed(1)}%
              </div>
              <div style="font-size: 12px; color: #6b7280;">Overall detection capability</div>
            </div>
            <div>
              <h4 style="font-size: 14px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">RESPONSE EFFECTIVENESS</h4>
              <div style="font-size: 28px; font-weight: bold; color: #8b5cf6; margin-bottom: 4px;">
                ${(summary.strategy.overallResponsiveness * 100).toFixed(1)}%
              </div>
              <div style="font-size: 12px; color: #6b7280;">Primary: ${summary.strategy.primaryResponse.method}</div>
            </div>
            <div>
              <h4 style="font-size: 14px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">FOCUS ON HIGH-RISK COUNTRIES</h4>
              <div style="font-size: 28px; font-weight: bold; color: #1d4ed8; margin-bottom: 4px;">
                ${focusPercent}%
              </div>
              <div style="font-size: 12px; color: #6b7280;">Effort directed to riskiest locations</div>
              <div style="margin-top: 8px; font-size: 12px; color: #1d4ed8;">
                Focus multiplier: ${focusMultiplier.toFixed(2)}× • Risk convexity (K): ${concentrationFactor.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        <!-- Strategy Breakdown -->
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #374151;">HRDD Strategy Breakdown</h3>
          <div id="strategyBreakdownList">
            ${summary.strategy.hrddStrategies.map(strategy => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb; background-color: ${strategy.weight > 0 ? '#f0f9ff' : '#f9fafb'};">
                <div style="flex: 1;">
                  <span style="font-weight: 500; color: #1f2937;">${strategy.name}</span>
                  <div style="font-size: 12px; color: #6b7280;">
                    Weight: ${strategy.weight}% • Transparency: ${strategy.transparency}% • Contribution: ${strategy.contribution.toFixed(1)}%
                  </div>
                </div>
                <div style="width: 60px; height: 8px; background-color: #e5e7eb; border-radius: 4px; margin-left: 12px;">
                  <div style="height: 100%; width: ${strategy.percentage}%; background-color: #3b82f6; border-radius: 4px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Export & Action Buttons -->
        <div style="display: flex; gap: 12px; justify-content: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <button onclick="window.hrddApp.exportConfiguration()" style="padding: 12px 24px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            Export Full Report
          </button>
          <button onclick="window.hrddApp.saveState()" style="padding: 12px 24px; background-color: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            Save Configuration
          </button>
          <button onclick="window.hrddApp.setCurrentPanel(1)" style="padding: 12px 24px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            Modify Settings
          </button>
        </div>
      </div>
    `;
  }

  // Keep existing Panel 2 components (unchanged)
  static createCountrySelectionPanel(containerId, { countries, selectedCountries, countryVolumes, onCountrySelect, onVolumeChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="country-selection-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Country Selection</h2>
        
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
            Add Country to Portfolio:
          </label>
          <select id="countrySelect" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background-color: white;">
            <option value="">Select a country...</option>
          </select>
        </div>

        <div id="selectedCountries"></div>

        <div style="background-color: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Quick Guide:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Click countries on the map above to select them</li>
            <li>Or use the dropdown to add countries</li>
            <li>Set volume for each country (higher = more influence on risk)</li>
            <li>Click 'Remove' to deselect countries</li>
          </ul>
        </div>
      </div>
    `;

    const countrySelect = document.getElementById('countrySelect');
    const sortedCountries = countries
      .filter(country => !selectedCountries.includes(country.isoCode))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    sortedCountries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.isoCode;
      option.textContent = country.name;
      countrySelect.appendChild(option);
    });

    countrySelect.addEventListener('change', (e) => {
      if (e.target.value && onCountrySelect) {
        onCountrySelect(e.target.value);
      }
      e.target.value = '';
    });

    this.updateSelectedCountriesDisplay(selectedCountries, countries, countryVolumes, onCountrySelect, onVolumeChange);
  }

  static createResultsPanel(containerId, { selectedCountries, countries, countryRisks, baselineRisk }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hasSelections = selectedCountries.length > 0;
    const riskColor = hasSelections ? riskEngine.getRiskColor(baselineRisk) : '#6b7280';
    const riskBand = hasSelections ? `${riskEngine.getRiskBand(baselineRisk)} Risk` : 'No Countries Selected';
    const selectionDetails = hasSelections
      ? `Based on ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'}`
      : 'Select countries to calculate a baseline risk.';
    const baselineValue = hasSelections ? baselineRisk.toFixed(1) : '—';
    const baselineBackground = hasSelections ? `${riskColor}15` : '#f3f4f6';

    container.innerHTML = `
      <div class="results-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Portfolio Risk Assessment</h2>

        <div id="baselineDisplay" style="padding: 32px; border-radius: 12px; border: 3px solid ${riskColor}; background-color: ${baselineBackground}; margin-bottom: 24px;">
          <div style="text-align: center;">
            <div style="font-size: 56px; font-weight: bold; color: ${riskColor}; margin-bottom: 12px;">
              ${baselineValue}
            </div>
            <div style="font-size: 24px; font-weight: 600; color: ${riskColor}; margin-bottom: 12px;">
              ${riskBand}
            </div>
            <div style="font-size: 16px; color: #6b7280;">
              ${selectionDetails}
            </div>
          </div>
        </div>

        <div id="countryRiskBreakdown" style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #374151;">Individual Country Risks:</h3>
          <div id="riskBreakdownList"></div>
        </div>

        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 16px; border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Next Steps:</h4>
          <p style="font-size: 14px; margin: 0; line-height: 1.5;">
            This baseline risk will be used in Panels 3-4 to configure HRDD strategies and 
            in Panel 5 to calculate managed risk levels after implementing controls.
          </p>
        </div>
      </div>
    `;

    this.updateRiskBreakdown(selectedCountries, countries, countryRisks);
  }

  static createWeightingsPanel(containerId, { weights, onWeightsChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const weightLabels = [
      'ITUC Rights Rating',
      'Corruption Index (TI)', 
      'ILO Migrant Worker Prevalence',
      'WJP Index 4.8',
      'Walk Free Slavery Index'
    ];

    let localWeights = [...weights];

    const updateWeights = () => {
      const total = localWeights.reduce((sum, w) => sum + w, 0);
      const totalElement = document.getElementById('totalWeights');
      if (totalElement) {
        totalElement.textContent = total;
        totalElement.style.color = total > 100 ? '#dc2626' : '#374151';
      }
      if (onWeightsChange) onWeightsChange([...localWeights]);
    };

    container.innerHTML = `
      <div class="weightings-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Risk Factor Weightings</h2>
          <button id="resetWeights" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Reset to Default
          </button>
        </div>
        
        <div id="weightsContainer" style="margin-bottom: 20px;"></div>
        
        <div style="font-size: 14px; color: #6b7280; padding: 12px; background-color: #f9fafb; border-radius: 6px; text-align: center;">
          Total Weight: <span id="totalWeights" style="font-weight: 600; font-size: 16px;">${localWeights.reduce((sum, w) => sum + w, 0)}</span>
          <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">(weights can exceed 100% - higher weights = more influence)</span>
        </div>

        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #78350f;">Understanding Weightings:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Higher weights give more importance to that risk factor</li>
            <li>Adjust based on your organization's priorities and sector</li>
            <li>Zero weight ignores that factor completely</li>
            <li>Total can exceed 100% for emphasis on multiple factors</li>
          </ul>
        </div>
      </div>
    `;

    const weightsContainer = document.getElementById('weightsContainer');
    weightLabels.forEach((label, index) => {
      const weightControl = document.createElement('div');
      weightControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
      weightControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
          ${label} <span id="weightValue_${index}" style="font-weight: 600; color: #1f2937;">(${localWeights[index]}%)</span>
        </label>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="50" value="${localWeights[index]}" id="weight_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
          <input type="number" min="0" max="50" value="${localWeights[index]}" id="weightNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
      `;
      weightsContainer.appendChild(weightControl);

      const rangeInput = document.getElementById(`weight_${index}`);
      const numberInput = document.getElementById(`weightNum_${index}`);
      const valueDisplay = document.getElementById(`weightValue_${index}`);

      const updateWeight = (value) => {
        const newValue = Math.max(0, Math.min(50, parseFloat(value) || 0));
        localWeights[index] = newValue;
        rangeInput.value = newValue;
        numberInput.value = newValue;
        valueDisplay.textContent = `(${newValue}%)`;
        updateWeights();
      };

      rangeInput.addEventListener('input', (e) => updateWeight(e.target.value));
      numberInput.addEventListener('input', (e) => updateWeight(e.target.value));
    });

    const resetButton = document.getElementById('resetWeights');
    resetButton.addEventListener('click', () => {
      localWeights = [...riskEngine.defaultWeights];
      localWeights.forEach((weight, index) => {
        document.getElementById(`weight_${index}`).value = weight;
        document.getElementById(`weightNum_${index}`).value = weight;
        document.getElementById(`weightValue_${index}`).textContent = `(${weight}%)`;
      });
      updateWeights();
    });
  }

  // Helper methods for updating displays
  static updateSelectedCountriesDisplay(selectedCountries, countries, countryVolumes, onCountrySelect, onVolumeChange) {
    const container = document.getElementById('selectedCountries');
    if (!container) return;

    const safeCountryVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};

    if (selectedCountries.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; font-style: italic; padding: 12px; text-align: center; background-color: #f9fafb; border-radius: 4px;">No countries selected. Use the dropdown above or click on the map.</p>';
      return;
    }

    container.innerHTML = `
      <h4 style="font-size: 16px; font-weight: 500; margin-bottom: 12px; color: #374151;">
        Selected Countries & Volumes (${selectedCountries.length}):
      </h4>
      <div id="countryList" style="max-height: 240px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
      </div>
    `;

    const countryList = document.getElementById('countryList');
    selectedCountries.forEach((countryCode, index) => {
      const country = countries.find(c => c.isoCode === countryCode);
      const volume = typeof safeCountryVolumes[countryCode] === 'number' ? safeCountryVolumes[countryCode] : 10;

      const countryItem = document.createElement('div');
      countryItem.style.cssText = `
        display: flex; align-items: center; justify-content: space-between; padding: 16px;
        ${index > 0 ? 'border-top: 1px solid #e5e7eb;' : ''}
        background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};
      `;
      
      countryItem.innerHTML = `
        <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #22c55e;"></div>
          <span style="font-weight: 500; color: #1f2937;">${country?.name || countryCode}</span>
          <span style="font-size: 12px; color: #6b7280; background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${countryCode}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 14px; color: #6b7280; font-weight: 500;">Volume:</label>
            <input type="number" min="0" value="${volume}" id="volume_${countryCode}" 
                   style="width: 80px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
          </div>
          <button id="remove_${countryCode}" 
                  style="padding: 6px 12px; background-color: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
            Remove
          </button>
        </div>
      `;

      countryList.appendChild(countryItem);

      const volumeInput = document.getElementById(`volume_${countryCode}`);
      const removeButton = document.getElementById(`remove_${countryCode}`);

      volumeInput.addEventListener('input', (e) => {
        const value = Math.max(0, parseFloat(e.target.value) || 0);
        e.target.value = value;
        if (onVolumeChange) onVolumeChange(countryCode, value);
      });

      removeButton.addEventListener('click', () => {
        if (onCountrySelect) onCountrySelect(countryCode);
      });
    });
  }

  static updateRiskBreakdown(selectedCountries, countries, countryRisks) {
    const container = document.getElementById('riskBreakdownList');
    if (!container) return;

    if (selectedCountries.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; font-style: italic; text-align: center; padding: 16px;">No countries selected</p>';
      return;
    }

    const breakdown = selectedCountries.map(countryCode => {
      const country = countries.find(c => c.isoCode === countryCode);
      const risk = countryRisks[countryCode] || 0;
      const riskBand = riskEngine.getRiskBand(risk);
      const riskColor = riskEngine.getRiskColor(risk);
      
      return { country, risk, riskBand, riskColor, countryCode };
    }).sort((a, b) => b.risk - a.risk);

    container.innerHTML = breakdown.map(({ country, risk, riskBand, riskColor, countryCode }) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="flex: 1;">
          <span style="font-weight: 500;">${country?.name || countryCode}</span>
          <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">(${countryCode})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 600; color: ${riskColor};">${risk.toFixed(1)}</span>
          <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background-color: ${riskColor}20; color: ${riskColor};">
            ${riskBand}
          </span>
        </div>
      </div>
    `).join('');
  }

  // ===== D3 MAP RENDERING METHODS =====

  // Global Risk Map Renderer (Panel 1 - non-interactive)
  static _renderGlobalD3Map(worldData, { container, countries, countryRisks, width, height }) {
    const wrapper = document.getElementById(container);
    if (!wrapper) return;
    wrapper.innerHTML = '';

    try {
      const features = this._extractWorldFeatures(worldData);
      if (!features.length) throw new Error('No geographic features available');

      const featureCollection = { type: 'FeatureCollection', features };
      const svg = d3.select(wrapper)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('border', '1px solid #e5e7eb')
        .style('border-radius', '8px')
        .style('background', '#f8fafc');

      const projection = d3.geoNaturalEarth1()
        .fitExtent([[16, 16], [width - 16, height - 16]], featureCollection);
      const path = d3.geoPath(projection);
      const mapGroup = svg.append('g').attr('class', 'map-layer');

      // Ocean background
      mapGroup.append('path')
        .datum({ type: 'Sphere' })
        .attr('d', path)
        .attr('fill', '#e0f2fe')
        .attr('stroke', '#bae6fd')
        .attr('stroke-width', 0.6)
        .attr('pointer-events', 'none');

      const metadataMap = new Map(countries.map(country => [country.isoCode, country]));
      const nameLookup = this._buildCountryNameLookup(metadataMap);

      features.forEach(feature => {
        feature.__isoCode = this._getFeatureIsoCode(feature, metadataMap, nameLookup);
      });

      const countryGroup = mapGroup.append('g').attr('class', 'countries');

      countryGroup.selectAll('path.country')
        .data(features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('data-iso-code', d => d.__isoCode || '')
        .attr('d', path)
        .style('cursor', 'default')
        .style('fill', d => {
          const countryId = d.__isoCode;
          const risk = countryRisks[countryId];
          return risk !== undefined ? riskEngine.getRiskColor(risk) : '#e5e7eb';
        })
        .style('stroke', '#ffffff')
        .style('stroke-width', 0.6)
        .style('opacity', d => {
          const countryId = d.__isoCode;
          return countryRisks[countryId] !== undefined ? 0.95 : 0.7;
        })
        .on('mouseover', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup, 'global'))
        .on('mouseout', () => this._hideMapTooltip());

      // Enhanced zoom controls
      const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
          mapGroup.attr('transform', event.transform);
        });
      
      svg.call(zoom);

      this._addZoomControls(svg, zoom);

    } catch (error) {
      console.warn('D3 global map rendering failed, using fallback:', error);
      this._createSimpleMapGrid(container, { countries, countryRisks, interactive: false });
    }
  }

  // Comparison Map Renderer (Panel 5 - selected countries only, non-interactive)
  static _renderComparisonD3Map(worldData, { container, countries, countryRisks, selectedCountries, width, height, mapType }) {
    const wrapper = document.getElementById(container);
    if (!wrapper) return;
    wrapper.innerHTML = '';

    try {
      const features = this._extractWorldFeatures(worldData);
      if (!features.length) throw new Error('No geographic features available');

      // Filter features to only show selected countries
      const metadataMap = new Map(countries.map(country => [country.isoCode, country]));
      const nameLookup = this._buildCountryNameLookup(metadataMap);

      features.forEach(feature => {
        feature.__isoCode = this._getFeatureIsoCode(feature, metadataMap, nameLookup);
      });

      const selectedFeatures = features.filter(feature => 
        feature.__isoCode && selectedCountries.includes(feature.__isoCode)
      );

      if (selectedFeatures.length === 0) {
        wrapper.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #6b7280;">
            <div style="font-size: 48px; margin-bottom: 16px;">🌍</div>
            <p>No selected countries to display</p>
          </div>
        `;
        return;
      }

      const featureCollection = { type: 'FeatureCollection', features: selectedFeatures };
      const svg = d3.select(wrapper)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('border', '1px solid #e5e7eb')
        .style('border-radius', '8px')
        .style('background', '#f8fafc');

      const projection = d3.geoNaturalEarth1()
        .fitExtent([[16, 16], [width - 16, height - 16]], featureCollection);
      const path = d3.geoPath(projection);
      const mapGroup = svg.append('g').attr('class', 'map-layer');

      // Ocean background
      mapGroup.append('path')
        .datum({ type: 'Sphere' })
        .attr('d', path)
        .attr('fill', '#e0f2fe')
        .attr('stroke', '#bae6fd')
        .attr('stroke-width', 0.6)
        .attr('pointer-events', 'none');

      const countryGroup = mapGroup.append('g').attr('class', 'countries');

      countryGroup.selectAll('path.country')
        .data(selectedFeatures)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('data-iso-code', d => d.__isoCode || '')
        .attr('d', path)
        .style('cursor', 'default')
        .style('fill', d => {
          const countryId = d.__isoCode;
          const risk = countryRisks[countryId];
          return risk !== undefined ? riskEngine.getRiskColor(risk) : '#e5e7eb';
        })
        .style('stroke', '#111827')
        .style('stroke-width', 1.5)
        .style('opacity', 0.95)
        .on('mouseover', (event, d) => this._showComparisonMapTooltip(event, d, countryRisks, metadataMap, nameLookup, mapType))
        .on('mouseout', () => this._hideMapTooltip());

      // Enhanced zoom controls
      const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
          mapGroup.attr('transform', event.transform);
        });
      
      svg.call(zoom);

      this._addZoomControls(svg, zoom);

    } catch (error) {
      console.warn('D3 comparison map rendering failed, using fallback:', error);
      this._createFallbackComparisonMap(container, { countries, countryRisks, selectedCountries, mapType });
    }
  }

  // Interactive Map Renderer (Panel 2 - with country selection)
  static _renderD3Map(worldData, { container, countries, countryRisks, selectedCountries, onCountrySelect, width, height, mapType }) {
    const wrapper = document.getElementById(container);
    if (!wrapper) return;
    wrapper.innerHTML = '';

    try {
      const features = this._extractWorldFeatures(worldData);
      if (!features.length) throw new Error('No geographic features available');

      const featureCollection = { type: 'FeatureCollection', features };
      const svg = d3.select(wrapper)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('border', '1px solid #e5e7eb')
        .style('border-radius', '8px')
        .style('background', '#f8fafc');

      const projection = d3.geoNaturalEarth1()
        .fitExtent([[16, 16], [width - 16, height - 16]], featureCollection);
      const path = d3.geoPath(projection);
      const mapGroup = svg.append('g').attr('class', 'map-layer');

      // Ocean background
      mapGroup.append('path')
        .datum({ type: 'Sphere' })
        .attr('d', path)
        .attr('fill', '#e0f2fe')
        .attr('stroke', '#bae6fd')
        .attr('stroke-width', 0.6)
        .attr('pointer-events', 'none');

      const metadataMap = new Map(countries.map(country => [country.isoCode, country]));
      const nameLookup = this._buildCountryNameLookup(metadataMap);

      features.forEach(feature => {
        feature.__isoCode = this._getFeatureIsoCode(feature, metadataMap, nameLookup);
      });

      const countryGroup = mapGroup.append('g').attr('class', 'countries');

      countryGroup.selectAll('path.country')
        .data(features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('data-iso-code', d => d.__isoCode || '')
        .attr('d', path)
        .style('cursor', d => d.__isoCode ? 'pointer' : 'default')
        .style('fill', d => {
          const countryId = d.__isoCode;
          const risk = countryRisks[countryId];
          return risk !== undefined ? riskEngine.getRiskColor(risk) : '#e5e7eb';
        })
        .style('stroke', d => selectedCountries.includes(d.__isoCode) ? '#111827' : '#ffffff')
        .style('stroke-width', d => selectedCountries.includes(d.__isoCode) ? 1.5 : 0.6)
        .style('opacity', d => {
          const countryId = d.__isoCode;
          return countryRisks[countryId] !== undefined ? 0.95 : 0.7;
        })
        .on('click', (event, d) => {
          const countryId = d.__isoCode;
          if (!countryId) return;

          const isSelected = selectedCountries.includes(countryId);
          d3.select(event.currentTarget)
            .style('stroke', isSelected ? '#ffffff' : '#111827')
            .style('stroke-width', isSelected ? 0.6 : 1.5);

          if (onCountrySelect) onCountrySelect(countryId);
        })
        .on('mouseover', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup, mapType))
        .on('mouseout', () => this._hideMapTooltip());

      // Enhanced zoom controls
      const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
          mapGroup.attr('transform', event.transform);
        });
      
      svg.call(zoom);

      this._addZoomControls(svg, zoom);

    } catch (error) {
      console.warn('D3 map rendering failed, using fallback:', error);
      this._createSimpleMapGrid(container, { countries, countryRisks, selectedCountries, onCountrySelect });
    }
  }

  // ===== SHARED D3 HELPER METHODS =====

  static _addZoomControls(svg, zoom) {
    const zoomControls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', 'translate(20, 20)');

    // Zoom out button
    zoomControls.append('rect')
      .attr('x', 0).attr('y', 35).attr('width', 30).attr('height', 30)
      .attr('fill', 'white').attr('stroke', '#374151').attr('stroke-width', 1).attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', () => svg.transition().duration(300).call(zoom.scaleBy, 0.67));

    zoomControls.append('text')
      .attr('x', 15).attr('y', 55).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .style('font-size', '20px').style('font-weight', 'bold').style('fill', '#374151')
      .style('pointer-events', 'none').text('−');

    // Reset zoom button
    zoomControls.append('rect')
      .attr('x', 0).attr('y', 70).attr('width', 30).attr('height', 30)
      .attr('fill', 'white').attr('stroke', '#374151').attr('stroke-width', 1).attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

    zoomControls.append('text')
      .attr('x', 15).attr('y', 90).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .style('font-size', '10px').style('font-weight', 'bold').style('fill', '#374151')
      .style('pointer-events', 'none').text('⌂');
  }

  // ===== TOOLTIP METHODS =====

  static _showMapTooltip(event, countryData, countryRisks, countryMetadata = new Map(), nameLookup = new Map(), mapType = 'baseline') {
    const countryId = countryData.__isoCode;
    const countryName = countryMetadata.get(countryId)?.name || countryData.properties?.NAME || countryId || 'Unknown';
    const risk = countryId ? countryRisks[countryId] : undefined;

    d3.selectAll('.map-tooltip').remove();

    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'map-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    tooltip.transition().duration(200).style('opacity', 1);

    const pageX = event.pageX || 0;
    const pageY = event.pageY || 0;

    const riskLabel = mapType === 'managed' ? 'Managed Risk' : 
                     mapType === 'global' ? 'Global Risk' : 'Baseline Risk';

    tooltip.html(`
      <strong>${countryName}</strong><br/>
      ${risk !== undefined ?
        `${riskLabel}: ${risk.toFixed(1)}<br/>Risk Band: ${riskEngine.getRiskBand(risk)}` :
        'No data available'
      }
    `)
    .style('left', (pageX + 10) + 'px')
    .style('top', (pageY - 10) + 'px');
  }

  static _showComparisonMapTooltip(event, countryData, countryRisks, countryMetadata = new Map(), nameLookup = new Map(), mapType = 'baseline') {
    const countryId = countryData.__isoCode;
    const countryName = countryMetadata.get(countryId)?.name || countryData.properties?.NAME || countryId || 'Unknown';
    const risk = countryId ? countryRisks[countryId] : undefined;

    d3.selectAll('.map-tooltip').remove();

    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'map-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    tooltip.transition().duration(200).style('opacity', 1);

    const pageX = event.pageX || 0;
    const pageY = event.pageY || 0;

    const riskLabel = mapType === 'managed' ? 'Managed Risk' : 'Baseline Risk';

    tooltip.html(`
      <strong>${countryName}</strong><br/>
      ${risk !== undefined ?
        `${riskLabel}: ${risk.toFixed(1)}<br/>Risk Band: ${riskEngine.getRiskBand(risk)}<br/><em>Selected Country</em>` :
        'No data available'
      }
    `)
    .style('left', (pageX + 10) + 'px')
    .style('top', (pageY - 10) + 'px');
  }

  static _hideMapTooltip() {
    d3.selectAll('.map-tooltip').remove();
  }

  // ===== D3 LOADING AND DATA METHODS (unchanged from original) =====

  static async _loadD3() {
    if (typeof d3 !== 'undefined') return;
    if (this._d3LoadingPromise) return this._d3LoadingPromise;

    this._d3LoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-lib="d3"]');
      if (existingScript) {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
      script.async = true;
      script.dataset.lib = 'd3';
      script.onload = () => resolve();
      script.onerror = () => {
        this._d3LoadingPromise = null;
        reject(new Error('Failed to load D3 library'));
      };
      document.head.appendChild(script);
    });

    return this._d3LoadingPromise;
  }

  static async _loadTopoJSON() {
    const libraryAvailable = () => typeof topojson !== 'undefined' && typeof topojson.feature === 'function';
    if (libraryAvailable()) {
      return;
    }

    if (this._topojsonLoadingPromise) return this._topojsonLoadingPromise;

    this._topojsonLoadingPromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (!libraryAvailable()) {
          console.warn('TopoJSON library not available after attempted load. Falling back to internal converter.');
        }
        resolve();
      };

      const existingScript = document.querySelector('script[data-lib="topojson-client"]');
      if (existingScript) {
        const loadState = existingScript.dataset.loadState;
        if (loadState === 'loaded') {
          finish();
          return;
        }
        if (loadState === 'failed') {
          existingScript.remove();
        } else {
          existingScript.addEventListener('load', () => {
            existingScript.dataset.loadState = 'loaded';
            finish();
          }, { once: true });
          existingScript.addEventListener('error', () => {
            existingScript.dataset.loadState = 'failed';
            existingScript.remove();
            finish();
          }, { once: true });
          return;
        }
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/topojson-client/3.1.0/topojson-client.min.js';
      script.async = true;
      script.dataset.lib = 'topojson-client';
      script.dataset.loadState = 'loading';
      script.onload = () => {
        script.dataset.loadState = 'loaded';
        finish();
      };
      script.onerror = () => {
        script.dataset.loadState = 'failed';
        script.remove();
        finish();
      };
      document.head.appendChild(script);
    }).finally(() => {
      this._topojsonLoadingPromise = null;
    });

    return this._topojsonLoadingPromise;
  }
  
  static async _loadWorldData() {
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      if (!response.ok) throw new Error('Failed to load world data');
      return await response.json();
    } catch (error) {
      console.warn('Failed to load external world data:', error);
      return this._getSimplifiedWorldData();
    }
  }

  static _getSimplifiedWorldData() {
    const createRectFeature = (iso, name, minLon, minLat, maxLon, maxLat) => ({
      type: 'Feature',
      properties: { ISO_A3: iso, NAME: name },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]
        ]]
      }
    });

    const features = [
      createRectFeature('USA', 'United States', -125, 24, -66, 49),
      createRectFeature('CHN', 'China', 73, 18, 135, 53),
      createRectFeature('DEU', 'Germany', 5, 47, 15, 55),
      createRectFeature('GBR', 'United Kingdom', -8, 49, 2, 59),
      createRectFeature('FRA', 'France', -5, 43, 7, 51),
      createRectFeature('IND', 'India', 68, 7, 89, 35),
      createRectFeature('BRA', 'Brazil', -74, -35, -34, 6),
      createRectFeature('JPN', 'Japan', 130, 30, 146, 46)
    ];

    return { type: 'FeatureCollection', features };
  }

  // ===== FEATURE EXTRACTION AND TOPOLOGY METHODS (unchanged from original) =====

  static _extractWorldFeatures(worldData) {
    if (!worldData) return [];
    if (worldData.type === 'FeatureCollection' && Array.isArray(worldData.features)) {
      return worldData.features;
    }
    if (worldData.type === 'Topology' && worldData.objects?.countries) {
      const features = this._topologyToFeatures(worldData, 'countries');
      return Array.isArray(features) ? features : [];
    }
    return [];
  }

  static _topologyToFeatures(topology, objectName) {
    try {
      const object = topology.objects?.[objectName];
      if (!object) return [];

      if (typeof topojson !== 'undefined' && typeof topojson.feature === 'function') {
        const collection = topojson.feature(topology, object);
        if (collection?.type === 'FeatureCollection' && Array.isArray(collection.features)) {
          return collection.features;
        }
        if (collection?.type === 'Feature') {
          return [collection];
        }
      }

      const fallbackCollection = this._convertTopologyToFeatureCollection(topology, object);
      if (fallbackCollection?.type === 'FeatureCollection' && Array.isArray(fallbackCollection.features)) {
        return fallbackCollection.features;
      }
      if (Array.isArray(fallbackCollection)) {
        return fallbackCollection;
      }

      console.warn('TopoJSON conversion fallback failed to produce features.');
      return [];
    } catch (error) {
      console.warn('Failed to convert topology to features:', error);
      return [];
    }
  }

  static _convertTopologyToFeatureCollection(topology, object) {
    if (!topology || !object) {
      return { type: 'FeatureCollection', features: [] };
    }

    const transform = topology.transform || null;
    const hasTransform = transform && Array.isArray(transform.scale) && Array.isArray(transform.translate);
    const scale = hasTransform ? transform.scale : [1, 1];
    const translate = hasTransform ? transform.translate : [0, 0];

    const absoluteArcs = Array.isArray(topology.arcs) ? topology.arcs.map(arc => {
      let x = 0;
      let y = 0;
      const points = [];

      arc.forEach(point => {
        if (!Array.isArray(point) || point.length < 2) return;
        x += point[0];
        y += point[1];
        const transformed = hasTransform
          ? [translate[0] + x * scale[0], translate[1] + y * scale[1]]
          : [x, y];
        points.push(transformed);
      });

      return points;
    }) : [];

    const getArc = (index) => {
      const arcIndex = index >= 0 ? index : ~index;
      const arc = absoluteArcs[arcIndex] || [];
      const coordinates = arc.map(coord => coord.slice());
      if (index >= 0) {
        return coordinates;
      }
      return coordinates.reverse();
    };

    const mergeArcs = (arcIndexes = []) => {
      const coordinates = [];

      arcIndexes.forEach((arcIndex, position) => {
        const arcCoordinates = getArc(arcIndex);
        if (!arcCoordinates.length) return;

        if (position > 0 && coordinates.length) {
          const [lastX, lastY] = coordinates[coordinates.length - 1];
          const [nextX, nextY] = arcCoordinates[0] || [];
          const startIndex = (lastX === nextX && lastY === nextY) ? 1 : 0;
          for (let i = startIndex; i < arcCoordinates.length; i++) {
            coordinates.push(arcCoordinates[i]);
          }
        } else {
          coordinates.push(...arcCoordinates);
        }
      });

      return coordinates;
    };

    const transformPoint = (point = []) => {
      if (!Array.isArray(point)) return point;
      const [x = 0, y = 0] = point;
      if (!hasTransform) {
        return [x, y];
      }
      return [translate[0] + x * scale[0], translate[1] + y * scale[1]];
    };

    const convertGeometry = (geometry) => {
      if (!geometry) return null;

      switch (geometry.type) {
        case 'GeometryCollection': {
          const geometries = (geometry.geometries || [])
            .map(convertGeometry)
            .filter(Boolean);
          return geometries.length ? { type: 'GeometryCollection', geometries } : null;
        }
        case 'Point':
          return { type: 'Point', coordinates: transformPoint(geometry.coordinates) };
        case 'MultiPoint':
          return { type: 'MultiPoint', coordinates: (geometry.coordinates || []).map(transformPoint) };
        case 'LineString':
          return { type: 'LineString', coordinates: mergeArcs(geometry.arcs || []) };
        case 'MultiLineString':
          return { type: 'MultiLineString', coordinates: (geometry.arcs || []).map(mergeArcs) };
        case 'Polygon':
          return { type: 'Polygon', coordinates: (geometry.arcs || []).map(mergeArcs) };
        case 'MultiPolygon':
          return {
            type: 'MultiPolygon',
            coordinates: (geometry.arcs || []).map(rings => (rings || []).map(mergeArcs))
          };
        default:
          return null;
      }
    };

    const toFeatureArray = (obj) => {
      if (!obj) return [];

      if (obj.type === 'FeatureCollection') {
        return (obj.features || []).flatMap(toFeatureArray);
      }

      if (obj.type === 'Feature') {
        const geometry = convertGeometry(obj.geometry);
        if (!geometry) return [];
        return [{
          type: 'Feature',
          id: obj.id ?? obj.properties?.id ?? obj.properties?.ISO_A3 ?? undefined,
          properties: obj.properties ? { ...obj.properties } : {},
          geometry
        }];
      }

      if (obj.type === 'GeometryCollection') {
        return (obj.geometries || []).flatMap(geometry => {
          const converted = convertGeometry(geometry);
          if (!converted) return [];
          return [{
            type: 'Feature',
            id: geometry.id ?? geometry.properties?.id ?? geometry.properties?.ISO_A3 ?? undefined,
            properties: geometry.properties ? { ...geometry.properties } : {},
            geometry: converted
          }];
        });
      }

      const geometry = convertGeometry(obj);
      if (!geometry) return [];
      return [{
        type: 'Feature',
        id: obj.id ?? obj.properties?.id ?? obj.properties?.ISO_A3 ?? undefined,
        properties: obj.properties ? { ...obj.properties } : {},
        geometry
      }];
    };

    const features = toFeatureArray(object);
    return { type: 'FeatureCollection', features };
  }

  // ===== COUNTRY IDENTIFICATION METHODS (unchanged from original) =====

  static _getCountryId(countryData) {
    if (!countryData) return null;

    const properties = countryData.properties || {};
    const isoCandidates = [
      properties.ISO_A3,
      properties.iso_a3,
      properties.ADM0_A3,
      properties.adm0_a3,
      properties.A3_UN,
      properties.a3_un,
      properties.ABBREV,
      properties.abbrev
    ];

    for (const candidate of isoCandidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === '-99') continue;
      if (/^[A-Z]{3}$/i.test(trimmed)) {
        return trimmed.toUpperCase();
      }
    }

    const id = countryData.id;
    if (typeof id === 'string') {
      const trimmed = id.trim();
      if (/^[A-Z]{3}$/i.test(trimmed)) {
        return trimmed.toUpperCase();
      }

      if (/^\d+$/.test(trimmed)) {
        return null;
      }
    }

    if (typeof id === 'number') {
      return null;
    }

    return typeof id === 'string' ? id.toUpperCase() : null;
  }

  static _getFeatureIsoCode(feature, metadataMap, nameLookup) {
    if (!feature) return null;
    const directId = this._getCountryId(feature);
    if (directId) return directId;
    return this._resolveCountryCodeFromName(feature, metadataMap, nameLookup);
  }

  static _resolveCountryCodeFromName(feature, metadataMap, nameLookup = new Map()) {
    const candidates = this._getFeatureNameCandidates(feature);
    for (const candidate of candidates) {
      const normalized = this._normalizeCountryName(candidate);
      if (!normalized) continue;
      const directMatch = nameLookup.get(normalized);
      if (directMatch) return directMatch;
    }
    return null;
  }

  static _getFeatureNameCandidates(feature) {
    const properties = feature?.properties || {};
    const names = [properties.NAME, properties.name, properties.NAME_LONG];
    return Array.from(new Set(names.filter(Boolean)));
  }

  static _normalizeCountryName(name) {
    if (typeof name !== 'string') return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  static _buildCountryNameLookup(metadataMap) {
    const lookup = new Map();
    metadataMap.forEach((country, iso) => {
      const normalizedName = this._normalizeCountryName(country?.name);
      if (normalizedName) lookup.set(normalizedName, iso);
    });
    return lookup;
  }

  // ===== MAP LEGEND AND FALLBACK METHODS =====

  static _createMapLegend(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const title = document.createElement('h4');
    title.textContent = 'Risk Levels:';
    title.style.cssText = 'font-size: 14px; font-weight: 500; margin-bottom: 8px;';
    container.appendChild(title);

    const legendContainer = document.createElement('div');
    legendContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;';

    riskEngine.getRiskBandDefinitions().forEach(band => {
      const legendItem = document.createElement('div');
      legendItem.style.cssText = 'display: flex; align-items: center; gap: 4px;';
      legendItem.innerHTML = `
        <div style="width: 16px; height: 16px; border: 1px solid #ccc; background-color: ${band.color};"></div>
        <span style="font-size: 12px;">${band.name} (${band.range})</span>
      `;
      legendContainer.appendChild(legendItem);
    });

    container.appendChild(legendContainer);
  }

  static _createFallbackMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title, interactive = true }) {
    this._createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title, interactive });
  }

  static _createFallbackComparisonMap(containerId, { countries, countryRisks, selectedCountries, title, mapType }) {
    this._createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, title, interactive: false, mapType });
  }

  static _createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries = [], onCountrySelect, title, interactive = true, mapType = 'baseline' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const displayCountries = interactive ? 
      countries.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20) :
      countries.filter(country => selectedCountries.includes(country.isoCode));

    container.innerHTML = `
      <div class="simple-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        ${title ? `<h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>` : ''}
        <div class="map-grid" id="simpleMapGrid-${mapType}" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 20px 0;">
        </div>
        ${displayCountries.length === 0 ? `
          <div style="padding: 40px; color: #6b7280; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">🌍</div>
            <p>No countries to display</p>
          </div>
        ` : ''}
      </div>
    `;

    const mapGrid = document.getElementById(`simpleMapGrid-${mapType}`);
    if (!mapGrid || displayCountries.length === 0) return;

    displayCountries.forEach(country => {
      const risk = countryRisks[country.isoCode] || 0;
      const isSelected = selectedCountries.includes(country.isoCode);
      
      const countryTile = document.createElement('div');
      countryTile.style.cssText = `
        padding: 12px 8px; border-radius: 4px; border: 2px solid ${isSelected ? '#000' : '#e5e7eb'};
        cursor: ${interactive ? 'pointer' : 'default'}; font-size: 11px; font-weight: 500; color: white; text-align: center;
        background-color: ${riskEngine.getRiskColor(risk)}; opacity: ${risk > 0 ? 0.9 : 0.4};
        min-height: 60px; display: flex; flex-direction: column; justify-content: center;
      `;
      
      countryTile.innerHTML = `<div>${country.name.length > 12 ? country.isoCode : country.name}</div>`;
      
      if (interactive && onCountrySelect) {
        countryTile.addEventListener('click', () => {
          onCountrySelect(country.isoCode);
        });
      }
      
      mapGrid.appendChild(countryTile);
    });
  }
} in button
    zoomControls.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', 30).attr('height', 30)
      .attr('fill', 'white').attr('stroke', '#374151').attr('stroke-width', 1).attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.5));

    zoomControls.append('text')
      .attr('x', 15).attr('y', 20).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .style('font-size', '18px').style('font-weight', 'bold').style('fill', '#374151')
      .style('pointer-events', 'none').text('+');

    // Zoom