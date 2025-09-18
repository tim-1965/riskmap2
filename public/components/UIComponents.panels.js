import { riskEngine } from './RiskEngine.js';

let panel3ResizeListenerAttached = false;

function describeFocusLevel(value) {
  if (value >= 0.9) return 'Active monitoring only for crisis situations.';
  if (value >= 0.7) return 'Only high risk suppliers are actively monitored.';
  if (value >= 0.4) return 'Active monitoring for medium and high risk suppliers.';
  if (value >= 0.1) return 'Most suppliers are actively monitored.';
  return 'Even portfolio coverage';
}

function alignPanel3Rows() {
  if (typeof document === 'undefined') return;

  const strategyContainer = document.getElementById('strategyContainer');
  const transparencyContainer = document.getElementById('transparencyContainer');
  if (!strategyContainer || !transparencyContainer) return;

  const strategyControls = strategyContainer.querySelectorAll('[data-strategy-index]');
  const transparencyControls = transparencyContainer.querySelectorAll('[data-transparency-index]');

  const totalControls = Math.max(strategyControls.length, transparencyControls.length);
  for (let i = 0; i < totalControls; i++) {
    if (strategyControls[i]) strategyControls[i].style.minHeight = '';
    if (transparencyControls[i]) transparencyControls[i].style.minHeight = '';
  }

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

export function createRiskComparisonPanel(containerId, { baselineRisk, managedRisk, selectedCountries }) {
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
    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-top: 4px solid #3b82f6;">
      <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: center; color: #1f2937;">
        Risk Assessment Summary
      </h2>

      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: stretch; margin-bottom: 20px;">
        <div style="padding: 24px; border-radius: 12px; border: 3px solid ${baselineColor}; background-color: ${baselineColor}15; text-align: center;">
          <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">BASELINE RISK</div>
          <div style="font-size: 48px; font-weight: bold; color: ${baselineColor}; margin-bottom: 8px;">
            ${baselineScore.toFixed(1)}
          </div>
          <div style="font-size: 16px; font-weight: 600; color: ${baselineColor};">
            ${baselineBand}
          </div>
        </div>

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

export function createHRDDStrategyPanel(containerId, { strategy, onStrategyChange, onFocusChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const strategyLabels = riskEngine.hrddStrategyLabels;
  const strategyDescriptions = [
    'Always-on digital or in-person worker voice capturing daily conditions.',
    'Structured all worker surveys undertaken at least annually.',
    'Surprise third-party social audits without advance warning.',
    'Planned or supplier-arranged social audits.',
    'Supplier self-reporting and self-assessment questionnaires.',
    'Desk-based risk assessment only with no direct engagement.'
  ];

  let localStrategy = [...strategy];
  const defaultFocusValue = typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6;

  const updateStrategy = () => {
    const total = localStrategy.reduce((sum, w) => sum + w, 0);
    const formattedTotal = Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    const totalElement = document.getElementById('totalStrategy');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
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

      <div style="font-size: 14px; color: #1f2937; padding: 12px; background-color: #eef2ff; border-radius: 6px; text-align: center;">
        Assumptions total: <span id="totalStrategy" style="font-weight: 600; font-size: 16px;">${Math.round(localStrategy.reduce((sum, w) => sum + w, 0) * 100) / 100}</span>
        <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">Each component is weighted by the value you give it divided by the total. It does not matter what the total adds up to.</span>
      </div>

      <div style="background-color: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; padding: 16px; border-radius: 8px; margin-top: 20px;">
        <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Strategy Guide:</h4>
        <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
          <li>Higher percentages = more resources allocated to that monitoring tool.</li>
          <li>Combine approaches to mirror your actual HRDD portfolio.</li>
          <li>Each tool carries an evidence-based transparency assumption (Step 2B).</li>
        </ul>
      </div>
    </div>
  `;

  const strategyContainer = document.getElementById('strategyContainer');
  strategyLabels.forEach((label, index) => {
    const strategyControl = document.createElement('div');
    strategyControl.dataset.strategyIndex = index;
    strategyControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa; display: flex; flex-direction: column; gap: 12px;';
    strategyControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151;">
        ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; font-style: italic;">
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
    const updateStrategyValue = (value) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
      localStrategy[index] = newValue;
      rangeInput.value = newValue;
      numberInput.value = newValue;
      updateStrategy();
    };

    rangeInput.addEventListener('input', (e) => updateStrategyValue(e.target.value));
    numberInput.addEventListener('input', (e) => updateStrategyValue(e.target.value));
  });

  const resetButton = document.getElementById('resetStrategy');
  resetButton.addEventListener('click', () => {
    localStrategy = [...riskEngine.defaultHRDDStrategy];
    localStrategy.forEach((weight, index) => {
      document.getElementById(`strategy_${index}`).value = weight;
      document.getElementById(`strategyNum_${index}`).value = weight;
    });
    updateStrategy();
    schedulePanel3Alignment();

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

export function createFocusPanel(containerId, { focus, onFocusChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const defaultFocusValue = typeof riskEngine.defaultFocus === 'number' ? riskEngine.defaultFocus : 0.6;
  let localFocus = typeof focus === 'number' ? focus : defaultFocusValue;

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
        <li><strong>0.00 – 0.10:</strong> Even effort across the portfolio.</li>
        <li><strong>0.10 – 0.30:</strong> Most suppliers are actively monitored.</li>
        <li><strong>0.40 – 0.60:</strong> Active monitoring for medium and high risk suppliers.</li>
        <li><strong>0.70 – 0.90:</strong> Only high risk suppliers are actively monitored.</li>
        <li><strong>0.90 – 1.00:</strong> Active monitoring only for crisis situations.</li>
      </ul>
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
    'Typically 0.80% – 0.95% of risks revealed (workers report escalation).',
    'Typically 0.30% – 0.40% of risks revealed (structured worker surveys).',
    'Typically 0.15% – 0.25% of risks revealed (credible surprise audits).',
    'Typically 0.10% – 0.15% of risks revealed (announced audits).',
    'Typically 0.05% – 0.15% of risks revealed (supplier self-reporting).',
    'Typically 0.01% – 0.05% of risks revealed (desk-based assessments).'
  ];

  let localTransparency = [...transparency];

  const updateTransparency = (options = {}) => {
    const total = localTransparency.reduce((sum, value) => sum + value, 0);
    const formattedTotal = Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    const totalElement = document.getElementById('totalTransparency');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
    }
    if (options.notify !== false && onTransparencyChange) {
      onTransparencyChange([...localTransparency]);
    }
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

      <div style="font-size: 14px; color: #1f2937; padding: 12px; background-color: #eef2ff; border-radius: 6px; text-align: center; margin-bottom: 20px;">
        Assumptions total: <span id="totalTransparency" style="font-weight: 600; font-size: 16px;">${Math.round(localTransparency.reduce((sum, value) => sum + value, 0) * 100) / 100}</span>
        <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">Each component is weighted by the value you give it divided by the total. It does not matter what the total adds up to.</span>
      </div>

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
    const transparencyControl = document.createElement('div');
    transparencyControl.dataset.transparencyIndex = index;
    transparencyControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa; display: flex; flex-direction: column; gap: 12px;';
    transparencyControl.innerHTML = `
      <label for="transparency_${index}" style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        <span style="display: inline-block; min-width: 0;">${label}</span>
      </label>
      <div style="font-size: 12px; color: #6b7280; font-style: italic;">
        ${effectivenessDescriptions[index]}
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <input type="range" min="0" max="100" value="${localTransparency[index]}" id="transparency_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
        <input type="number" min="0" max="100" value="${localTransparency[index]}" id="transparencyNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
      </div>
    `;
    transparencyContainer.appendChild(transparencyControl);

    const rangeInput = document.getElementById(`transparency_${index}`);
    const numberInput = document.getElementById(`transparencyNum_${index}`);
    const updateTransparencyValue = (value, options = {}) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));

      localTransparency[index] = newValue;
      rangeInput.value = newValue;
      numberInput.value = newValue;

      updateTransparency(options);
    };

    rangeInput.addEventListener('input', (e) => updateTransparencyValue(e.target.value, { notify: false }));
    rangeInput.addEventListener('change', (e) => updateTransparencyValue(e.target.value));
    numberInput.addEventListener('input', (e) => updateTransparencyValue(e.target.value, { notify: false }));
    numberInput.addEventListener('change', (e) => updateTransparencyValue(e.target.value));
  });

  ensurePanel3ResizeListener();
  schedulePanel3Alignment();

const resetButton = document.getElementById('resetTransparency');
  resetButton.addEventListener('click', () => {
    localTransparency = [...riskEngine.defaultTransparencyEffectiveness];
    localTransparency.forEach((effectiveness, index) => {
      document.getElementById(`transparency_${index}`).value = effectiveness;
      document.getElementById(`transparencyNum_${index}`).value = effectiveness;
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

   const updateResponsiveness = () => {
    const total = localResponsiveness.reduce((sum, w) => sum + w, 0);
    const formattedTotal = Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    const totalElement = document.getElementById('totalResponsiveness');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
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

       <div id="responsivenessContainer" style="margin-bottom: 20px;"></div>␊

      <div style="font-size: 14px; color: #1f2937; padding: 12px; background-color: #eef2ff; border-radius: 6px; text-align: center;">
        Assumptions total: <span id="totalResponsiveness" style="font-weight: 600; font-size: 16px;">${Math.round(localResponsiveness.reduce((sum, w) => sum + w, 0) * 100) / 100}</span>
        <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">Each component is weighted by the value you give it divided by the total. It does not matter what the total adds up to.</span>
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
        ${label}
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
    const updateResponsivenessValue = (value) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
      localResponsiveness[index] = newValue;
      rangeInput.value = newValue;
      numberInput.value = newValue;
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
    });
    updateResponsiveness();
  });
}

export function createResponsivenessEffectivenessPanel(containerId, { effectiveness, onEffectivenessChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const responsivenessLabels = riskEngine.responsivenessLabels;
  const effectivenessDescriptions = [
    '0.60 – 0.80 typical effectiveness as real-time data drives behaviour.',
    '0.70 – 0.90 typical effectiveness as improvements linked to orders.',
    '0.30 – 0.50 typical effectiveness via periodic review.',
    '0.20 – 0.30 typical effectiveness via training and education.',
    '0.10 – 0.20 typical effectiveness via holistic approach.',
    '0.10 – 0.20 typical effectiveness as strategy is reactive only.'
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

      <div style="font-size: 14px; color: #1f2937; padding: 12px; background-color: #eef2ff; border-radius: 6px; text-align: center; margin-bottom: 20px;">
        Assumptions total: <span id="totalResponsivenessEffectiveness" style="font-weight: 600; font-size: 16px;">${Math.round(localEffectiveness.reduce((sum, value) => sum + value, 0) * 100) / 100}</span>
        <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">Each component is weighted by the value you give it divided by the total. It does not matter what the total adds up to.</span>
      </div>
      <div style="background-color: #ecfeff; border: 1px solid #06b6d4; color: #0e7490; padding: 16px; border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 8px; color: #155e75;">Interpreting Effectiveness:</h4>
        <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
          <li>Higher percentages = more impactful remediation outcomes.</li>
          <li>Values reflect typical risk reduction delivered by each lever.</li>
          <li>Combining levers increases overall effectiveness.</li>
        </ul>
      </div>
    </div>
  `;

  const effectivenessContainer = document.getElementById('responsivenessEffectivenessContainer');
  responsivenessLabels.forEach((label, index) => {
    const effectivenessControl = document.createElement('div');
    effectivenessControl.style.cssText = 'margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;';
   effectivenessControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">
        ${effectivenessDescriptions[index]}
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <input type="range" min="0" max="100" value="${localEffectiveness[index]}" id="responsivenessEffectiveness_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
        <input type="number" min="0" max="100" value="${localEffectiveness[index]}" id="responsivenessEffectivenessNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
      </div>
    `;
    effectivenessContainer.appendChild(effectivenessControl);

    const rangeInput = document.getElementById(`responsivenessEffectiveness_${index}`);
    const numberInput = document.getElementById(`responsivenessEffectivenessNum_${index}`);
    const updateEffectivenessValue = (value) => {
      const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
      localEffectiveness[index] = newValue;
      rangeInput.value = newValue;
      numberInput.value = newValue;
      updateEffectiveness();
    };

    rangeInput.addEventListener('input', (e) => updateEffectivenessValue(e.target.value));
    numberInput.addEventListener('input', (e) => updateEffectivenessValue(e.target.value));
  });

  const resetButton = document.getElementById('resetResponsivenessEffectiveness');
  resetButton.addEventListener('click', () => {
    localEffectiveness = [...riskEngine.defaultResponsivenessEffectiveness];
    localEffectiveness.forEach((value, index) => {
      document.getElementById(`responsivenessEffectiveness_${index}`).value = value;
      document.getElementById(`responsivenessEffectivenessNum_${index}`).value = value;
    });
    updateEffectiveness();
  });
}

export function createFinalResultsPanel(containerId, { baselineRisk, managedRisk, selectedCountries, countries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus = 0, riskConcentration = 1 }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const summary = riskEngine.generateRiskSummary(baselineRisk, managedRisk, selectedCountries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy, responsivenessEffectiveness, focus, riskConcentration);
  const focusData = summary.strategy?.focus || { level: 0, portfolioMultiplier: 1, concentration: 1 };
  const focusPercent = Math.round((focusData.level || 0) * 100);
  const focusMultiplier = focusData.portfolioMultiplier || 1;
  const concentrationFactor = summary.portfolio?.riskConcentration ?? 1;

  container.innerHTML = `
    <div class="final-results-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
      <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Final Risk Assessment Results</h2>

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
          This baseline risk will be used in Panels 3-4 to configure HRDD strategies and
          in Panel 5 to calculate managed risk levels after implementing controls.
        </p>
      </div>
    </div>
  `;

  updateRiskBreakdown(selectedCountries, countries, countryRisks);
}

export function createWeightingsPanel(containerId, { weights, onWeightsChange }) {
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

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; color: #374151; padding: 16px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 500;">Total Weighting: <span id="totalWeights">${localWeights.reduce((sum, w) => sum + w, 0)}</span>%</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Suggested range: 100% (but can exceed to reflect emphasis)</div>
      </div>
    </div>
  `;

  const weightsContainer = document.getElementById('weightsContainer');
  weightLabels.forEach((label, index) => {
    const weightControl = document.createElement('div');
    weightControl.style.cssText = 'margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;';
    weightControl.innerHTML = `
      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">
        ${label}
      </label>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Adjust the weighting to reflect portfolio importance.</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <input type="range" min="0" max="100" value="${localWeights[index]}" id="weight_${index}" style="flex: 1; height: 8px; border-radius: 4px; background-color: #d1d5db;">
        <input type="number" min="0" max="100" value="${localWeights[index]}" id="weightNum_${index}" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
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
        <div style="font-size: 40px; margin-bottom: 12px;">🌐</div>
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
    const volume = countryVolumes[countryCode] ?? 1;

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