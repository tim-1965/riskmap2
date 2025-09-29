import { riskEngine } from './RiskEngine.js';

let panel3ResizeListenerAttached = false;
let panel4ResizeListenerAttached = false;

const isMobileView = () => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

function describeFocusLevel(value) {
  if (value >= 0.75) return 'Only high risk suppliers are actively monitored.';
  if (value >= 0.5) return 'Active monitoring for medium and high risk suppliers.';
  if (value >= 0.25) return 'Most suppliers are actively monitored.';
  return 'Even portfolio coverage';
}

function alignPanel3Rows() {
  if (typeof document === 'undefined') return;

  const strategyContainer = document.getElementById('strategyContainer');
  const transparencyContainer = document.getElementById('transparencyContainer');
  if (!strategyContainer || !transparencyContainer) return;

  const strategyControls = strategyContainer.querySelectorAll('[data-strategy-index]');
  const transparencyControls = transparencyContainer.querySelectorAll('[data-transparency-index]');
  const strategyInfo = document.querySelector('[data-panel3-info="strategy"]');
  const transparencyInfo = document.querySelector('[data-panel3-info="transparency"]');

  const totalControls = Math.max(strategyControls.length, transparencyControls.length);
  for (let i = 0; i < totalControls; i++) {
    if (strategyControls[i]) strategyControls[i].style.minHeight = '';
    if (transparencyControls[i]) transparencyControls[i].style.minHeight = '';
  }
  if (strategyInfo) strategyInfo.style.minHeight = '';
  if (transparencyInfo) transparencyInfo.style.minHeight = '';

  const shouldAlign = typeof window !== 'undefined' ? window.innerWidth > 768 : true;
  if (!shouldAlign) return;

  const pairCount = Math.min(strategyControls.length, transparencyControls.length);
  for (let i = 0; i < pairCount; i++) {
    const left = strategyControls[i];
    const right = transparencyControls[i];
    if (!left || !right) continue;

    const maxHeight = Math.max(left.offsetHeight, right.offsetHeight);
    left.style.minHeight = `${maxHeight}px`;
    right.style.minHeight = `${maxHeight}px`;
  }

  if (strategyInfo && transparencyInfo) {
    const infoHeight = Math.max(strategyInfo.offsetHeight, transparencyInfo.offsetHeight);
    strategyInfo.style.minHeight = `${infoHeight}px`;
    transparencyInfo.style.minHeight = `${infoHeight}px`;
  }
}

function schedulePanel3Alignment() {
  if (typeof window === 'undefined') return;

  const callback = () => alignPanel3Rows();
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 50);
  }
}

function ensurePanel3ResizeListener() {
  if (typeof window === 'undefined' || panel3ResizeListenerAttached) return;
  window.addEventListener('resize', () => schedulePanel3Alignment());
  panel3ResizeListenerAttached = true;
}

function alignPanel4Rows() {
  if (typeof document === 'undefined') return;

  const responsivenessContainer = document.getElementById('responsivenessContainer');
  const effectivenessContainer = document.getElementById('responsivenessEffectivenessContainer');
  if (!responsivenessContainer || !effectivenessContainer) return;

  const responsivenessControls = responsivenessContainer.querySelectorAll('[data-responsiveness-index]');
  const effectivenessControls = effectivenessContainer.querySelectorAll('[data-responsiveness-effectiveness-index]');

  const totalControls = Math.max(responsivenessControls.length, effectivenessControls.length);
  for (let i = 0; i < totalControls; i++) {
    if (responsivenessControls[i]) responsivenessControls[i].style.minHeight = '';
    if (effectivenessControls[i]) effectivenessControls[i].style.minHeight = '';
  }

  const strategyDetails = document.querySelector('[data-panel4-info="strategyDetails"]');
  const effectivenessDetails = document.querySelector('[data-panel4-info="effectivenessDetails"]');
  if (strategyDetails) strategyDetails.style.minHeight = '';
  if (effectivenessDetails) effectivenessDetails.style.minHeight = '';

  const shouldAlign = typeof window !== 'undefined' ? window.innerWidth > 768 : true;
  if (!shouldAlign) return;

  const pairCount = Math.min(responsivenessControls.length, effectivenessControls.length);
  for (let i = 0; i < pairCount; i++) {
    const left = responsivenessControls[i];
    const right = effectivenessControls[i];
    if (!left || !right) continue;

    const maxHeight = Math.max(left.offsetHeight, right.offsetHeight);
    left.style.minHeight = `${maxHeight}px`;
    right.style.minHeight = `${maxHeight}px`;
  }

  if (strategyDetails && effectivenessDetails) {
    const infoHeight = Math.max(strategyDetails.offsetHeight, effectivenessDetails.offsetHeight);
    strategyDetails.style.minHeight = `${infoHeight}px`;
    effectivenessDetails.style.minHeight = `${infoHeight}px`;
  }
}

function schedulePanel4Alignment() {
  if (typeof window === 'undefined') return;

  const callback = () => alignPanel4Rows();
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 50);
  }
}

function ensurePanel4ResizeListener() {
  if (typeof window === 'undefined' || panel4ResizeListenerAttached) return;
  window.addEventListener('resize', () => schedulePanel4Alignment());
  panel4ResizeListenerAttached = true;
}

// ENHANCED: Risk comparison panel with focus effectiveness display
export function createRiskComparisonPanel(
  containerId,
  options = {}
) {
  const {
    baselineRisk = 0,
    managedRisk = 0,
    selectedCountries = [],
    focusEffectivenessMetrics = null
  } = options;

  const safeSelectedCountries = Array.isArray(selectedCountries) ? selectedCountries : [];
  const container = document.getElementById(containerId);
  if (!container) return;

  const mobile = isMobileView();
  const responsive = (mobileValue, desktopValue) => (mobile ? mobileValue : desktopValue);

  const hasSelections = safeSelectedCountries.length > 0;

  if (!hasSelections) {
    container.innerHTML = `
      <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
        <h2 style="font-size: ${responsive('18px', '20px')}; font-weight: bold; margin-bottom: ${responsive('12px', '16px')}; color: #1f2937;">Risk Assessment Summary</h2>
        <div style="color: #6b7280; padding: ${responsive('12px', '20px')};">
          <div style="font-size: ${responsive('40px', '48px')}; margin-bottom: ${responsive('12px', '16px')};">🏭</div>
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
    [], [], [], [], 0, 1
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
    <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-top: 4px solid #3b82f6;">
      <h2 style="font-size: ${responsive('18px', '20px')}; font-weight: bold; margin-bottom: ${responsive('16px', '20px')}; text-align: center; color: #1f2937;">
        Risk Assessment Summary
      </h2>

      <div style="display: grid; grid-template-columns: ${responsive('1fr', 'repeat(3, minmax(0, 1fr))')}; gap: ${responsive('16px', '24px')}; align-items: stretch; margin-bottom: ${responsive('16px', '20px')};">
        <div style="padding: ${responsive('18px', '24px')}; border-radius: 12px; border: 3px solid ${baselineColor}; background-color: ${baselineColor}15; text-align: center;">
          <div style="font-size: ${responsive('11px', '12px')}; font-weight: 500; color: #6b7280; margin-bottom: 8px;">BASELINE RISK</div>
          <div style="font-size: ${responsive('40px', '48px')}; font-weight: bold; color: ${baselineColor}; margin-bottom: 8px;">
            ${baselineScore.toFixed(1)}
          </div>
          <div style="font-size: ${responsive('14px', '16px')}; font-weight: 600; color: ${baselineColor};">
            ${baselineBand}
          </div>
        </div>

        <div style="padding: ${responsive('18px', '24px')}; border-radius: 12px; border: 3px solid ${changeColor}; background-color: ${changeColor}15; text-align: center;">
          <div style="font-size: ${responsive('11px', '12px')}; font-weight: 500; color: #6b7280; margin-bottom: 8px;">RISK CHANGE</div>
          <div style="font-size: ${responsive('40px', '48px')}; font-weight: bold; color: ${changeColor}; margin-bottom: 8px;">
            ${changePrefix}${Math.abs(riskReduction).toFixed(1)}%
          </div>
          <div style="font-size: ${responsive('14px', '16px')}; font-weight: 600; color: ${changeColor};">
            ${changeLabel}
          </div>
          <div style="font-size: ${responsive('11px', '12px')}; color: #4b5563; margin-top: 6px;">
            ${changeDetail}
          </div>
        </div>

        <div style="padding: ${responsive('18px', '24px')}; border-radius: 12px; border: 3px solid ${managedColor}; background-color: ${managedColor}15; text-align: center;">
          <div style="font-size: ${responsive('11px', '12px')}; font-weight: 500; color: #6b7280; margin-bottom: 8px;">MANAGED RISK</div>
          <div style="font-size: ${responsive('40px', '48px')}; font-weight: bold; color: ${managedColor}; margin-bottom: 8px;">
            ${managedScore.toFixed(1)}
          </div>
          <div style="font-size: ${responsive('14px', '16px')}; font-weight: 600; color: ${managedColor};">
            ${managedBand}
          </div>
        </div>
      </div>

      <div style="text-align: center; padding: ${responsive('10px', '12px')}; background-color: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd;">
        <span style="font-size: ${responsive('13px', '14px')}; color: #0369a1;">
          Portfolio: ${safeSelectedCountries.length} countries •
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


export function createHRDDStrategyPanel(containerId, { strategy, onStrategyChange, onFocusChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const strategyLabels = riskEngine.hrddStrategyLabels;
  const strategyDescriptions = [
    '% of suppliers with always-on worker voice and daily feedback.',
    '% of suppliers surveyed with annual structured worker surveys.',
    '% of suppliers having unannounced third-party social audits.',
    '% of suppliers having planned / self-arranged social audits.',
    '% of suppliers completing self-assessment questionnaires with supporting evidence.',
    '% of suppliers completing self-assessment questionnaires without supporting evidence.'
  ];

  const categoryInfo = [
    { name: 'Worker Voice', color: '#22c55e', tools: [0, 1] },
    { name: 'Audit', color: '#f59e0b', tools: [2, 3, 4] },
    { name: 'Passive', color: '#6b7280', tools: [5] }
  ];

  let localStrategy = [...strategy];
  const defaultFocusValue = typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6;

  const updateStrategy = (options = {}) => {
    if (options.notify !== false && onStrategyChange) {
      onStrategyChange([...localStrategy]);
    }
  };

  const applyStrategyValue = (index, value, options = {}) => {
    if (!Number.isInteger(index) || index < 0 || index >= localStrategy.length) {
      return null;
    }

    const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
    localStrategy[index] = newValue;

    const rangeInput = document.getElementById(`strategy_${index}`);
    const numberInput = document.getElementById(`strategyNum_${index}`);
    if (rangeInput) rangeInput.value = newValue;
    if (numberInput) numberInput.value = newValue;

    updateStrategy({ notify: options.notify !== false });
    schedulePanel3Alignment();

    return newValue;
  };

  container.innerHTML = `
    <div class="hrdd-strategy-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">HRDD strategies in use</h2>
        <button id="resetStrategy" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          Reset to Default
        </button>
      </div>

      <div id="strategyContainer" style="margin-bottom: 20px;"></div>

       <div style="margin-top: 16px;">
        <div data-panel3-info="strategy" style="background-color: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; padding: 16px; border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Enhanced Coverage-Based Strategy:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Each percentage is the amount of the supplier base covered by that strategy.</li>
            <li>Higher coverage increases total transparency but with diminishing returns.</li>
            <li>Tools are grouped: <span style="color: #22c55e; font-weight: 500;">Worker Voice</span>, <span style="color: #f59e0b; font-weight: 500;">Audit</span>, <span style="color: #6b7280; font-weight: 500;">Trusting</span>.</li>
            <li><strong>Use the focus setting below</strong> to distribute your coverage based on country risk levels for maximum impact.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const strategyContainer = document.getElementById('strategyContainer');
  strategyLabels.forEach((label, index) => {
    // Find which category this tool belongs to
    const category = categoryInfo.find(cat => cat.tools.includes(index));
    const categoryColor = category ? category.color : '#6b7280';

    const strategyControl = document.createElement('div');
    strategyControl.dataset.strategyIndex = index;
    strategyControl.style.cssText = `margin-bottom: 20px; padding: 16px; border: 2px solid ${categoryColor}20; border-radius: 8px; background-color: ${categoryColor}05; display: flex; flex-direction: column; gap: 12px;`;
    strategyControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151;">
        <span style="color: ${categoryColor}; font-weight: 600;">[${category?.name || 'Other'}]</span> ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; font-style: italic;">
        ${strategyDescriptions[index]}
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <input type="range" min="0" max="100" value="${localStrategy[index]}" id="strategy_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
        <input type="number" min="0" max="100" value="${localStrategy[index]}" id="strategyNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        <span style="font-size: 12px; color: #6b7280; font-weight: 500;">%</span>
      </div>
    `;
    strategyContainer.appendChild(strategyControl);

    const rangeInput = document.getElementById(`strategy_${index}`);
    const numberInput = document.getElementById(`strategyNum_${index}`);

    const handleStrategyValueChange = (value, options = {}) => {
      const sanitizedValue = applyStrategyValue(index, value, options);

      if (index === 0) {
        const updateResponsivenessUI =
          typeof window !== 'undefined'
            ? (window.hrddApp?.updateResponsivenessUI || window.updateResponsivenessUI)
            : null;

        if (typeof updateResponsivenessUI === 'function') {
          updateResponsivenessUI(0, sanitizedValue, { notify: false });
        }
      }
    };

    if (rangeInput) {
      rangeInput.addEventListener('input', (e) => handleStrategyValueChange(e.target.value));
    }

    if (numberInput) {
      numberInput.addEventListener('input', (e) => handleStrategyValueChange(e.target.value));
    }
  });

  const updateHRDDStrategyUI = (target, value, options = {}) => {
    if (Array.isArray(target)) {
      target.forEach((val, idx) => {
        applyStrategyValue(idx, val, { notify: false });
      });
      updateStrategy({ notify: options.notify !== false });
      return;
    }

    if (Number.isInteger(target)) {
      applyStrategyValue(target, value, options);
    }
  };

  if (typeof window !== 'undefined') {
    if (window.hrddApp) {
      window.hrddApp.updateHRDDStrategyUI = updateHRDDStrategyUI;
    } else {
      window.updateHRDDStrategyUI = updateHRDDStrategyUI;
    }
  }

  const resetButton = document.getElementById('resetStrategy');
  resetButton.addEventListener('click', () => {
    localStrategy = [...riskEngine.defaultHRDDStrategy];
    localStrategy.forEach((weight, index) => {
      applyStrategyValue(index, weight, { notify: false });
    });
    updateStrategy();

    const targetValue = defaultFocusValue;
    if (typeof window !== 'undefined' && window.hrddApp?.updateFocusUI) {
      window.hrddApp.updateFocusUI(targetValue, { notify: true });
    } else if (typeof onFocusChange === 'function') {
      onFocusChange(targetValue);
    }
  });

  ensurePanel3ResizeListener();
  schedulePanel3Alignment();
}

// ENHANCED: Focus panel with more detailed guidance and effectiveness tracking
export function createFocusPanel(containerId, { focus, onFocusChange, focusEffectivenessMetrics = null }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const defaultFocusValue = typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6;
  let localFocus = typeof focus === 'number' ? focus : defaultFocusValue;

  // ENHANCED: Focus effectiveness assessment
  const focusEffectivenessHtml = focusEffectivenessMetrics && localFocus > 0.3 ? `
    <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border: 1px solid #bae6fd;">
      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #0c4a6e;">Focus Performance Analysis</h4>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
         <div style="padding: 10px; background: white; border-radius: 6px; border: 1px solid #e0f2fe; text-align: center;">
          <div style="font-size: 11px; color: #0369a1; margin-bottom: 2px;">Focus effectiveness</div>
          <div style="font-size: 18px; font-weight: bold; color: ${focusEffectivenessMetrics.focusEffectiveness >= 70 ? '#059669' : focusEffectivenessMetrics.focusEffectiveness >= 40 ? '#f59e0b' : '#dc2626'};">
            ${Math.abs(focusEffectivenessMetrics.focusEffectiveness).toFixed(0)}%
          </div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 6px; border: 1px solid #e0f2fe; text-align: center;">
          <div style="font-size: 11px; color: #0369a1; margin-bottom: 2px;">Reduction Achieved</div>
          <div style="font-size: 18px; font-weight: bold; color: ${focusEffectivenessMetrics.differentialBenefit >= 10 ? '#059669' : focusEffectivenessMetrics.differentialBenefit >= 5 ? '#f59e0b' : '#dc2626'};">
            ${focusEffectivenessMetrics.differentialBenefit.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="focus-panel" style="background: white; padding: 28px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #bfdbfe;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1; min-width: 240px;">
          <h3 style="font-size: 20px; font-weight: 600; color: #1d4ed8; margin-bottom: 8px;">Focus on High-Risk Countries</h3>
          <p style="font-size: 14px; color: #1e3a8a; margin: 0;">
            Focus concentrates your monitoring and remediation effort on the highest-risk countries without increasing total effort.
          </p>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; min-width: 220px;">
          <span style="font-size: 12px; font-weight: 600; color: #1d4ed8; text-transform: uppercase;">Current Focus</span>
          <span style="font-size: 32px; font-weight: 700; color: #1d4ed8;"><span id="focusPercent">${Math.round(localFocus * 100)}</span>%</span>
          <span style="font-size: 13px; font-weight: 500; color: #1e3a8a;">
            Ratio <span id="focusValue">${localFocus.toFixed(2)}</span> • <span id="focusDescriptor">${describeFocusLevel(localFocus)}</span>
          </span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
        <input type="range" min="0" max="1" step="0.05" value="${localFocus.toFixed(2)}" id="focusSlider" style="flex: 1; height: 8px; border-radius: 4px; background-color: #bfdbfe;">
        <input type="number" min="0" max="1" step="0.05" value="${localFocus.toFixed(2)}" id="focusNumber" style="width: 100px; padding: 10px 12px; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 14px; text-align: center;">
      </div>

      <ul style="margin: 0; font-size: 13px; color: #1e3a8a; padding-left: 20px; line-height: 1.6;">
        <li><strong>0.00 – 0.25:</strong> Even effort across the portfolio.</li>
        <li><strong>0.25 – 0.50:</strong> Most suppliers are actively monitored.</li>
        <li><strong>0.50 – 0.75:</strong> Active monitoring for medium and high risk suppliers.</li>
        <li><strong>0.75 – 1.00:</strong> Only high risk suppliers are actively monitored.</li>
      </ul>
      
      ${focusEffectivenessHtml}
    </div>
  `;

  const focusSlider = container.querySelector('#focusSlider');
  const focusNumber = container.querySelector('#focusNumber');
  const focusValueElement = container.querySelector('#focusValue');
  const focusPercentElement = container.querySelector('#focusPercent');
  const focusDescriptorElement = container.querySelector('#focusDescriptor');

  const updateFocus = (value, notify = true) => {
    const parsed = Math.max(0, Math.min(1, parseFloat(value) || 0));
    localFocus = parsed;
    const formatted = parsed.toFixed(2);
    const percent = Math.round(parsed * 100);

    if (focusSlider) focusSlider.value = formatted;
    if (focusNumber) focusNumber.value = formatted;
    if (focusValueElement) focusValueElement.textContent = formatted;
    if (focusPercentElement) focusPercentElement.textContent = percent;
    if (focusDescriptorElement) focusDescriptorElement.textContent = describeFocusLevel(parsed);

    if (notify && typeof onFocusChange === 'function') {
      onFocusChange(parsed);
    }
  };

  if (focusSlider) {
    focusSlider.addEventListener('input', (event) => updateFocus(event.target.value));
  }

  if (focusNumber) {
    focusNumber.addEventListener('input', (event) => updateFocus(event.target.value));
  }

  updateFocus(localFocus, false);

  if (typeof window !== 'undefined') {
    if (window.hrddApp) {
      window.hrddApp.updateFocusUI = (value, options = {}) => updateFocus(value, options.notify !== false);
    } else {
      window.updateFocusUI = (value, options = {}) => updateFocus(value, options.notify !== false);
    }
  }
}

export function createTransparencyPanel(containerId, { transparency, onTransparencyChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const strategyLabels = riskEngine.hrddStrategyLabels;
  const effectivenessDescriptions = [
    'Real-time anonymous feedback direct from workers can reveal almost all issues.',
    'Periodic anonymous worker surveys can snapshot many risks if suppliers not involved.',
    'Surprise audits catch unprepared visibile risks and some social risks.',
    'Announced audits allow are generally poor at identifying social risks.',
    'Evidence-supported self-reporting confirms existence of policies only',
    'Self-reporting without evidence is likely ineffective.'
  ];

  const effectivenessAssumptions = [
    'Effective: workers are likely to say if there are issues.',
    'Intermittently effective if done well: can show issues at survey time.',
    'Can be effective where issues are easily visible.',
    'Not that effective as preparation/concealment of issues is possible.',
    'Confirms existence of policies not implementation of them',
    'Not effective as suppliers tend not to self-report problems.'
  ];

  const categoryInfo = [
    { name: 'Worker Voice', color: '#22c55e', tools: [0, 1] },
    { name: 'Audit', color: '#f59e0b', tools: [2, 3] },
    { name: 'Passive', color: '#6b7280', tools: [4, 5] }
  ];

  let localTransparency = [...transparency];

  const updateTransparency = (options = {}) => {
    if (options.notify !== false && onTransparencyChange) {
      onTransparencyChange([...localTransparency]);
    }
  };

  container.innerHTML = `
    <div class="transparency-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; height: 100%;">

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Transparency effectiveness</h2>
        <button id="resetTransparency" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          Reset to Default
        </button>
      </div>

      <div id="transparencyContainer" style="margin-bottom: 20px;"></div>

      <div style="margin-top: 16px;">
        <div data-panel3-info="transparency" style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #78350f;">Enhanced Transparency Calculation:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li><strong>Effectiveness:</strong> Rates of risk detection achieved by each tool.</li>
            <li><strong>Use the focus setting below</strong> to allocate your coverage based on country risk levels.</li>
            <li><strong>Note diminishing returns:</strong> Tools are assumed to overlap in suppliers; the model has a 90% cap implemented on effectiveness (some risks may always remain hidden).</li>
          </ul>
        </div>
      </div>
  `;

  const transparencyContainer = document.getElementById('transparencyContainer');
  strategyLabels.forEach((label, index) => {
    // Find which category this tool belongs to
    const category = categoryInfo.find(cat => cat.tools.includes(index));
    const categoryColor = category ? category.color : '#6b7280';

    const transparencyControl = document.createElement('div');
    transparencyControl.dataset.transparencyIndex = index;
    transparencyControl.style.cssText = `margin-bottom: 20px; padding: 16px; border: 2px solid ${categoryColor}20; border-radius: 8px; background-color: ${categoryColor}05; display: flex; flex-direction: column; gap: 12px;`;
    transparencyControl.innerHTML = `
      <label for="transparency_${index}" style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        <span style="color: ${categoryColor}; font-weight: 600;">[${category?.name || 'Other'}]</span> ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; font-style: italic;">
        ${effectivenessAssumptions[index]}
      </div>
      <div style="display: flex; align-items: center; gap: 12px; padding-top: 4px;">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: left;">Ineffective</span>
        <input type="range" min="0" max="100" value="${localTransparency[index]}" id="transparency_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db; accent-color: ${categoryColor};">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: right;">Fully effective</span>
      </div>
    `;
    transparencyContainer.appendChild(transparencyControl);

    const rangeInput = document.getElementById(`transparency_${index}`);
    const updateTransparencyValue = (value, options = {}) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));

      localTransparency[index] = newValue;
      rangeInput.value = newValue;
        updateTransparency(options);
    };

    rangeInput.addEventListener('input', (e) => updateTransparencyValue(e.target.value, { notify: false }));
    rangeInput.addEventListener('change', (e) => updateTransparencyValue(e.target.value));
  });

  ensurePanel3ResizeListener();
  schedulePanel3Alignment();

  const resetButton = document.getElementById('resetTransparency');
  resetButton.addEventListener('click', () => {
    localTransparency = [...riskEngine.defaultTransparencyEffectiveness];
    localTransparency.forEach((effectiveness, index) => {
      document.getElementById(`transparency_${index}`).value = effectiveness;
    });
    updateTransparency();
    schedulePanel3Alignment();
  });
}

export function createResponsivenessPanel(containerId, { responsiveness, onResponsivenessChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const responsivenessLabels = riskEngine.responsivenessLabels;
  const responsivenessDescriptions = [
    'Real-time dashboards drive transparency and behaviour change.',
    'Commercial requirements align purchasing power to rights outcomes.',
    'Corrective action plans agreed with suppliers to fix identified problems.',
    'Longer-term capability building with suppliers (training, incentives).',
    'Collective agreements and frameworks that shift sector behaviour.',
    'Case-by-case fixes when problems surface, without systemic change.',
    ];

  let localResponsiveness = [...responsiveness];

  const updateResponsiveness = (options = {}) => {
    const total = localResponsiveness.reduce((sum, w) => sum + w, 0);
    const formattedTotal = Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    const totalElement = document.getElementById('totalResponsiveness');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
    }
    if (options.notify !== false && onResponsivenessChange) {
      onResponsivenessChange([...localResponsiveness]);
    }
    schedulePanel4Alignment();
  };

  const applyResponsivenessValue = (index, value, options = {}) => {
    if (!Number.isInteger(index) || index < 0 || index >= localResponsiveness.length) {
      return null;
    }

    const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
    localResponsiveness[index] = newValue;

    const rangeInput = document.getElementById(`responsiveness_${index}`);
    if (rangeInput) {
      rangeInput.value = newValue;
    }

    updateResponsiveness({ notify: options.notify !== false });

    return newValue;
  };

  container.innerHTML = `
    <div class="responsiveness-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Response Strategy Mix</h2>
        <button id="resetResponsiveness" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          Reset to Default
        </button>
      </div>

      <div id="responsivenessContainer" style="margin-bottom: 20px;"></div>

      <div data-panel4-info="strategyDetails" style="background-color: #e0f2fe; border: 1px solid #0891b2; color: #0e7490; padding: 16px; border-radius: 8px; margin-top: 16px;">
        <h4 style="font-weight: 600; margin-bottom: 8px; color: #155e75;">Response Strategies:</h4>
        <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
          <li>Slider to the right = deeper investment in that remediation lever.</li>
          <li>Combine quick fixes with systemic levers for durable change.</li>
          <li>The assumed effectiveness of each lever is set out in the right hand panel.</li>
        </ul>
      </div>
    </div>
  `;
  const responsivenessContainer = document.getElementById('responsivenessContainer');
  responsivenessLabels.forEach((label, index) => {
    const responsivenessControl = document.createElement('div');
    responsivenessControl.dataset.responsivenessIndex = index;
    responsivenessControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
    responsivenessControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
        ${responsivenessDescriptions[index]}
      </div>
       <div style="display: flex; align-items: center; gap: 12px; padding-top: 4px;">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: left;">No suppliers</span>
        <input type="range" min="0" max="100" value="${localResponsiveness[index]}" id="responsiveness_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db; accent-color: #0ea5e9;">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: right;">All suppliers</span>
      </div>
    `;
    responsivenessContainer.appendChild(responsivenessControl);

   const rangeInput = document.getElementById(`responsiveness_${index}`);

    const handleResponsivenessChange = (value, options = {}) => {
      const sanitizedValue = applyResponsivenessValue(index, value, options);

      if (index === 0) {
        const updateStrategyUI =
          typeof window !== 'undefined'
            ? (window.hrddApp?.updateHRDDStrategyUI || window.updateHRDDStrategyUI)
            : null;

        if (typeof updateStrategyUI === 'function') {
          updateStrategyUI(0, sanitizedValue, { notify: false });
        }
      }
    };

    if (rangeInput) {
      rangeInput.addEventListener('input', (e) => handleResponsivenessChange(e.target.value));
      rangeInput.addEventListener('change', (e) => handleResponsivenessChange(e.target.value));
    }
  });

  const updateResponsivenessUI = (target, value, options = {}) => {
    if (Array.isArray(target)) {
      target.forEach((val, idx) => {
        applyResponsivenessValue(idx, val, { notify: false });
      });
      updateResponsiveness({ notify: options.notify !== false });
      return;
    }

    if (Number.isInteger(target)) {
      applyResponsivenessValue(target, value, options);
    }
  };

  if (typeof window !== 'undefined') {
    if (window.hrddApp) {
      window.hrddApp.updateResponsivenessUI = updateResponsivenessUI;
    } else {
      window.updateResponsivenessUI = updateResponsivenessUI;
    }
  }

  const resetButton = document.getElementById('resetResponsiveness');
  resetButton.addEventListener('click', () => {
    localResponsiveness = [...riskEngine.defaultResponsivenessStrategy];
    localResponsiveness.forEach((weight, index) => {
      applyResponsivenessValue(index, weight, { notify: false });
    });
    updateResponsiveness();
  });

  ensurePanel4ResizeListener();
  schedulePanel4Alignment();
}

export function createResponsivenessEffectivenessPanel(containerId, { effectiveness, onEffectivenessChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const responsivenessLabels = riskEngine.responsivenessLabels;
  const effectivenessDescriptions = [
    'Effective as real-time data drives supplier behaviour.',
    'Effective as improvements linked to orders provided follow up is strong.',
    'Intermittently effective if periodic reviews include further checks.',
    'Somewhat effective if training and education regularly repeated.',
    'Limited effectiveness if approach is holistic.',
    'Limited effectiveness if strategy is only reactive.'
  ];

  let localEffectiveness = [...effectiveness];

   const updateEffectiveness = () => {
    const total = localEffectiveness.reduce((sum, value) => sum + value, 0);
    const formattedTotal = Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    const totalElement = document.getElementById('totalResponsivenessEffectiveness');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
    }
    if (onEffectivenessChange) onEffectivenessChange([...localEffectiveness]);
    schedulePanel4Alignment();
  };

  container.innerHTML = `
    <div class="responsiveness-effectiveness-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #1f2937;">Response Effectiveness</h2>
        <button id="resetResponsivenessEffectiveness" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          Reset to Default
        </button>
      </div>

       <div id="responsivenessEffectivenessContainer" style="margin-bottom: 20px;"></div>
      <div data-panel4-info="effectivenessDetails" style="background-color: #ecfeff; border: 1px solid #06b6d4; color: #0e7490; padding: 16px; border-radius: 8px; margin-top: 16px;">
        <h4 style="font-weight: 600; margin-bottom: 8px; color: #155e75;">Interpreting Effectiveness:</h4>
        <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
          <li>Slider to the right means remediation outcomes are more impactful.</li>
          <li>Higher and more effective levels of responsiveness can reduce risk.</li>
          <li>Combining levers can increase overall effectiveness.</li>
        </ul>
      </div>
    </div>
  `;

  const effectivenessContainer = document.getElementById('responsivenessEffectivenessContainer');
  responsivenessLabels.forEach((label, index) => {
    const effectivenessControl = document.createElement('div');
    effectivenessControl.dataset.responsivenessEffectivenessIndex = index;
    effectivenessControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
    effectivenessControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
        ${effectivenessDescriptions[index]}
      </div>
      <div style="display: flex; align-items: center; gap: 12px; padding-top: 4px;">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: left;">Ineffective</span>
        <input type="range" min="0" max="100" value="${localEffectiveness[index]}" id="responsivenessEffectiveness_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db; accent-color: #0ea5e9;">
        <span style="font-size: 11px; color: #6b7280; min-width: 90px; text-align: right;">Fully effective</span>
      </div>
    `;
    effectivenessContainer.appendChild(effectivenessControl);

    const rangeInput = document.getElementById(`responsivenessEffectiveness_${index}`);
    const updateEffectivenessValue = (value) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
      localEffectiveness[index] = newValue;
      rangeInput.value = newValue;
      updateEffectiveness();
    };

    rangeInput.addEventListener('input', (e) => updateEffectivenessValue(e.target.value));
    rangeInput.addEventListener('change', (e) => updateEffectivenessValue(e.target.value));
  });

  const resetButton = document.getElementById('resetResponsivenessEffectiveness');
  resetButton.addEventListener('click', () => {
    localEffectiveness = [...riskEngine.defaultResponsivenessEffectiveness];
    localEffectiveness.forEach((value, index) => {
      document.getElementById(`responsivenessEffectiveness_${index}`).value = value;
    });
    updateEffectiveness();
  });

  ensurePanel4ResizeListener();
  schedulePanel4Alignment();
}

// ENHANCED: Final results panel with comprehensive focus analysis
export function createFinalResultsPanel(containerId, { baselineRisk, managedRisk, selectedCountries, countries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus = 0, riskConcentration = 1, countryVolumes, countryRisks, focusEffectivenessMetrics = null }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const summary = riskEngine.generateRiskSummary(
    baselineRisk,
    managedRisk,
    selectedCountries,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus,
    riskConcentration,
    countryVolumes,
    countryRisks
  ) || {};

  const ensureNumber = (value, fallback = 0) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const formatNumber = (value, digits = 1) => {
    const numeric = ensureNumber(value, null);
    if (numeric === null) {
      return (0).toFixed(digits);
    }
    return numeric.toFixed(digits);
  };

  const strategySummary = summary.strategy || {};
  const improvementSummary = summary.improvement || {};
  const portfolioSummary = summary.portfolio || {};
  const focusData = strategySummary.focus || { level: 0, portfolioMultiplier: 1, concentration: 1 };

  const focusLevel = ensureNumber(focusData.level);
  const focusPercent = Math.round(focusLevel * 100);
  const focusMultiplier = ensureNumber(focusData.portfolioMultiplier, 1);
  const concentrationFactor = ensureNumber(portfolioSummary.riskConcentration, 1);

   const baselineValue = ensureNumber(baselineRisk);
  const managedValue = ensureNumber(managedRisk);
  const transparencyValue = ensureNumber(strategySummary.overallTransparency);
  const responsivenessValue = ensureNumber(strategySummary.overallResponsiveness);
  const combinedEffectiveness = transparencyValue * responsivenessValue;
  const riskReductionValue = ensureNumber(improvementSummary.riskReduction);
  const absoluteReductionValue = ensureNumber(improvementSummary.absoluteReduction);

  const sanitizedTransparency = Math.max(0, Math.min(1, transparencyValue));
  const sanitizedResponsiveness = Math.max(0, Math.min(1, responsivenessValue));
  const sanitizedFocusMultiplier = Math.max(0, focusMultiplier);

  const totalReduction = ensureNumber(baselineValue - managedValue);
  const baseReduction = sanitizedFocusMultiplier > 0
    ? totalReduction / sanitizedFocusMultiplier
    : 0;
  const focusStageReduction = totalReduction - baseReduction;

  const detectionWeight = (sanitizedTransparency + sanitizedResponsiveness) > 0
    ? sanitizedTransparency / (sanitizedTransparency + sanitizedResponsiveness)
    : 0.5;

  const detectionStageReduction = baseReduction * detectionWeight;
  const responseStageReduction = baseReduction - detectionStageReduction;

  const riskAfterDetection = baselineValue - detectionStageReduction;
  const riskAfterResponse = riskAfterDetection - responseStageReduction;
  const finalManagedRisk = managedValue;

  const detectionStepPercent = baselineValue > 0
    ? (detectionStageReduction / baselineValue) * 100
    : 0;
  const responseStepPercent = baselineValue > 0
    ? (responseStageReduction / baselineValue) * 100
    : 0;
  const focusStepPercent = baselineValue > 0
    ? (focusStageReduction / baselineValue) * 100
    : 0;

  const detectionStageAmount = Math.abs(detectionStageReduction);
  const responseStageAmount = Math.abs(responseStageReduction);
  const focusStageAmount = Math.abs(focusStageReduction);
  const totalReductionAmount = Math.abs(totalReduction);

  const detectionStageVerb = detectionStageReduction >= 0 ? 'removed' : 'added';
  const responseStageVerb = responseStageReduction >= 0 ? 'removed' : 'added';
  const focusStageVerb = focusStageReduction >= 0 ? 'removed' : 'added';
  const totalReductionVerb = totalReduction >= 0 ? 'removed' : 'added';

  const strategies = Array.isArray(strategySummary.hrddStrategies)
    ? strategySummary.hrddStrategies
    : [];

  const categoryColors = {
    'Worker Voice': '#22c55e',
    'Audit': '#f59e0b',
    'Trusting': '#6b7280'
  };

  const safeDetectionTotal = strategies.reduce((sum, strategy) => {
    const contributionValue = ensureNumber(strategy?.contribution);
    return sum + Math.max(0, contributionValue);
  }, 0);

  const detectionBreakdown = strategies.map(strategy => {
    const coverageValue = ensureNumber(strategy?.coverage);
    const assumedEffectiveness = ensureNumber(strategy?.averageEffectiveness);
    const contributionValue = Math.max(0, ensureNumber(strategy?.contribution));
    const stageShare = safeDetectionTotal > 0
      ? contributionValue / safeDetectionTotal
      : (strategies.length > 0 ? 1 / strategies.length : 0);
    const riskPoints = detectionStageReduction * stageShare;
    const percentOfTotal = totalReduction !== 0
      ? (riskPoints / totalReduction) * 100
      : 0;

    return {
      name: strategy?.name || 'Strategy',
      category: strategy?.category || 'Strategy',
      coverage: coverageValue,
      coverageRange: strategy?.coverageRange || null,
      assumedEffectiveness,
      riskPoints,
      percentOfTotal,
      stageShare: detectionStageReduction !== 0 ? stageShare * 100 : 0
    };
  });

  const responseLabels = Array.isArray(riskEngine.responsivenessLabels)
    ? riskEngine.responsivenessLabels
    : [];

  const sanitizedResponseWeights = Array.isArray(responsivenessStrategy)
    ? responsivenessStrategy.map(value => Math.max(0, ensureNumber(value)))
    : [];
  const sanitizedResponseEffectiveness = Array.isArray(responsivenessEffectiveness)
    ? responsivenessEffectiveness.map(value => Math.max(0, ensureNumber(value)))
    : [];

  const totalResponseWeight = sanitizedResponseWeights.reduce((sum, value) => sum + value, 0);

  const responseDetails = responseLabels.map((label, index) => {
    const weight = sanitizedResponseWeights[index] || 0;
    const shareOfIssues = totalResponseWeight > 0 ? weight / totalResponseWeight : 0;
    const assumedEffectiveness = sanitizedResponseEffectiveness[index] || 0;
    const contributionScore = shareOfIssues * (assumedEffectiveness / 100);

    return {
      name: label,
      shareOfIssues,
      assumedEffectiveness,
      contributionScore
    };
  });

  const totalResponseContribution = responseDetails.reduce((sum, detail) => sum + detail.contributionScore, 0);

  const responseBreakdown = responseDetails.map(detail => {
    const stageShare = totalResponseContribution > 0 ? detail.contributionScore / totalResponseContribution : 0;
    const riskPoints = responseStageReduction * stageShare;
    const percentOfTotal = totalReduction !== 0
      ? (riskPoints / totalReduction) * 100
      : 0;

    return {
      ...detail,
      riskPoints,
      percentOfTotal,
      stageShare: responseStageReduction !== 0 ? stageShare * 100 : 0
    };
  });

  const detectionShareOfTotal = totalReduction !== 0 ? (detectionStageReduction / totalReduction) * 100 : 0;
  const responseShareOfTotal = totalReduction !== 0 ? (responseStageReduction / totalReduction) * 100 : 0;
  const focusShareOfTotal = totalReduction !== 0 ? (focusStageReduction / totalReduction) * 100 : 0;

  const detectionBreakdownHtml = detectionBreakdown.length > 0
    ? detectionBreakdown.map(item => {
        const color = categoryColors[item.category] || '#3b82f6';
        const coverageDisplay = item.coverageRange ? 
          `Coverage: ${item.coverageRange} (focus-adjusted)` : 
          `Coverage: ${formatNumber(item.coverage, 0)}%`;
      return `
          <div style="padding: 12px 14px; border: 1px solid ${color}30; border-left: 4px solid ${color}; border-radius: 8px; background-color: white; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-weight: 600; color: #1f2937;">${item.name}</div>
            <div style="font-size: 12px; color: #4b5563;">
              ${coverageDisplay} • Assumed detection: ${formatNumber(item.assumedEffectiveness, 0)}%
            </div>
            <div style="font-size: 12px; color: #1e40af;">
              Contributes ${formatNumber(item.riskPoints)} pts (${formatNumber(item.percentOfTotal)}% of total reduction)
            </div>
          </div>
        `;
      }).join('')
    : '<div style="padding: 12px 14px; border: 1px dashed #94a3b8; border-radius: 8px; background-color: #f8fafc; color: #475569; font-size: 12px;">Adjust your coverage in Panel 3 to unlock detection-driven risk reduction.</div>';

  const responseBreakdownHtml = responseBreakdown.length > 0
    ? responseBreakdown.map(item => `
        <div style="padding: 12px 14px; border: 1px solid #a855f730; border-left: 4px solid #8b5cf6; border-radius: 8px; background-color: white; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-weight: 600; color: #312e81;">${item.name}</div>
          <div style="font-size: 12px; color: #4c1d95;">
            Issues addressed: ${formatNumber(item.shareOfIssues * 100, 0)}% • Assumed effectiveness: ${formatNumber(item.assumedEffectiveness, 0)}%
          </div>
          <div style="font-size: 12px; color: #5b21b6;">
            Contributes ${formatNumber(item.riskPoints)} pts (${formatNumber(item.percentOfTotal)}% of total reduction)
          </div>
        </div>
      `).join('')
    : '<div style="padding: 12px 14px; border: 1px dashed #c4b5fd; border-radius: 8px; background-color: #f5f3ff; color: #5b21b6; font-size: 12px;">Allocate response effort in Panel 4 to translate detections into remediation.</div>';

  container.innerHTML = `
    <div class="final-results-panel">
      <!-- RISK ASSESSMENT SUMMARY -->
      <div id="finalRiskSummary" style="margin-bottom: 32px;"></div>

      <!-- RISK TRANSFORMATION EXPLANATION -->
      <div id="strategyTransformationSection" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
        <h3 style="font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #1f2937;">How Your Enhanced HRDD Strategy Reduces Risk</h3>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 14px; margin: 0; color: #1e40af; line-height: 1.5;">
            <strong>Your enhanced HRDD strategy transforms baseline risk through five key mechanisms:</strong> 
            detecting issues through focus-adjusted transparency tools, responding effectively when issues are found, 
            concentrating resources on high-risk countries, leveraging portfolio effects, and optimizing coverage allocation.
          </p>
        </div>

        <!-- STEP-BY-STEP RISK TRANSFORMATION -->
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
          
         <!-- Step 1: Starting Point -->
          <div style="display: flex; align-items: center; padding: 16px; border-radius: 8px; background-color: #fef3c7; border: 1px solid #f59e0b;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #f59e0b; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 16px;">1</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">Baseline Portfolio Risk</div>
              <div style="font-size: 24px; font-weight: bold; color: #92400e;">${formatNumber(baselineValue)}</div>
              <div style="font-size: 12px; color: #a16207;">Starting risk level before enhanced HRDD strategy application</div>
            </div>
          </div>

          <!-- Arrow -->
           <div style="text-align: center; color: #6b7280;">
            <div style="font-size: 20px;">↓</div>
            <div style="font-size: 12px;">Apply Focus-Adjusted Detection Coverage</div>
          </div>

          <!-- Step 2: After Detection -->
          <div style="display: flex; align-items: center; padding: 16px; border-radius: 8px; background-color: #dbeafe; border: 1px solid #3b82f6;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 16px;">2</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #1d4ed8; margin-bottom: 4px;">Detection Coverage Applied (${formatNumber(transparencyValue * 100)}% transparency effectiveness)</div>
              <div style="font-size: 24px; font-weight: bold; color: #1d4ed8;">${formatNumber(riskAfterDetection)}</div>
              <div style="font-size: 12px; color: #1e40af;">
                Detection stage ${detectionStageVerb} ${formatNumber(detectionStageAmount)} pts
                (${formatNumber(detectionStepPercent)}% of baseline • ${formatNumber(detectionShareOfTotal)}% of total reduction)
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div style="text-align: center; color: #6b7280;">
            <div style="font-size: 20px;">↓</div>
            <div style="font-size: 12px;">Allocate Response Capacity</div>
          </div>

          <!-- Step 3: After Response -->
          <div style="display: flex; align-items: center; padding: 16px; border-radius: 8px; background-color: #f3e8ff; border: 1px solid #8b5cf6;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 16px;">3</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #7c3aed; margin-bottom: 4px;">Response Allocation Applied (${formatNumber(responsivenessValue * 100)}% response effectiveness)</div>
              <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${formatNumber(riskAfterResponse)}</div>
              <div style="font-size: 12px; color: #6d28d9;">
                Response levers ${responseStageVerb} ${formatNumber(responseStageAmount)} pts
                (${formatNumber(responseStepPercent)}% of baseline • ${formatNumber(responseShareOfTotal)}% of total reduction)
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div style="text-align: center; color: #6b7280;">
            <div style="font-size: 20px;">↓</div>
            <div style="font-size: 12px;">Apply Enhanced Focus & Concentration Effects</div>
          </div>

           <!-- Step 4: Final Result -->
           <div style="display: flex; align-items: center; padding: 16px; border-radius: 8px; background-color: #d1fae5; border: 1px solid #22c55e;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #22c55e; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 16px;">4</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #16a34a; margin-bottom: 4px;">Final Enhanced Managed Risk (${focusPercent}% focus, ${concentrationFactor.toFixed(2)}× concentration)</div>
              <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${formatNumber(finalManagedRisk)}</div>
              <div style="font-size: 12px; color: #15803d;">
                Enhanced focus adjustments ${focusStageVerb} ${formatNumber(focusStageAmount)} pts
                (${formatNumber(focusStepPercent)}% of baseline • ${formatNumber(focusShareOfTotal)}% of total reduction)
              </div>
            </div>
          </div>
        </div>

        <!-- EFFECTIVENESS BREAKDOWN -->
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #374151;">Enhanced Strategy Impact Summary</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">TOTAL RISK REDUCTION</div>
              <div style="font-size: 20px; font-weight: bold; color: #059669;">${formatNumber(riskReductionValue)}%</div>
              <div style="font-size: 11px; color: #6b7280;">${formatNumber(absoluteReductionValue)} point reduction</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">COMBINED EFFECTIVENESS</div>
              <div style="font-size: 20px; font-weight: bold; color: #7c3aed;">${formatNumber(combinedEffectiveness * 100)}%</div>
              <div style="font-size: 11px; color: #6b7280;">Transparency × Response</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">ENHANCED FOCUS MULTIPLIER</div>
              <div style="font-size: 20px; font-weight: bold; color: #1d4ed8;">${formatNumber(focusMultiplier, 2)}×</div>
              <div style="font-size: 11px; color: #6b7280;">Resource concentration effect</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DETAILED STRATEGY BREAKDOWN -->
      <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #374151;">How coverage & response choices reduce risk</h3>
        <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
          Your enhanced configuration ${totalReductionVerb} ${formatNumber(totalReductionAmount)} pts of risk from the baseline.
          Panel 3 detection coverage ${detectionStageVerb} ${formatNumber(detectionStageAmount)} pts (~${formatNumber(detectionShareOfTotal)}% of the total change),
          while Panel 4 response allocation ${responseStageVerb} ${formatNumber(responseStageAmount)} pts (~${formatNumber(responseShareOfTotal)}%).
          Enhanced focus settings ${focusStageVerb} ${formatNumber(focusStageAmount)} pts by intelligently concentrating effort on higher-risk countries.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
          <div style="border: 1px solid #bfdbfe; background-color: #eff6ff; padding: 16px; border-radius: 10px; display: flex; flex-direction: column; gap: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #1d4ed8;">Panel 3 · Enhanced Detection coverage</div>
              <div style="font-size: 12px; color: #1e40af;">${detectionStageVerb.charAt(0).toUpperCase() + detectionStageVerb.slice(1)} ${formatNumber(detectionStageAmount)} pts (~${formatNumber(detectionShareOfTotal)}% of total)</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${detectionBreakdownHtml}
            </div>
          </div>
          <div style="border: 1px solid #ddd6fe; background-color: #f5f3ff; padding: 16px; border-radius: 10px; display: flex; flex-direction: column; gap: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #5b21b6;">Panel 4 · Response allocation</div>
              <div style="font-size: 12px; color: #4c1d95;">${responseStageVerb.charAt(0).toUpperCase() + responseStageVerb.slice(1)} ${formatNumber(responseStageAmount)} pts (~${formatNumber(responseShareOfTotal)}% of total)</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${responseBreakdownHtml}
            </div>
          </div>
        </div>
        <div style="margin-top: 16px; font-size: 12px; color: #475569; background-color: #f1f5f9; border: 1px dashed #cbd5f5; border-radius: 8px; padding: 12px;">
          Enhanced focus and concentration settings ${focusStageVerb} ${formatNumber(focusStageAmount)} pts (${formatNumber(focusShareOfTotal)}% of the total change) by intelligently steering coverage and remediation toward the highest-risk parts of your portfolio with advanced risk-based allocation algorithms.
        </div>
      </div>

      </div>
  `;

 createRiskComparisonPanel('finalRiskSummary', {
    baselineRisk,
    managedRisk,
    selectedCountries,
    focusEffectivenessMetrics
  });
}

export function createCountrySelectionPanel(containerId, { countries, selectedCountries, countryVolumes, onCountrySelect, onVolumeChange }) {
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
          <li>Set weighting for each country (higher = more influence on risk)</li>
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

  updateSelectedCountriesDisplay(selectedCountries, countries, countryVolumes, onCountrySelect, onVolumeChange);
}

export function createResultsPanel(containerId, { selectedCountries, countries, countryRisks, baselineRisk }) {
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
          This baseline risk will be used in Panels 3-4 to configure enhanced HRDD strategies and
          in Panel 5 to calculate managed risk levels with intelligent focus-based allocation.
        </p>
      </div>
    </div>
  `;

  updateRiskBreakdown(selectedCountries, countries, countryRisks);
}

export function createWeightingsPanel(containerId, { weights, onWeightsChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const weightFactors = [
    {
      label: 'International Trade Union Confederation - Global Rights Index',
      description: 'Measures the overall protection of internationally recognised core labour rights.',
      sourceLabel: 'ITUC Global Rights Index',
      url: 'https://www.ituc-csi.org/global-rights-index'
    },
    {
      label: 'Transparency International - Corruption Perceptions Index',
      description: 'Uses Transparency International data to capture perceived corruption in public institutions.',
      sourceLabel: 'Transparency International – Corruption Perceptions Index',
      url: 'https://www.transparency.org/en/cpi'
    },
    {
      label: 'ILO - International Labour Migration Statistics, migrant worker prevalence',
      description: 'Highlights migrant worker participation using the ILO’s international labour migration statistics.',
      sourceLabel: 'ILO International Labour Migration Statistics',
      url: 'https://ilostat.ilo.org/methods/concepts-and-definitions/description-international-labour-migration-statistics/'
    },
    {
      label: 'World Justic Project - Rule of Law Index (using 4.8: Fundamental Labour Rights)',
      description: 'Reflects fundamental labour rights performance from the World Justice Project Rule of Law Index.',
      sourceLabel: 'WJP Rule of Law Index – Fundamental Rights',
      url: 'https://worldjusticeproject.org/rule-of-law-index/global/2024/Fundamental%20Rights/'
    },
    {
      label: 'Walk Free - Global Slavery Index',
      description: 'Captures vulnerability to modern slavery using Walk Free’s Global Slavery Index.',
      sourceLabel: 'Walk Free Global Slavery Index',
      url: 'https://www.walkfree.org/global-slavery-index/'
    }
  ];

  const indexSources = [
    {
      name: 'International Trade Union Confederation - Global Rights Index',
      url: 'https://www.ituc-csi.org/global-rights-index'
    },
    {
      name: 'Transparency International - Corruption Perceptions Index',
      url: 'https://www.transparency.org/en/cpi/2024'
    },
    {
      name: 'ILO - International Labour Migration Statistics',
      url: 'https://ilostat.ilo.org/methods/concepts-and-definitions/description-international-labour-migration-statistics/'
    },
    {
      name: 'World Justice Project - Rule of Law Index – Fundamental Rights',
      url: 'https://worldjusticeproject.org/rule-of-law-index/global/2024/Fundamental%20Rights/'
    },
    {
      name: 'Walk Free Global Slavery Index – Country Profiles',
      url: 'https://www.walkfree.org/global-slavery-index/'
    }
  ];

  let localWeights = Array.isArray(weights) ? [...weights] : new Array(weightFactors.length).fill(0);
  if (localWeights.length < weightFactors.length) {
    localWeights = [...localWeights, ...new Array(weightFactors.length - localWeights.length).fill(0)];
  }

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

      <div style="margin-bottom: 20px; padding: 16px; border-radius: 10px; border: 1px solid #bfdbfe; background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);">
        <h3 style="font-size: 15px; font-weight: 600; color: #1d4ed8; margin: 0 0 12px 0;">Click below to visit the sources of the index data</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          ${indexSources.map(source => `
            <a href="${source.url}" target="_blank" rel="noopener noreferrer"
               style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-radius: 8px; background-color: rgba(255, 255, 255, 0.92); text-decoration: none; border: 1px solid rgba(59, 130, 246, 0.25); box-shadow: 0 4px 8px rgba(15, 23, 42, 0.08);">
              <span style="font-size: 13px; font-weight: 600; color: #1d4ed8;">${source.name}</span>
              <span aria-hidden="true" style="font-size: 14px; color: #1d4ed8;">↗</span>
            </a>
          `).join('')}
        </div>
      </div>

      <div id="weightsContainer" style="margin-bottom: 20px;"></div>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; color: #374151; padding: 16px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 500;">Total Weighting: <span id="totalWeights">${localWeights.reduce((sum, w) => sum + w, 0)}</span>%</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Suggested range: 100% (but can exceed to reflect emphasis)</div>
      </div>
    </div>
  `;

  const weightsContainer = document.getElementById('weightsContainer');
  weightFactors.forEach((factor, index) => {
    const weightValue = Number.isFinite(Number(localWeights[index])) ? Number(localWeights[index]) : 0;
    const weightControl = document.createElement('div');
    weightControl.style.cssText = 'margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;';
    weightControl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
        <label style="display: block; font-size: 14px; font-weight: 600; color: #1f2937; margin: 0;">
          ${factor.label}
        </label>
        <a href="${factor.url}" target="_blank" rel="noopener noreferrer"
           style="font-size: 12px; color: #2563eb; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          <span>${factor.sourceLabel}</span>
          <span aria-hidden="true" style="font-size: 14px;">↗</span>
        </a>
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${factor.description}</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <input type="range" min="0" max="100" value="${weightValue}" id="weight_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
        <input type="number" min="0" max="100" value="${weightValue}" id="weightNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
      </div>
    `;
    weightsContainer.appendChild(weightControl);

    const rangeInput = document.getElementById(`weight_${index}`);
    const numberInput = document.getElementById(`weightNum_${index}`);

    const updateWeightValue = (value) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
      localWeights[index] = newValue;
      rangeInput.value = newValue;
      numberInput.value = newValue;
      updateWeights();
    };

    rangeInput.addEventListener('input', (e) => updateWeightValue(e.target.value));
    numberInput.addEventListener('input', (e) => updateWeightValue(e.target.value));
  });

  const resetButton = document.getElementById('resetWeights');
  resetButton.addEventListener('click', () => {
    localWeights = [...riskEngine.defaultWeights];
    localWeights.forEach((weight, index) => {
      document.getElementById(`weight_${index}`).value = weight;
      document.getElementById(`weightNum_${index}`).value = weight;
    });
    updateWeights();
  });
}

export function updateSelectedCountriesDisplay(selectedCountries, countries, countryVolumes, onCountrySelect, onVolumeChange) {
  const container = document.getElementById('selectedCountries');
  if (!container) return;

  if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; border: 2px dashed #cbd5f5; border-radius: 12px; background-color: #eff6ff; text-align: center; color: #1d4ed8;">
        <div style="font-size: 40px; margin-bottom: 12px;">🌍</div>
        <p style="font-size: 14px; margin-bottom: 4px;">No countries selected yet.</p>
        <p style="font-size: 13px; color: #1e3a8a;">Click on the map or use the dropdown above to add countries to your HRDD portfolio.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  const countryList = document.createElement('div');
  countryList.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
  container.appendChild(countryList);

  selectedCountries.forEach((countryCode, index) => {
    const country = countries.find(c => c.isoCode === countryCode);
    const volume = countryVolumes[countryCode] ?? 10;

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
          <label style="font-size: 14px; color: #6b7280; font-weight: 500;">Weighting:</label>
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

export function updateRiskBreakdown(selectedCountries, countries, countryRisks) {
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

// Panel 6 Cost Analysis (only if enabled)
export function createCostAnalysisPanel(containerId, options) {
  // Early return if Panel 6 is disabled
  if (typeof window !== 'undefined' && window.hrddApp && !window.hrddApp.ENABLE_PANEL_6) {
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    supplierCount,
    hourlyRate,
    toolAnnualProgrammeCosts,
    toolPerSupplierCosts,
    toolInternalHours,
    responseInternalHours,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    selectedCountries,
    countryVolumes,
    countryRisks,
    focus,
    baselineRisk,
    managedRisk,
    onSupplierCountChange,
    onHourlyRateChange,
    onToolAnnualProgrammeCostChange,
    onToolPerSupplierCostChange,
    onToolInternalHoursChange,
    onResponseInternalHoursChange,
   optimizeBudgetAllocation,
    saqConstraintEnabled = false,
    onSAQConstraintChange
  } = options;

  const mobile = isMobileView();
  const responsive = (mobileValue, desktopValue) => (mobile ? mobileValue : desktopValue);

  const enforceSAQConstraint = Boolean(saqConstraintEnabled);

  // Calculate current budget and effectiveness
  const budgetData = riskEngine.calculateBudgetAnalysis(
    supplierCount,
    hourlyRate,
    toolAnnualProgrammeCosts,
    toolPerSupplierCosts,
    toolInternalHours,
    responseInternalHours,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    selectedCountries,
    countryVolumes,
    countryRisks,
    focus
  );

  const safeBudgetData = budgetData || {
    supplierCount: Math.max(1, Math.floor(supplierCount || 1)),
    hourlyRate: Math.max(0, parseFloat(hourlyRate) || 0),
    totalExternalCost: 0,
    totalInternalCost: 0,
    totalToolInternalCost: 0,
    totalResponseInternalCost: 0,
    totalBudget: 0,
    costPerSupplier: 0,
    currentAllocation: Array.isArray(hrddStrategy) ? [...hrddStrategy] : [],
    responseAllocation: Array.isArray(responsivenessStrategy) ? [...responsivenessStrategy] : []
  };

  const strategyCount = Array.isArray(riskEngine?.hrddStrategyLabels)
    ? riskEngine.hrddStrategyLabels.length
    : 0;
  const responseCount = Array.isArray(riskEngine?.responsivenessLabels)
    ? riskEngine.responsivenessLabels.length
    : 0;

  const sanitizeArray = (values, length, min = 0, max = Number.POSITIVE_INFINITY) => {
    const baseArray = Array.isArray(values) ? values : [];
    const result = Array.from({ length }, (_, index) => {
      const rawValue = baseArray[index];
      const numeric = Math.max(min, parseFloat(rawValue) || 0);
      return Number.isFinite(max) ? Math.min(max, numeric) : numeric;
    });

    return result;
  };

  const sanitizedSupplierCount = Math.max(1, Math.floor(safeBudgetData.supplierCount || supplierCount || 1));
  const sanitizedHourlyRate = Math.max(0, parseFloat(safeBudgetData.hourlyRate || hourlyRate || 0));
  const sanitizedToolAnnualProgrammeCosts = sanitizeArray(
    toolAnnualProgrammeCosts,
    strategyCount,
    0,
    50000
  );
  const sanitizedToolPerSupplierCosts = sanitizeArray(
    toolPerSupplierCosts,
    strategyCount,
    0,
    2000
  );
  const sanitizedToolInternalHours = sanitizeArray(
    toolInternalHours,
    strategyCount,
    0,
    500
  );
  const sanitizedResponseInternalHours = sanitizeArray(
    responseInternalHours,
    responseCount,
    0,
    200
  );

  const normalizedBudgetData = {
    ...safeBudgetData,
    supplierCount: sanitizedSupplierCount,
    hourlyRate: sanitizedHourlyRate,
    totalExternalCost: Number.isFinite(safeBudgetData.totalExternalCost)
      ? safeBudgetData.totalExternalCost
      : 0,
    totalInternalCost: Number.isFinite(safeBudgetData.totalInternalCost)
      ? safeBudgetData.totalInternalCost
      : 0,
    totalBudget: Number.isFinite(safeBudgetData.totalBudget)
      ? safeBudgetData.totalBudget
      : 0,
    currentAllocation: Array.isArray(safeBudgetData.currentAllocation)
      ? safeBudgetData.currentAllocation
      : Array.isArray(hrddStrategy)
        ? [...hrddStrategy]
        : [],
    responseAllocation: Array.isArray(safeBudgetData.responseAllocation)
      ? safeBudgetData.responseAllocation
      : Array.isArray(responsivenessStrategy)
        ? [...responsivenessStrategy]
        : []
  };

  const totalExternalCost = normalizedBudgetData.totalExternalCost;
  const totalInternalCost = normalizedBudgetData.totalInternalCost;
  const totalBudget = normalizedBudgetData.totalBudget || totalExternalCost + totalInternalCost;
  const costPerSupplier = sanitizedSupplierCount > 0
    ? Math.round(totalBudget / sanitizedSupplierCount)
    : 0;
  const optimization = typeof optimizeBudgetAllocation === 'function'
    ? optimizeBudgetAllocation()
    : null;

  const rowCount = strategyCount;

  const inputGridTemplate = responsive('1fr', 'repeat(3, minmax(0, 1fr))');
  const inputGridGap = responsive('12px', '16px');

  const renderToolCard = (index) => {
    if (!Array.isArray(riskEngine?.hrddStrategyLabels) || index >= riskEngine.hrddStrategyLabels.length) {
      return `
        <div style="background: transparent; border-radius: 12px;"></div>
      `;
    }

    const label = riskEngine.hrddStrategyLabels[index];

    return `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${label}</div>
        <div style="display: grid; grid-template-columns: ${inputGridTemplate}; gap: ${inputGridGap}; align-items: stretch;">
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; font-weight: 500; color: #475569;">
            <span>Central program external costs (USD per year)</span>
            <input type="number"
                   id="toolAnnualCostNum_${index}"
                   min="0"
                   step="100"
                   value="${sanitizedToolAnnualProgrammeCosts[index] || 0}"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5f5; border-radius: 6px; font-size: 13px; text-align: right; background: white;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; font-weight: 500; color: #475569;">
            <span>Per Supplier external costs (USD per year)</span>
            <input type="number"
                   id="toolPerSupplierCostNum_${index}"
                   min="0"
                   step="10"
                   value="${sanitizedToolPerSupplierCosts[index] || 0}"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5f5; border-radius: 6px; font-size: 13px; text-align: right; background: white;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; font-weight: 500; color: #475569;">
            <span>Internal Work Hours (per supplier per year)</span>
            <input type="number"
                   id="toolInternalHoursNum_${index}"
                   min="0"
                   step="5"
                   value="${sanitizedToolInternalHours[index] || 0}"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5f5; border-radius: 6px; font-size: 13px; text-align: right; background: white;">
          </label>
        </div>
      </div>
    `;
  };

 const renderCostConfigurationRows = () => {
    if (rowCount === 0) {
      return '';
    }

    return Array.from({ length: rowCount }, (_, index) => `
      <div style="display: grid; grid-template-columns: 1fr; gap: ${responsive('12px', '24px')}; align-items: stretch;">
        ${renderToolCard(index)}
      </div>
    `).join('');
  };

  container.innerHTML = `
    <div class="cost-analysis-panel" style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

      <!-- Header Section -->
      <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
        <h2 style="font-size: ${responsive('18px', '20px')}; font-weight: bold; color: #1f2937; margin: 0;">Cost Analysis & Budget Optimization</h2>
        <div style="background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; display: grid; grid-template-columns: ${responsive('1fr', 'repeat(2, minmax(0, 1fr))')}; gap: 16px; align-items: stretch;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: #166534;">Number of Suppliers</label>
            <input type="number"
                   id="supplierCountInput"
                   value="${sanitizedSupplierCount}"
                   min="1"
                   step="1"
                   style="width: 100%; padding: 10px 12px; border: 1px solid #86efac; border-radius: 8px; font-size: 14px; text-align: right; background: white; color: #064e3b;">
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: #166534;">Internal cost per work hour (USD)</label>
            <input type="number"
                   id="hourlyRateInput"
                   value="${sanitizedHourlyRate}"
                   min="0"
                   step="0.01"
                   style="width: 100%; padding: 10px 12px; border: 1px solid #86efac; border-radius: 8px; font-size: 14px; text-align: right; background: white; color: #064e3b;">
          </div>
        </div>
      </div>

     <!-- Cost Configuration -->
      <div style="display: flex; flex-direction: column; gap: ${responsive('16px', '20px')}; margin-bottom: 32px;">
        <div style="display: grid; grid-template-columns: 1fr; gap: ${responsive('12px', '24px')}; align-items: stretch;">
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
              <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0;">Panel 3: HRDD Strategy Tools</h3>
              <button id="resetToolCosts" style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                Reset to Default
              </button>
            </div>
            <div style="font-size: 12px; color: #475569;">Configure costs for each due diligence tool</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: ${responsive('12px', '16px')};">
          ${renderCostConfigurationRows()}
        </div>
      </div>

      <!-- Panel 4 Response Methods Column -->
      <div style="background: #fef3c7; padding: 20px; border-radius: 12px; border: 1px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0;">Panel 4: Response Methods</h3>
            <button id="resetResponseCosts" style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
              Reset to Default
            </button>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">Configure internal effort for each response method</div>

          <div id="responseCostControls" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #374151;">
              <thead>
                <tr style="background: #fde68a; text-align: left;">
                  <th style="padding: 10px 12px; font-weight: 600; color: #1f2937;">Response Method</th>
                  <th style="padding: 10px 12px; font-weight: 600; color: #1f2937; text-align: right;">Internal Work Hours (per supplier per year)</th>
                </tr>
              </thead>
              <tbody>
                ${riskEngine.responsivenessLabels.map((label, index) => `
                  <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#fffbeb'};">
                    <td style="padding: 10px 12px; font-weight: 500;">${label}</td>
                    <td style="padding: 10px 12px; text-align: right;">
                      <input type="number"
                             id="responseInternalHoursNum_${index}"
                             min="0"
                             step="5"
                             value="${sanitizedResponseInternalHours[index] || 0}"
                             style="width: 110px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; text-align: right;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Budget Summary -->
      <div id="budgetSummary" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 20px; border-radius: 12px; border: 1px solid #bae6fd; margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0c4a6e; margin: 0 0 16px 0;">Annual Budget Summary</h3>
        <div style="display: grid; grid-template-columns: ${responsive('1fr', 'repeat(4, 1fr)')}; gap: 16px; text-align: center;">
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0f2fe;">
            <div style="font-size: 12px; color: #0369a1; margin-bottom: 4px;">EXTERNAL COSTS</div>
            <div style="font-size: 20px; font-weight: bold; color: #0c4a6e;">$${totalExternalCost.toLocaleString()}</div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0f2fe;">
            <div style="font-size: 12px; color: #0369a1; margin-bottom: 4px;">INTERNAL COSTS</div>
            <div style="font-size: 20px; font-weight: bold; color: #0c4a6e;">$${totalInternalCost.toLocaleString()}</div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0f2fe;">
            <div style="font-size: 12px; color: #0369a1; margin-bottom: 4px;">TOTAL BUDGET</div>
            <div style="font-size: 20px; font-weight: bold; color: #0c4a6e;">$${totalBudget.toLocaleString()}</div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0f2fe;">
            <div style="font-size: 12px; color: #0369a1; margin-bottom: 4px;">COST PER SUPPLIER</div>
            <div style="font-size: 20px; font-weight: bold; color: #0c4a6e;">$${costPerSupplier.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <!-- Optimization Analysis -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 24px;">
        <div style="display: flex; flex-direction: ${responsive('column', 'row')}; justify-content: space-between; align-items: ${responsive('flex-start', 'center')}; gap: 12px; margin-bottom: 16px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #14532d; margin: 0;">Budget Optimization Analysis</h3>
          <div style="display: flex; flex-direction: ${responsive('column', 'row')}; align-items: ${responsive('flex-start', 'center')}; gap: 12px;">
            <label for="saqConstraintToggle" title="When enabled, ensures combined coverage of 'Supplier SAQ with Evidence' and 'Supplier SAQ without Evidence' totals exactly 100% of suppliers" style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; color: #166534; cursor: pointer; background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px;">
              <input type="checkbox" id="saqConstraintToggle" ${enforceSAQConstraint ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #16a34a;">
              <span style="font-weight: 600;">Enforce 100% SAQ Coverage (Tools 5+6)</span>
            </label>
            <p style="margin: 0; font-size: 12px; color: #14532d; max-width: 360px;">
              The checkbox to enforce 100% SAQ coverage enables you to require all suppliers complete a questionnaire. This is good practice. It enables compliance to start with the supplier confirming it has implemented your policies and procedures; remedy can then be based on requiring the supplier to do what it has already agreed to do.
            </p>
            <button id="runOptimization" style="padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">
              Run Optimization
            </button>
          </div>
        </div>

        <div id="optimizationResults">
          ${renderOptimizationResults(optimization, normalizedBudgetData, baselineRisk, managedRisk)}
        </div>
      </div>

      <!-- Detailed Budget Breakdown -->
      ${renderDetailedBudgetBreakdown(
          normalizedBudgetData,
          optimization,
          sanitizedSupplierCount,
          sanitizedHourlyRate,
          sanitizedToolAnnualProgrammeCosts,
          sanitizedToolPerSupplierCosts,
          sanitizedToolInternalHours,
          sanitizedResponseInternalHours
        )}
      </div>

      <!-- Risk Transformation Comparison -->
      <div id="riskTransformationComparison">
        ${renderRiskTransformationComparison(
          optimization,
          normalizedBudgetData,
          baselineRisk,
          managedRisk,
          selectedCountries,
          countryVolumes,
          countryRisks,
          hrddStrategy,
          transparencyEffectiveness,
          responsivenessStrategy,
          responsivenessEffectiveness,
          focus
        )}
      </div>

    </div>
  `;

  // Set up event listeners
  setupCostAnalysisEventListeners({
    onSupplierCountChange,
    onHourlyRateChange,
    onToolAnnualProgrammeCostChange,
    onToolPerSupplierCostChange,
    onToolInternalHoursChange,
    onResponseInternalHoursChange,
    optimizeBudgetAllocation,
    onSAQConstraintChange,
    saqConstraintEnabled: enforceSAQConstraint,
    toolAnnualProgrammeCosts: sanitizedToolAnnualProgrammeCosts,
    toolPerSupplierCosts: sanitizedToolPerSupplierCosts,
    toolInternalHours: sanitizedToolInternalHours,
    responseInternalHours: sanitizedResponseInternalHours,
    supplierCount: sanitizedSupplierCount,
    hourlyRate: sanitizedHourlyRate,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    selectedCountries,
    countryVolumes,
    countryRisks,
    focus,
    baselineRisk,
    managedRisk,
    budgetData: normalizedBudgetData
  });
}

function renderOptimizationResults(optimization, budgetData, baselineRisk, managedRisk) {
  if (!optimization) {
    return `
      <div style="text-align: center; padding: 20px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <p>Click "Run Optimization" to see how to improve your risk reduction per dollar spent</p>
        <div style="margin-top: 12px; font-size: 12px; color: #9ca3af;">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #ef4444;"></div>
            <span>Not optimized with current settings</span>
          </div>
        </div>
      </div>
    `;
  }

  const safeBudgetData = budgetData || {};
  const currentAllocation = Array.isArray(safeBudgetData.currentAllocation)
    ? safeBudgetData.currentAllocation
    : [];

  const optimizedToolAllocation = Array.isArray(optimization?.optimizedToolAllocation)
    ? optimization.optimizedToolAllocation
    : Array.isArray(optimization?.optimizedAllocation)
      ? optimization.optimizedAllocation
      : [];

  const mobile = isMobileView();
  const responsive = (mobileValue, desktopValue) => (mobile ? mobileValue : desktopValue);

  const saqConstraintEnforced = Boolean(optimization?.saqConstraintEnforced);

  const normalizeRiskValue = (value, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const currentBaselineRisk = normalizeRiskValue(
    baselineRisk,
    normalizeRiskValue(optimization?.baselineRisk, 1)
  );

  const currentManagedRisk = normalizeRiskValue(
    managedRisk,
    normalizeRiskValue(optimization?.currentManagedRisk, 0)
  );

  const optimizedBaselineRisk = normalizeRiskValue(optimization?.baselineRisk, currentBaselineRisk);
  const optimizedManagedRisk = normalizeRiskValue(optimization?.optimizedManagedRisk, currentManagedRisk);

  const calculateEffectiveness = (baseline, managed) =>
    baseline !== 0 ? ((baseline - managed) / baseline) * 100 : 0;

  const currentEffectivenessValue = calculateEffectiveness(currentBaselineRisk, currentManagedRisk);
  const optimizedEffectivenessValue = calculateEffectiveness(optimizedBaselineRisk, optimizedManagedRisk);

  const formatPercent = value => (Number.isFinite(value) ? value.toFixed(1) : '0.0');

  const currentEffectiveness = formatPercent(currentEffectivenessValue);
  const optimizedEffectiveness = formatPercent(optimizedEffectivenessValue);
  const improvementValue = Number(
    formatPercent(optimizedEffectivenessValue - currentEffectivenessValue)
  );
  const improvementDisplay = Number.isFinite(improvementValue)
    ? Math.abs(improvementValue).toFixed(1)
    : '0.0';

  const improvementColor = improvementValue > 0 ? '#22c55e' : improvementValue < 0 ? '#ef4444' : '#6b7280';
  const improvementLabel = improvementValue > 0 ? 'Improvement' : improvementValue < 0 ? 'Decrease' : 'No Change';
  const currentColor = '#2563eb';
  const optimizedColor = '#16a34a';

  const normalizeCurrencyValue = (value, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const currentTotalBudget = Math.max(
    0,
    Math.round(
      normalizeCurrencyValue(
        budgetData?.totalBudget,
        normalizeCurrencyValue(optimization?.targetBudget, 0)
      )
    )
  );

  const optimizedTotalBudget = Math.max(
    0,
    Math.round(normalizeCurrencyValue(optimization?.finalBudget, currentTotalBudget))
  );

  const optimizationStatus = optimization.alreadyOptimized
    ? { color: '#22c55e', text: 'Previously optimized', icon: '✓' }
    : optimization.optimizationRun
      ? { color: '#3b82f6', text: 'Newly optimized', icon: '🔄' }
      : { color: '#ef4444', text: 'Not optimized', icon: '○' };

return `
    <div style="display: flex; flex-direction: column; gap: ${responsive('16px', '20px')};">

     <div style="background: ${optimizationStatus.color}15; border: 1px solid ${optimizationStatus.color}40; border-radius: 12px; padding: ${responsive('12px', '16px')}; text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: ${optimizationStatus.color};">
          <span>${optimizationStatus.icon}</span>
          <span>${optimizationStatus.text}${optimization.reOptimizationAttempted ? ' (Previous results retained)' : ''}</span>
        </div>
      </div>

      ${saqConstraintEnforced
        ? `<div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: ${responsive('10px', '12px')}; color: #3730a3; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🛡️</span>
            <span style="font-size: ${responsive('12px', '13px')}; font-weight: 500;">SAQ coverage constraint enforced: SAQ tools 5 and 6 total exactly 100%.</span>
          </div>`
        : ''}

      <div style="background: #fef3c7; padding: ${responsive('12px', '16px')}; border-radius: 8px; border: 1px solid #f59e0b;">
        <div style="font-size: 13px; color: #92400e;">
          <strong>Budget Optimization Insight:</strong>
          ${optimization.insight || 'The optimization suggests focusing more resources on higher-effectiveness tools while maintaining the same total budget.'}
        </div>
      </div>

      <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08); border-top: 4px solid #3b82f6;">
        <h4 style="font-size: ${responsive('16px', '18px')}; font-weight: 600; color: #1f2937; margin: 0 0 ${responsive('16px', '20px')} 0; text-align: center;">Effectiveness Comparison</h4>
        <div style="display: grid; grid-template-columns: ${responsive('1fr', 'repeat(3, minmax(0, 1fr))')}; gap: ${responsive('12px', '16px')}; align-items: stretch;">
          <div style="padding: ${responsive('14px', '20px')}; border-radius: 12px; border: 3px solid ${currentColor}; background-color: ${currentColor}15; text-align: center;">
            <div style="font-size: ${responsive('11px', '12px')}; font-weight: 600; color: #4b5563; margin-bottom: 6px;">CURRENT SETUP</div>
            <div style="font-size: ${responsive('32px', '40px')}; font-weight: bold; color: ${currentColor}; margin-bottom: 6px;">${currentEffectiveness}%</div>
            <div style="font-size: ${responsive('12px', '14px')}; font-weight: 600; color: ${currentColor};">Risk Reduction</div>
            <div style="font-size: ${responsive('11px', '12px')}; color: #4b5563; margin-top: 6px;">Current programme performance</div>
          </div>

          <div style="padding: ${responsive('14px', '20px')}; border-radius: 12px; border: 3px solid ${optimizedColor}; background-color: ${optimizedColor}15; text-align: center;">
            <div style="font-size: ${responsive('11px', '12px')}; font-weight: 600; color: #4b5563; margin-bottom: 6px;">OPTIMIZED SETUP</div>
            <div style="font-size: ${responsive('32px', '40px')}; font-weight: bold; color: ${optimizedColor}; margin-bottom: 6px;">${optimizedEffectiveness}%</div>
            <div style="font-size: ${responsive('12px', '14px')}; font-weight: 600; color: ${optimizedColor};">Risk Reduction</div>
            <div style="font-size: ${responsive('11px', '12px')}; color: #4b5563; margin-top: 6px;">Projected after optimization</div>
          </div>

          <div style="padding: ${responsive('14px', '20px')}; border-radius: 12px; border: 3px solid ${improvementColor}; background-color: ${improvementColor}15; text-align: center;">
            <div style="font-size: ${responsive('11px', '12px')}; font-weight: 600; color: #4b5563; margin-bottom: 6px;">IMPACT</div>
            <div style="font-size: ${responsive('32px', '40px')}; font-weight: bold; color: ${improvementColor}; margin-bottom: 6px;">${improvementValue > 0 ? '+' : improvementValue < 0 ? '-' : ''}${improvementDisplay}%</div>
            <div style="font-size: ${responsive('12px', '14px')}; font-weight: 600; color: ${improvementColor};">${improvementLabel}</div>
             <div style="font-size: ${responsive('11px', '12px')}; color: #4b5563; margin-top: 6px;">Difference vs current setup</div>
          </div>
        </div>
        <div style="margin-top: ${responsive('12px', '16px')}; display: grid; grid-template-columns: ${responsive('1fr', '1fr 1fr')}; gap: ${responsive('12px', '16px')};">
          <div style="background: white; padding: ${responsive('14px', '16px')}; border-radius: 8px; border: 2px solid #dc2626; text-align: center; color: #991b1b;">
            <div style="font-size: 12px; margin-bottom: 4px;">CURRENT TOTAL BUDGET</div>
            <div style="font-size: ${responsive('18px', '20px')}; font-weight: bold;">$${currentTotalBudget.toLocaleString()}</div>
          </div>
          <div style="background: white; padding: ${responsive('14px', '16px')}; border-radius: 8px; border: 2px solid #16a34a; text-align: center; color: #14532d;">
            <div style="font-size: 12px; margin-bottom: 4px;">OPTIMIZED TOTAL BUDGET</div>
            <div style="font-size: ${responsive('18px', '20px')}; font-weight: bold;">$${optimizedTotalBudget.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; border: 1px solid #d1fae5; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <h4 style="font-size: 14px; font-weight: 600; color: #14532d; margin: 0 0 12px 0;">Recommended Tool Allocation</h4>
        <div style="max-height: ${responsive('220px', '260px')}; overflow-y: auto;">
          ${riskEngine.hrddStrategyLabels.map((label, index) => {
            const current = currentAllocation[index] || 0;
            const optimized = optimizedToolAllocation[index] || 0;
            const change = optimized - current;
            const changeColor = change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#6b7280';
            const changeSign = change > 0 ? '+' : '';
            return `
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; gap: 8px;">
                <span style="flex: 1; color: #374151; white-space: normal; word-break: break-word;">${label}</span>
                <span style="color: #6b7280; margin: 0 8px;">${current.toFixed(0)}%</span>
                <span style="color: #16a34a;">→ ${optimized.toFixed(0)}%</span>
                <span style="color: ${changeColor}; margin-left: 8px; min-width: 40px; text-align: right;">${changeSign}${change.toFixed(0)}%</span>
              </div>
            `;
          }).join('')}
        </div>
       </div>
    </div>
  `;
}

function setupCostAnalysisEventListeners(handlers) {
  const {
    onSupplierCountChange,
    onHourlyRateChange,
    onToolAnnualProgrammeCostChange,
    onToolPerSupplierCostChange,
    onToolInternalHoursChange,
    onResponseInternalHoursChange,
    optimizeBudgetAllocation,
    onSAQConstraintChange,
    saqConstraintEnabled,
    toolAnnualProgrammeCosts,
    toolPerSupplierCosts,
    toolInternalHours,
    responseInternalHours,
    supplierCount,
    hourlyRate,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    selectedCountries,
    countryVolumes,
    countryRisks,
    focus,
    baselineRisk,
    managedRisk,
    budgetData
  } = handlers;

  const clampNumber = (value, min, max, fallback = 0) => {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const lowerBound = Math.max(min, numeric);
    return Number.isFinite(max) ? Math.min(max, lowerBound) : lowerBound;
  };

  const readInputValue = (id, min, max, fallback = 0) => {
    const element = document.getElementById(id);
    return clampNumber(element ? element.value : undefined, min, max, fallback);
  };

  const readArrayValues = (idPrefix, length, min, max, fallbackArray = []) => {
    return Array.from({ length }, (_, index) => {
      const element = document.getElementById(`${idPrefix}${index}`);
      const fallback = fallbackArray[index] || 0;
      return clampNumber(element ? element.value : undefined, min, max, fallback);
    });
  };

  const supplierInput = document.getElementById('supplierCountInput');
  if (supplierInput) {
    supplierInput.addEventListener('input', event => {
      onSupplierCountChange(event.target.value);
    });
  }

  const rateInput = document.getElementById('hourlyRateInput');
  if (rateInput) {
    rateInput.addEventListener('input', event => {
      onHourlyRateChange(event.target.value);
    });
  }

  toolAnnualProgrammeCosts.forEach((cost, index) => {
    const numberInput = document.getElementById(`toolAnnualCostNum_${index}`);
    if (numberInput) {
      numberInput.addEventListener('input', event => {
        const newValue = Math.min(50000, Math.max(0, parseFloat(event.target.value) || 0));
        numberInput.value = newValue;
        onToolAnnualProgrammeCostChange(index, newValue);
      });
    }
  });

  toolPerSupplierCosts.forEach((cost, index) => {
    const numberInput = document.getElementById(`toolPerSupplierCostNum_${index}`);
    if (numberInput) {
      numberInput.addEventListener('input', event => {
        const newValue = Math.min(2000, Math.max(0, parseFloat(event.target.value) || 0));
        numberInput.value = newValue;
        onToolPerSupplierCostChange(index, newValue);
      });
    }
  });

  toolInternalHours.forEach((hours, index) => {
    const numberInput = document.getElementById(`toolInternalHoursNum_${index}`);
    if (numberInput) {
      numberInput.addEventListener('input', event => {
        const newValue = Math.min(500, Math.max(0, parseFloat(event.target.value) || 0));
        numberInput.value = newValue;
        onToolInternalHoursChange(index, newValue);
      });
    }
  });

  responseInternalHours.forEach((hours, index) => {
    const numberInput = document.getElementById(`responseInternalHoursNum_${index}`);
    if (numberInput) {
      numberInput.addEventListener('input', event => {
        const newValue = Math.min(200, Math.max(0, parseFloat(event.target.value) || 0));
        numberInput.value = newValue;
        onResponseInternalHoursChange(index, newValue);
      });
    }
  });

  const saqConstraintToggle = document.getElementById('saqConstraintToggle');
  if (saqConstraintToggle) {
    saqConstraintToggle.checked = Boolean(saqConstraintEnabled);
    saqConstraintToggle.addEventListener('change', event => {
      if (typeof onSAQConstraintChange === 'function') {
        onSAQConstraintChange(event.target.checked);
      }
    });
  }

  const resetToolCosts = document.getElementById('resetToolCosts');
  if (resetToolCosts) {
    resetToolCosts.addEventListener('click', () => {
      const defaults = typeof riskEngine?.getDefaultCostAssumptions === 'function'
        ? riskEngine.getDefaultCostAssumptions()
        : {};

      const {
        toolAnnualProgrammeCosts: defaultAnnualCosts = [],
        toolPerSupplierCosts: defaultPerSupplierCosts = [],
        toolInternalHours: defaultInternalHours = []
      } = defaults;

      const toolCount = Math.max(
        toolAnnualProgrammeCosts?.length || 0,
        toolPerSupplierCosts?.length || 0,
        toolInternalHours?.length || 0,
        defaultAnnualCosts.length,
        defaultPerSupplierCosts.length,
        defaultInternalHours.length
      );

      for (let index = 0; index < toolCount; index += 1) {
        const annualDefault = Number.isFinite(defaultAnnualCosts[index])
          ? Math.max(0, defaultAnnualCosts[index])
          : 0;
        const perSupplierDefault = Number.isFinite(defaultPerSupplierCosts[index])
          ? Math.max(0, defaultPerSupplierCosts[index])
          : 0;
        const internalHoursDefault = Number.isFinite(defaultInternalHours[index])
          ? Math.max(0, defaultInternalHours[index])
          : 0;

        onToolAnnualProgrammeCostChange(index, annualDefault);
        const annualField = document.getElementById(`toolAnnualCostNum_${index}`);
        if (annualField) annualField.value = annualDefault;

        onToolPerSupplierCostChange(index, perSupplierDefault);
        const perSupplierField = document.getElementById(`toolPerSupplierCostNum_${index}`);
        if (perSupplierField) perSupplierField.value = perSupplierDefault;

        onToolInternalHoursChange(index, internalHoursDefault);
        const hourField = document.getElementById(`toolInternalHoursNum_${index}`);
        if (hourField) hourField.value = internalHoursDefault;
      }
    });
  }

  const resetResponseCosts = document.getElementById('resetResponseCosts');
  if (resetResponseCosts) {
    resetResponseCosts.addEventListener('click', () => {
      const defaults = typeof riskEngine?.getDefaultCostAssumptions === 'function'
        ? riskEngine.getDefaultCostAssumptions()
        : {};

      const { responseInternalHours: defaultResponseHours = [] } = defaults;
      const responseCount = Math.max(
        responseInternalHours?.length || 0,
        defaultResponseHours.length
      );

      for (let index = 0; index < responseCount; index += 1) {
        const hoursDefault = Number.isFinite(defaultResponseHours[index])
          ? Math.max(0, defaultResponseHours[index])
          : 0;

        onResponseInternalHoursChange(index, hoursDefault);
        const hoursField = document.getElementById(`responseInternalHoursNum_${index}`);
        if (hoursField) hoursField.value = hoursDefault;
      }
    });
  }

  const optimizeBtn = document.getElementById('runOptimization');
  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', () => {
      if (typeof optimizeBudgetAllocation !== 'function') {
        return;
      }

      const originalText = optimizeBtn.textContent;
      optimizeBtn.disabled = true;
      optimizeBtn.textContent = 'Optimizing...';

      try {
        const latestSupplierCount = Math.max(
          1,
          Math.floor(readInputValue('supplierCountInput', 1, Number.POSITIVE_INFINITY, supplierCount))
        );
        const latestHourlyRate = readInputValue('hourlyRateInput', 0, Number.POSITIVE_INFINITY, hourlyRate);
        const latestAnnualProgrammeCosts = readArrayValues(
          'toolAnnualCostNum_',
          toolAnnualProgrammeCosts.length,
          0,
          50000,
          toolAnnualProgrammeCosts
        );
        const latestPerSupplierCosts = readArrayValues(
          'toolPerSupplierCostNum_',
          toolPerSupplierCosts.length,
          0,
          2000,
          toolPerSupplierCosts
        );
        const latestToolInternalHours = readArrayValues(
          'toolInternalHoursNum_',
          toolInternalHours.length,
          0,
          500,
          toolInternalHours
        );
        const latestResponseInternalHours = readArrayValues(
          'responseInternalHoursNum_',
          responseInternalHours.length,
          0,
          200,
          responseInternalHours
        );

        const latestOptimization = optimizeBudgetAllocation();
        const latestBudget = riskEngine.calculateBudgetAnalysis(
          latestSupplierCount,
          latestHourlyRate,
          latestAnnualProgrammeCosts,
          latestPerSupplierCosts,
          latestToolInternalHours,
          latestResponseInternalHours,
          hrddStrategy,
          transparencyEffectiveness,
          responsivenessStrategy,
          responsivenessEffectiveness,
          selectedCountries,
          countryVolumes,
          countryRisks,
          focus
        ) || budgetData;

        const optimizationContainer = document.getElementById('optimizationResults');
        if (optimizationContainer) {
          optimizationContainer.innerHTML = renderOptimizationResults(
            latestOptimization,
            latestBudget,
            baselineRisk,
            managedRisk
          );
        }

        const breakdownContainer = document.getElementById('detailedBudgetBreakdown');
        if (breakdownContainer) {
          breakdownContainer.innerHTML = renderDetailedBudgetBreakdown(
            latestBudget,
            latestOptimization,
            latestSupplierCount,
            latestHourlyRate,
            latestAnnualProgrammeCosts,
            latestPerSupplierCosts,
            latestToolInternalHours,
            latestResponseInternalHours
          );
        }

        const comparisonContainer = document.getElementById('riskTransformationComparison');
        if (comparisonContainer) {
          comparisonContainer.innerHTML = renderRiskTransformationComparison(
            latestOptimization,
            latestBudget,
            baselineRisk,
            managedRisk,
            selectedCountries,
            countryVolumes,
            countryRisks,
            hrddStrategy,
            transparencyEffectiveness,
            responsivenessStrategy,
            responsivenessEffectiveness,
            focus
          );
        }
      } finally {
        optimizeBtn.disabled = false;
        optimizeBtn.textContent = originalText;
      }
    });
  }
}



function renderDetailedBudgetBreakdown(
  budgetData,
  optimization,
  supplierCount,
  hourlyRate,
  toolAnnualProgrammeCosts,
  toolPerSupplierCosts,
  toolInternalHours,
  responseInternalHours
) {
  if (!optimization) return '';

  const safeBudgetData = budgetData || {};
  const currentAllocation = Array.isArray(safeBudgetData.currentAllocation)
    ? safeBudgetData.currentAllocation
    : [];
  const optimizedToolAllocation = Array.isArray(optimization?.optimizedToolAllocation)
    ? optimization.optimizedToolAllocation
    : Array.isArray(optimization?.optimizedAllocation)
      ? optimization.optimizedAllocation
      : [];
  const safeAnnualCosts = Array.isArray(toolAnnualProgrammeCosts)
    ? toolAnnualProgrammeCosts
    : [];
  const safePerSupplierCosts = Array.isArray(toolPerSupplierCosts)
    ? toolPerSupplierCosts
    : [];
  const safeInternalHours = Array.isArray(toolInternalHours)
    ? toolInternalHours
    : [];
  const responseCount = Array.isArray(riskEngine?.responsivenessLabels)
    ? riskEngine.responsivenessLabels.length
    : 0;
  const safeResponseHours = Array.from({ length: responseCount }, (_, index) => {
    const value = Array.isArray(responseInternalHours)
      ? responseInternalHours[index]
      : undefined;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const safeSupplierCount = Math.max(
    1,
    Math.floor(supplierCount || safeBudgetData.supplierCount || 1)
  );
  const safeHourlyRate = Math.max(
    0,
    parseFloat(hourlyRate || safeBudgetData.hourlyRate || 0)
  );

  const normalizeResponseAllocation = (allocation, fallback = []) => {
    return Array.from({ length: responseCount }, (_, index) => {
      const value = Array.isArray(allocation)
        ? allocation[index]
        : Array.isArray(fallback)
          ? fallback[index]
          : undefined;
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });
  };

  const currentResponseAllocation = normalizeResponseAllocation(
    Array.isArray(optimization?.currentResponseAllocation)
      ? optimization.currentResponseAllocation
      : safeBudgetData.responseAllocation
  );
  const optimizedResponseAllocation = normalizeResponseAllocation(
    Array.isArray(optimization?.optimizedResponseAllocation)
      ? optimization.optimizedResponseAllocation
      : currentResponseAllocation
  );

  const calculateResponseTotals = allocation => {
    return allocation.reduce(
      (acc, coverage, index) => {
        const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
        const suppliersUsingMethod = Math.ceil(safeSupplierCount * coverageRatio);
        const hoursPerSupplier = safeResponseHours[index] || 0;
        const totalHours = suppliersUsingMethod * hoursPerSupplier;
        const totalCost = totalHours * safeHourlyRate;

        return {
          totalHours: acc.totalHours + totalHours,
          totalCost: acc.totalCost + totalCost
        };
      },
      { totalHours: 0, totalCost: 0 }
    );
  };

  const currentResponseTotals = calculateResponseTotals(currentResponseAllocation);
  const optimizedResponseTotals = calculateResponseTotals(optimizedResponseAllocation);

  const mobile = isMobileView();
  const responsive = (mobileValue, desktopValue) => (mobile ? mobileValue : desktopValue);

  const currentBreakdown = riskEngine.hrddStrategyLabels.map((label, index) => {
    const coverage = currentAllocation[index] || 0;
    const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
    const suppliersUsingTool = Math.ceil(safeSupplierCount * coverageRatio);
    const annualProgrammeBase = safeAnnualCosts[index] || 0;
    const annualProgrammeCost = annualProgrammeBase * coverageRatio;
    const perSupplierCost = safePerSupplierCosts[index] || 0;
    const hoursPerTool = safeInternalHours[index] || 0;
    const totalExternalCost = annualProgrammeCost + suppliersUsingTool * perSupplierCost;
    const totalInternalCost = suppliersUsingTool * hoursPerTool * safeHourlyRate;

    return {
      name: label,
      coverage,
      suppliersUsingTool,
      totalExternalCost,
      totalInternalCost,
      totalCost: totalExternalCost + totalInternalCost
    };
  });

  const optimizedBreakdown = riskEngine.hrddStrategyLabels.map((label, index) => {
    const coverage = optimizedToolAllocation[index] || 0;
    const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
    const suppliersUsingTool = Math.ceil(safeSupplierCount * coverageRatio);
    const annualProgrammeBase = safeAnnualCosts[index] || 0;
    const annualProgrammeCost = annualProgrammeBase * coverageRatio;
    const perSupplierCost = safePerSupplierCosts[index] || 0;
    const hoursPerTool = safeInternalHours[index] || 0;
    const totalExternalCost = annualProgrammeCost + suppliersUsingTool * perSupplierCost;
    const totalInternalCost = suppliersUsingTool * hoursPerTool * safeHourlyRate;

    return {
      name: label,
      coverage,
      suppliersUsingTool,
      totalExternalCost,
      totalInternalCost,
      totalCost: totalExternalCost + totalInternalCost
    };
 });

  const currentToolTotal = currentBreakdown.reduce((sum, tool) => sum + tool.totalCost, 0);
  const optimizedToolTotal = optimizedBreakdown.reduce((sum, tool) => sum + tool.totalCost, 0);
  const currentTotal = Math.round(currentToolTotal + currentResponseTotals.totalCost);
  const optimizedTotal = Math.round(optimizedToolTotal + optimizedResponseTotals.totalCost);
  const budgetDelta = optimizedTotal - currentTotal;
  const combinedBreakdown = riskEngine.hrddStrategyLabels.map((label, index) => {
    const current = currentBreakdown[index];
    const optimized = optimizedBreakdown[index];
    const coverageChange = optimized.coverage - current.coverage;
    const costChange = optimized.totalCost - current.totalCost;

    return {
      current,
      optimized,
      coverageChange,
      costChange
    };
  });

  return `
    <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h3 style="font-size: ${responsive('16px', '18px')}; font-weight: 600; color: #1f2937; margin-bottom: 20px; text-align: center;">
        Detailed Budget Breakdown: Current vs Optimized
      </h3>

      <div style="display: flex; flex-direction: column; gap: ${responsive('16px', '20px')};">
        ${combinedBreakdown.map(({ current, optimized, coverageChange, costChange }) => `
          <div style="display: grid; grid-template-columns: ${responsive('1fr', '1fr 1fr')}; gap: ${responsive('12px', '16px')}; align-items: stretch;">
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); padding: ${responsive('14px', '18px')}; border-radius: 12px; border: 1px solid #fecaca; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: ${responsive('13px', '14px')}; font-weight: 600; color: #7f1d1d; flex: 1;">${current.name}</span>
                <span style="font-size: ${responsive('11px', '12px')}; color: #991b1b; background: #fecaca; padding: 2px 8px; border-radius: 12px;">${current.coverage.toFixed(0)}% coverage</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: ${responsive('11px', '12px')}; color: #7f1d1d;">
                <div>Suppliers: <strong>${current.suppliersUsingTool}</strong></div>
                <div>External: <strong>$${current.totalExternalCost.toLocaleString()}</strong></div>
                <div>Internal: <strong>$${current.totalInternalCost.toLocaleString()}</strong></div>
                <div>Total: <strong>$${current.totalCost.toLocaleString()}</strong></div>
              </div>
            </div>

            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%); padding: ${responsive('14px', '18px')}; border-radius: 12px; border: 1px solid #bbf7d0; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: ${responsive('13px', '14px')}; font-weight: 600; color: #14532d; flex: 1;">${optimized.name}</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: ${responsive('11px', '12px')}; color: #16a34a; background: #dcfce7; padding: 2px 8px; border-radius: 12px;">${optimized.coverage.toFixed(0)}% coverage</span>
                  ${Math.abs(coverageChange) > 0.5 ? `
                    <span style="font-size: ${responsive('10px', '11px')}; color: ${coverageChange > 0 ? '#16a34a' : '#dc2626'}; font-weight: 600;">
                      ${coverageChange > 0 ? '+' : ''}${coverageChange.toFixed(0)}%
                    </span>
                  ` : ''}
                </div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: ${responsive('11px', '12px')}; color: #14532d;">
                <div>Suppliers: <strong>${optimized.suppliersUsingTool}</strong></div>
                <div>External: <strong>$${optimized.totalExternalCost.toLocaleString()}</strong></div>
                <div>Internal: <strong>$${optimized.totalInternalCost.toLocaleString()}</strong></div>
                <div>Total: <strong>$${optimized.totalCost.toLocaleString()}</strong></div>
              </div>
              ${Math.abs(costChange) > 10 ? `
                <div style="font-size: ${responsive('10px', '11px')}; color: ${costChange > 0 ? '#dc2626' : '#16a34a'}; text-align: right;">
                  Cost change: ${costChange > 0 ? '+' : ''}$${Math.abs(costChange).toLocaleString()}
                </div>
              ` : ''}
     </div>
          </div>
        `).join('')}
      </div>

      <div style="display: grid; grid-template-columns: ${responsive('1fr', '1fr 1fr')}; gap: ${responsive('12px', '16px')}; margin-top: ${responsive('12px', '16px')};">
        <div style="background: #fff7ed; padding: ${responsive('14px', '16px')}; border-radius: 10px; border: 1px solid #fed7aa; color: #92400e;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Current Response Effort</div>
          <div style="font-size: ${responsive('14px', '16px')}; font-weight: 600;">${Math.round(currentResponseTotals.totalHours).toLocaleString()} hrs</div>
          <div style="font-size: ${responsive('12px', '13px')};">Internal Cost: <strong>$${Math.round(currentResponseTotals.totalCost).toLocaleString()}</strong></div>
        </div>
        <div style="background: #ecfdf5; padding: ${responsive('14px', '16px')}; border-radius: 10px; border: 1px solid #bbf7d0; color: #166534;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Optimized Response Effort</div>
          <div style="font-size: ${responsive('14px', '16px')}; font-weight: 600;">${Math.round(optimizedResponseTotals.totalHours).toLocaleString()} hrs</div>
          <div style="font-size: ${responsive('12px', '13px')};">Internal Cost: <strong>$${Math.round(optimizedResponseTotals.totalCost).toLocaleString()}</strong></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: ${responsive('1fr', '1fr 1fr')}; gap: ${responsive('12px', '16px')}; margin-top: ${responsive('16px', '20px')};">
        <div style="background: white; padding: ${responsive('14px', '16px')}; border-radius: 8px; border: 2px solid #dc2626; text-align: center; color: #991b1b;">
          <div style="font-size: 12px; margin-bottom: 4px;">CURRENT TOTAL BUDGET</div>
          <div style="font-size: 20px; font-weight: bold;">$${currentTotal.toLocaleString()}</div>
        </div>
        <div style="background: white; padding: ${responsive('14px', '16px')}; border-radius: 8px; border: 2px solid #16a34a; text-align: center; color: #14532d;">
          <div style="font-size: 12px; margin-bottom: 4px;">OPTIMIZED TOTAL BUDGET</div>
          <div style="font-size: 20px; font-weight: bold;">$${optimizedTotal.toLocaleString()}</div>
        </div>
      </div>
      <div style="margin-top: ${responsive('10px', '12px')}; text-align: center; font-size: ${responsive('12px', '13px')}; color: ${budgetDelta < 0 ? '#16a34a' : budgetDelta > 0 ? '#dc2626' : '#6b7280'};">
        <strong>Budget Delta:</strong> ${budgetDelta > 0 ? '+' : budgetDelta < 0 ? '-' : ''}$${Math.abs(budgetDelta).toLocaleString()} (${budgetDelta < 0 ? 'Reduction' : budgetDelta > 0 ? 'Increase' : 'No change'})
      </div>
    </div>
  `;
}

function renderRiskTransformationComparison(optimization, budgetData, baselineRisk, managedRisk, selectedCountries, countryVolumes, countryRisks, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus) {
  if (!optimization) return '';

  const mobile = isMobileView();
  const responsive = (mobileValue, desktopValue) => (mobile ? mobileValue : desktopValue);

  const optimizedToolAllocation = Array.isArray(optimization?.optimizedToolAllocation)
    ? optimization.optimizedToolAllocation
    : Array.isArray(optimization?.optimizedAllocation)
      ? optimization.optimizedAllocation
      : Array.isArray(hrddStrategy)
        ? [...hrddStrategy]
        : [];

  const optimizedResponseAllocation = Array.isArray(optimization?.optimizedResponseAllocation)
    ? optimization.optimizedResponseAllocation
    : Array.isArray(responsivenessStrategy)
      ? [...responsivenessStrategy]
      : [];

  // Calculate current risk transformation steps
  const currentTransformation = calculateRiskTransformationSteps(
    baselineRisk, managedRisk, hrddStrategy, transparencyEffectiveness,
    responsivenessStrategy, responsivenessEffectiveness, focus
  );

  // Calculate optimized risk transformation steps  
  const optimizedDetails = riskEngine.calculateManagedRiskDetails(
    selectedCountries, countryVolumes, countryRisks,
    optimizedToolAllocation, transparencyEffectiveness,
    optimizedResponseAllocation, responsivenessEffectiveness, focus
  );

  const optimizedTransformation = calculateRiskTransformationSteps(
    optimization.baselineRisk, optimization.optimizedManagedRisk, 
    optimizedToolAllocation, transparencyEffectiveness,
    optimizedResponseAllocation, responsivenessEffectiveness, focus
  );

  return `
    <div style="background: white; padding: ${responsive('16px', '24px')}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h3 style="font-size: ${responsive('16px', '18px')}; font-weight: 600; color: #1f2937; margin-bottom: 20px; text-align: center;">
        Risk Reduction Analysis: Current vs Optimized Strategy
      </h3>
      
      <div style="display: grid; grid-template-columns: ${responsive('1fr', '1fr 1fr')}; gap: 24px;">
        
        <!-- Current Strategy Column -->
        <div style="background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); padding: 20px; border-radius: 12px; border: 1px solid #fecaca;">
          <h4 style="font-size: 16px; font-weight: 600; color: #991b1b; margin: 0 0 16px 0; text-align: center;">
            Current Strategy Impact
          </h4>
          ${renderTransformationSteps(currentTransformation, '#991b1b', '#fecaca')}
          
          <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #dc2626; margin-top: 16px;">
            <div style="text-align: center;">
              <div style="font-size: 12px; color: #991b1b; margin-bottom: 4px;">CURRENT RISK REDUCTION</div>
              <div style="font-size: 20px; font-weight: bold; color: #991b1b;">
                ${((baselineRisk - managedRisk) / baselineRisk * 100).toFixed(1)}%
              </div>
              <div style="font-size: 11px; color: #7f1d1d;">
                ${(baselineRisk - managedRisk).toFixed(1)} point reduction
              </div>
            </div>
          </div>
        </div>

        <!-- Optimized Strategy Column -->
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%); padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0;">
          <h4 style="font-size: 16px; font-weight: 600; color: #14532d; margin: 0 0 16px 0; text-align: center;">
            Optimized Strategy Impact
          </h4>
          ${renderTransformationSteps(optimizedTransformation, '#14532d', '#bbf7d0')}
          
          <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #16a34a; margin-top: 16px;">
            <div style="text-align: center;">
              <div style="font-size: 12px; color: #14532d; margin-bottom: 4px;">OPTIMIZED RISK REDUCTION</div>
              <div style="font-size: 20px; font-weight: bold; color: #14532d;">
                ${((optimization.baselineRisk - optimization.optimizedManagedRisk) / optimization.baselineRisk * 100).toFixed(1)}%
              </div>
              <div style="font-size: 11px; color: #166534;">
                ${(optimization.baselineRisk - optimization.optimizedManagedRisk).toFixed(1)} point reduction
              </div>
              <div style="font-size: 11px; color: #16a34a; margin-top: 4px;">
                Improvement: +${(((optimization.baselineRisk - optimization.optimizedManagedRisk) / optimization.baselineRisk * 100) - ((baselineRisk - managedRisk) / baselineRisk * 100)).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function calculateRiskTransformationSteps(baselineRisk, managedRisk, strategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus) {
  // Calculate transparency effectiveness
  const overallTransparency = riskEngine.calculateOriginalTransparencyEffectiveness(strategy, transparencyEffectiveness);
  
  // Calculate responsiveness effectiveness
  const overallResponsiveness = riskEngine.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);
  
  // Calculate focus multiplier (simplified portfolio version)
  const focusMultiplier = riskEngine.calculatePortfolioFocusMultiplier(focus, 1.2); // Assume some concentration
  
  // Calculate intermediate steps
  const totalReduction = baselineRisk - managedRisk;
  const baseReduction = focusMultiplier > 0 ? totalReduction / focusMultiplier : 0;
  const focusStageReduction = totalReduction - baseReduction;
  
  const detectionWeight = (overallTransparency + overallResponsiveness) > 0 
    ? overallTransparency / (overallTransparency + overallResponsiveness) 
    : 0.5;
  
  const detectionStageReduction = baseReduction * detectionWeight;
  const responseStageReduction = baseReduction - detectionStageReduction;
  
  const riskAfterDetection = baselineRisk - detectionStageReduction;
  const riskAfterResponse = riskAfterDetection - responseStageReduction;
  
  return {
    baseline: baselineRisk,
    afterDetection: riskAfterDetection,
    afterResponse: riskAfterResponse,
    final: managedRisk,
    detectionReduction: detectionStageReduction,
    responseReduction: responseStageReduction,
    focusReduction: focusStageReduction,
    transparencyPct: (overallTransparency * 100).toFixed(0),
    responsivenessPct: (overallResponsiveness * 100).toFixed(0),
    focusMultiplier: focusMultiplier.toFixed(2)
  };
}

function renderTransformationSteps(transformation, primaryColor, lightColor) {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      
      <!-- Step 1: Starting Point -->
      <div style="display: flex; align-items: center; padding: 12px; border-radius: 8px; background-color: white; border: 1px solid ${lightColor};">
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; font-size: 12px;">1</div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 600; color: ${primaryColor}; margin-bottom: 2px;">Baseline Portfolio Risk</div>
          <div style="font-size: 18px; font-weight: bold; color: ${primaryColor};">${transformation.baseline.toFixed(1)}</div>
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; color: #6b7280;">
        <div style="font-size: 16px;">↓</div>
        <div style="font-size: 10px;">Detection (${transformation.transparencyPct}%)</div>
      </div>

      <!-- Step 2: After Detection -->
      <div style="display: flex; align-items: center; padding: 12px; border-radius: 8px; background-color: white; border: 1px solid ${lightColor};">
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; font-size: 12px;">2</div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 600; color: ${primaryColor}; margin-bottom: 2px;">After Detection</div>
          <div style="font-size: 18px; font-weight: bold; color: ${primaryColor};">${transformation.afterDetection.toFixed(1)}</div>
          <div style="font-size: 10px; color: ${primaryColor};">-${Math.abs(transformation.detectionReduction).toFixed(1)} pts</div>
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; color: #6b7280;">
        <div style="font-size: 16px;">↓</div>
        <div style="font-size: 10px;">Response (${transformation.responsivenessPct}%)</div>
      </div>

      <!-- Step 3: After Response -->
      <div style="display: flex; align-items: center; padding: 12px; border-radius: 8px; background-color: white; border: 1px solid ${lightColor};">
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; font-size: 12px;">3</div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 600; color: ${primaryColor}; margin-bottom: 2px;">After Response</div>
          <div style="font-size: 18px; font-weight: bold; color: ${primaryColor};">${transformation.afterResponse.toFixed(1)}</div>
          <div style="font-size: 10px; color: ${primaryColor};">-${Math.abs(transformation.responseReduction).toFixed(1)} pts</div>
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; color: #6b7280;">
        <div style="font-size: 16px;">↓</div>
        <div style="font-size: 10px;">Focus (${transformation.focusMultiplier}×)</div>
      </div>

      <!-- Step 4: Final Result -->
      <div style="display: flex; align-items: center; padding: 12px; border-radius: 8px; background-color: white; border: 2px solid ${primaryColor};">
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; font-size: 12px;">4</div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 600; color: ${primaryColor}; margin-bottom: 2px;">Final Managed Risk</div>
          <div style="font-size: 18px; font-weight: bold; color: ${primaryColor};">${transformation.final.toFixed(1)}</div>
          <div style="font-size: 10px; color: ${primaryColor};">-${Math.abs(transformation.focusReduction).toFixed(1)} pts</div>
        </div>
      </div>
    </div>
  `;
}
