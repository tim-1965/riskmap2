// RiskEngine.js - Updated with Risk-Adjusted Coverage Distribution
export class RiskEngine {
  constructor() {
    // Step 1: Default weightings for the 5 input columns
    this.defaultWeights = [20, 20, 5, 10, 10]; // ITUC, Corruption, Migrant, WJP, Walkfree
    
    // Step 2: HRDD Strategy defaults - representing supplier base coverage percentages
    this.defaultHRDDStrategy = [5, 15, 25, 60, 80, 90]; // Coverage percentages: Worker voice is rare, passive approaches common
    this.defaultTransparencyEffectiveness = [90, 45, 25, 15, 12, 5]; // Research-backed base effectiveness rates

    // Step 3: Responsiveness Strategy defaults
    this.defaultResponsivenessStrategy = [10, 5, 20, 20, 10, 5]; // Portfolio of response levers from weakest to strongest
    this.defaultResponsivenessEffectiveness = [70, 85, 35, 25, 15, 5]; // Mid-point response effectiveness assumptions in percentages

    // Focus defaults for directing transparency/response capacity to higher-risk countries
    this.defaultFocus = 0.6;

    // Controls how aggressively focus re-weights coverage toward higher-risk countries
    this.focusBiasSettings = {
      minExponent: 1,
      maxExponent: 2.5,
      minRiskRatio: 0.1,
      maxRiskRatio: 3
    };

    // Controls how strongly portfolio concentration amplifies focus-driven effectiveness gains (lower is less amplifcation)
    this.focusConcentrationWeight = 2.75;

    // Strategy labels
    this.hrddStrategyLabels = [
      'Continuous Worker Voice',
      'Worker Surveys (annual)',
      'Unannounced Social Audits',
      'Announced Social Audits',
      'Supplier Self-Reporting',
      'Desk-Based Risk Assessment'
    ];

    this.responsivenessLabels = [
      'Suppliers see risks and remedy-impact in realtime',
      'Binding Commercial Levers',
      'Corrective Action Plans with quarterly follow-up',
      'Supplier Development Programmes',
      'Industry Collaboration & Agreements',
      'Follow up only on crisis situations'
    ];
    
    // Risk band definitions
    this.riskBands = {
      'Low': { min: 0, max: 19.99, color: '#22c55e' }, // Green
      'Medium': { min: 20, max: 39.99, color: '#eab308' }, // Yellow
      'Medium High': { min: 40, max: 59.99, color: '#f97316' }, // Orange
      'High': { min: 60, max: 79.99, color: '#ef4444' }, // Red
      'Very High': { min: 80, max: 100, color: '#991b1b' } // Dark Red
    };
  }

  getFocusExponent(focus = 0) {
    const safeFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const settings = this.focusBiasSettings || {};
    const minExp = Number.isFinite(settings.minExponent) ? settings.minExponent : 1;
    const maxExp = Number.isFinite(settings.maxExponent) ? Math.max(minExp, settings.maxExponent) : minExp;
    return minExp + safeFocus * (maxExp - minExp);
  }

  getBiasedRiskRatio(riskRatio, focus = 0) {
    const settings = this.focusBiasSettings || {};
    const maxRatio = Number.isFinite(settings.maxRiskRatio) && settings.maxRiskRatio > 0
      ? settings.maxRiskRatio
      : Infinity;
    const minRatio = Number.isFinite(settings.minRiskRatio) && settings.minRiskRatio >= 0
      ? settings.minRiskRatio
      : 0;

    const clampedRatio = Math.min(
      maxRatio,
      Math.max(0, Number.isFinite(riskRatio) ? riskRatio : 0)
    );

    const exponent = this.getFocusExponent(focus);
    const biasedRatio = Math.pow(clampedRatio, exponent);

    return Math.max(minRatio, biasedRatio);
  }

  getFocusWeight() {
    return Number.isFinite(this.focusConcentrationWeight)
      ? Math.max(0, Math.min(100, this.focusConcentrationWeight))
      : 0.5;
  }

  normalizeEffectivenessValue(value) {
    if (value === null || value === undefined) {
      return 0;
    }

    const numericValue = typeof value === 'string'
      ? parseFloat(value)
      : value;

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    if (numericValue <= 0) {
      return 0;
    }

    if (numericValue >= 1) {
      return Math.min(1, numericValue / 100);
    }

    return Math.max(0, numericValue);
  }

  // Step 1: Calculate weighted risk score for a country
  calculateWeightedRisk(countryData, weights = this.defaultWeights) {
    const values = [
      countryData.itucRightsRating,
      countryData.corruptionIndex,
      countryData.migrantWorkerPrevalence,
      countryData.wjpIndex,
      countryData.walkfreeSlaveryIndex
    ];

    let weightedSum = 0;
    let totalWeight = 0;

    // Only include values that are greater than 0 (ignore zero values)
    for (let i = 0; i < values.length; i++) {
      if (values[i] > 0) {
        weightedSum += values[i] * weights[i];
        totalWeight += weights[i];
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Step 1: Calculate portfolio risk metrics including baseline risk and concentration factor
  calculatePortfolioMetrics(selectedCountries, countryVolumes, countryRisks) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return {
        baselineRisk: 0,
        totalVolume: 0,
        weightedRisk: 0,
        weightedRiskSquares: 0,
        riskConcentration: 1
      };
    }

    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    const portfolioEntries = [];
    let totalVolumeRisk = 0;
    let totalVolume = 0;

    selectedCountries.forEach(countryCode => {
      const volume = typeof safeVolumes[countryCode] === 'number' ? safeVolumes[countryCode] : 10; // Default volume is 10
      const risk = typeof safeRisks[countryCode] === 'number' ? safeRisks[countryCode] : 0;

      totalVolumeRisk += volume * risk;
      totalVolume += volume;
      portfolioEntries.push({ countryCode, volume, risk });
    });

    const baselineRisk = totalVolume > 0 ? totalVolumeRisk / totalVolume : 0;

    let weightedRiskSquares = 0;
    if (totalVolume > 0) {
      portfolioEntries.forEach(entry => {
        const share = entry.volume / totalVolume;
        weightedRiskSquares += share * Math.pow(entry.risk || 0, 2);
      });
    }

    const riskConcentration = baselineRisk > 0 && weightedRiskSquares > 0
      ? Math.max(1, weightedRiskSquares / Math.pow(baselineRisk, 2))
      : 1;

    return {
      baselineRisk,
      totalVolume,
      weightedRisk: totalVolumeRisk,
      weightedRiskSquares,
      riskConcentration
    };
  }

  // Step 1: Calculate baseline risk for portfolio (sumproduct of volumes and risks)
  calculateBaselineRisk(selectedCountries, countryVolumes, countryRisks) {
    return this.calculatePortfolioMetrics(selectedCountries, countryVolumes, countryRisks).baselineRisk;
  }

  // NEW: Calculate risk-adjusted coverage distribution across countries
  calculateCountrySpecificCoverage(selectedCountries, countryVolumes, countryRisks, hrddStrategy, focus = 0.6) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return {};
    }

    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    const safeFocus = Math.max(0, Math.min(1, focus || 0));
    
    // Calculate portfolio metrics
    const portfolioMetrics = this.calculatePortfolioMetrics(selectedCountries, countryVolumes, countryRisks);
    const baselineRisk = portfolioMetrics.baselineRisk;
    const totalVolume = portfolioMetrics.totalVolume;
    
    if (totalVolume <= 0 || baselineRisk <= 0) {
      // If no volume or no risk, distribute evenly
      const evenCoverage = {};
      selectedCountries.forEach(countryCode => {
        evenCoverage[countryCode] = [...hrddStrategy];
      });
      return evenCoverage;
    }

    const countrySpecificCoverage = {};
    
    selectedCountries.forEach(countryCode => {
      const countryRisk = safeRisks[countryCode] || 0;
      const countryVolume = safeVolumes[countryCode] || 10;
      
      // Calculate risk adjustment factor
      // At focus=0: all countries get same coverage
      // At focus=1: coverage proportional to risk level
      const rawRiskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
      const biasedRiskRatio = this.getBiasedRiskRatio(rawRiskRatio, safeFocus);
      const riskAdjustmentFactor = (1 - safeFocus) + safeFocus * biasedRiskRatio;
      
      // Apply coverage adjustment with resource conservation
      const adjustedCoverage = hrddStrategy.map(toolCoverage => {
        const adjustedValue = Math.max(0, Math.min(100, toolCoverage * riskAdjustmentFactor));
        return adjustedValue;
      });
      
      countrySpecificCoverage[countryCode] = adjustedCoverage;
    });

    // Resource conservation: ensure total resource usage doesn't exceed available resources
    hrddStrategy.forEach((originalCoverage, toolIndex) => {
      let totalResourceUsage = 0;
      let totalWeightedVolume = 0;
      
      // Calculate total resource usage for this tool across all countries
      selectedCountries.forEach(countryCode => {
        const countryVolume = safeVolumes[countryCode] || 10;
        const countryCoverage = countrySpecificCoverage[countryCode][toolIndex];
        totalResourceUsage += (countryCoverage / 100) * countryVolume;
        totalWeightedVolume += countryVolume;
      });
      
      // Calculate expected resource usage if distributed evenly
      const expectedResourceUsage = (originalCoverage / 100) * totalWeightedVolume;
      
      // If we're over-allocated, scale down proportionally
      if (totalResourceUsage > expectedResourceUsage && totalResourceUsage > 0) {
        const scalingFactor = expectedResourceUsage / totalResourceUsage;
        selectedCountries.forEach(countryCode => {
          countrySpecificCoverage[countryCode][toolIndex] *= scalingFactor;
          countrySpecificCoverage[countryCode][toolIndex] = Math.max(0, Math.min(100, countrySpecificCoverage[countryCode][toolIndex]));
        });
      }
    });
    
    return countrySpecificCoverage;
  }

  // NEW: Calculate country-specific transparency using distributed coverage
  calculateCountryTransparencyEffectiveness(countrySpecificCoverage, transparencyEffectiveness, countryCode) {
    const countryCoverage = countrySpecificCoverage[countryCode];
    if (!countryCoverage || !Array.isArray(countryCoverage)) {
      return 0;
    }

    if (!this.validateHRDDStrategy(countryCoverage) || !this.validateTransparency(transparencyEffectiveness)) {
      return 0;
    }

    // Tool categories with their base effectiveness and interaction factors
    const toolCategories = [
      {
        name: 'Worker Voice',
        tools: [0, 1], // Continuous Worker Voice, Annual Surveys
        baseEffectiveness: [0.90, 0.45], // High effectiveness tools
        categoryWeight: 1.0
      },
      {
        name: 'Audit',
        tools: [2, 3], // Unannounced, Announced
        baseEffectiveness: [0.25, 0.15], // Medium effectiveness tools
        categoryWeight: 0.85
      },
      {
        name: 'Passive',
        tools: [4, 5], // Self-reporting, Desk-based
        baseEffectiveness: [0.12, 0.05], // Lower effectiveness tools
        categoryWeight: 0.70
      }
    ];

    const maxTransparency = 0.90; // 90% maximum achievable transparency
    let combinedTransparency = 0;

    // Calculate transparency for each category using country-specific coverage
    toolCategories.forEach(category => {
      let categoryTransparency = 0;
      let categoryProduct = 1;

      category.tools.forEach((toolIndex, i) => {
        const coverage = Math.max(0, Math.min(100, countryCoverage[toolIndex] || 0)) / 100; // Convert to 0-1
        const baseEff = category.baseEffectiveness[i];
        const userEff = Math.max(0, Math.min(100, transparencyEffectiveness[toolIndex] || 0)) / 100;
        
        // Use average of base and user effectiveness to allow customization but keep realistic bounds
        const effectiveRate = (baseEff + userEff) / 2;
        
        // Apply diminishing returns: 1 - (1 - coverage × effectiveness)
        categoryProduct *= (1 - coverage * effectiveRate);
      });

      categoryTransparency = 1 - categoryProduct;
      
      // Combine categories with their weights (reduces cross-category overlap)
      combinedTransparency = 1 - (1 - combinedTransparency) * (1 - categoryTransparency * category.categoryWeight);
    });

    // Apply maximum transparency cap
    return Math.min(combinedTransparency, maxTransparency);
  }

  // Updated: Calculate overall transparency effectiveness using country-specific coverage
  calculateTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness, selectedCountries = null, countryVolumes = null, countryRisks = null, focus = 0.6) {
    // If no country-specific data provided, use original method
    if (!selectedCountries || !countryVolumes || !countryRisks) {
      return this.calculateOriginalTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness);
    }

    // Calculate country-specific coverage distribution
    const countrySpecificCoverage = this.calculateCountrySpecificCoverage(
      selectedCountries, countryVolumes, countryRisks, hrddCoverage, focus
    );

    if (Object.keys(countrySpecificCoverage).length === 0) {
      return 0;
    }

    // Calculate volume-weighted average transparency across all countries
    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    let totalWeightedTransparency = 0;
    let totalVolume = 0;

    selectedCountries.forEach(countryCode => {
      const volume = safeVolumes[countryCode] || 10;
      const countryTransparency = this.calculateCountryTransparencyEffectiveness(
        countrySpecificCoverage, transparencyEffectiveness, countryCode
      );
      
      totalWeightedTransparency += countryTransparency * volume;
      totalVolume += volume;
    });

    return totalVolume > 0 ? totalWeightedTransparency / totalVolume : 0;
  }

  // Original transparency calculation method (kept for backward compatibility)
  calculateOriginalTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness) {
    if (!this.validateHRDDStrategy(hrddCoverage) || !this.validateTransparency(transparencyEffectiveness)) {
      return 0;
    }

    // Tool categories with their base effectiveness and interaction factors
    const toolCategories = [
      {
        name: 'Worker Voice',
        tools: [0, 1], // Continuous Worker Voice, Annual Surveys
        baseEffectiveness: [0.90, 0.45], // High effectiveness tools
        categoryWeight: 1.0
      },
      {
        name: 'Audit',
        tools: [2, 3], // Unannounced, Announced
        baseEffectiveness: [0.25, 0.15], // Medium effectiveness tools
        categoryWeight: 0.85
      },
      {
        name: 'Passive',
        tools: [4, 5], // Self-reporting, Desk-based
        baseEffectiveness: [0.12, 0.05], // Lower effectiveness tools
        categoryWeight: 0.70
      }
    ];

    const maxTransparency = 0.90; // 90% maximum achievable transparency
    let combinedTransparency = 0;

    // Calculate transparency for each category
    toolCategories.forEach(category => {
      let categoryTransparency = 0;
      let categoryProduct = 1;

      category.tools.forEach((toolIndex, i) => {
        const coverage = Math.max(0, Math.min(100, hrddCoverage[toolIndex] || 0)) / 100; // Convert to 0-1
        const baseEff = category.baseEffectiveness[i];
        const userEff = Math.max(0, Math.min(100, transparencyEffectiveness[toolIndex] || 0)) / 100;
        
        // Use average of base and user effectiveness to allow customization but keep realistic bounds
        const effectiveRate = (baseEff + userEff) / 2;
        
        // Apply diminishing returns: 1 - (1 - coverage × effectiveness)
        categoryProduct *= (1 - coverage * effectiveRate);
      });

      categoryTransparency = 1 - categoryProduct;
      
      // Combine categories with their weights (reduces cross-category overlap)
      combinedTransparency = 1 - (1 - combinedTransparency) * (1 - categoryTransparency * category.categoryWeight);
    });

    // Apply maximum transparency cap
    return Math.min(combinedTransparency, maxTransparency);
  }

  // Step 3: Calculate overall responsiveness effectiveness
  calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness) {
    if (!this.validateResponsiveness(responsivenessStrategy) || !this.validateResponsivenessEffectiveness(responsivenessEffectiveness)) {
      return 0;
    }

    let weightedEffectiveness = 0;
    let totalWeight = 0;

    const length = Math.min(responsivenessStrategy.length, responsivenessEffectiveness.length);

    for (let i = 0; i < length; i++) {
      const strategyWeight = Math.max(0, responsivenessStrategy[i]);
      const effectiveness = (responsivenessEffectiveness[i] || 0) / 100; // Convert percentage to decimal

      weightedEffectiveness += strategyWeight * effectiveness;
      totalWeight += strategyWeight;
    }

    return totalWeight > 0 ? weightedEffectiveness / totalWeight : 0;
  }

  // Updated: Calculate final managed risk using country-specific coverage
  calculateManagedRisk(
    baselineRisk,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = this.defaultFocus ?? 0,
    riskConcentration = 1,
    selectedCountries = null,
    countryVolumes = null,
    countryRisks = null
  ) {
    if (baselineRisk <= 0) {
      return 0;
    }

    // Use new country-specific transparency calculation if data available
    const overallTransparencyEffectiveness = selectedCountries && countryVolumes && countryRisks
      ? this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness, selectedCountries, countryVolumes, countryRisks, focus)
      : this.calculateOriginalTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);

    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);

    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(riskConcentration) && riskConcentration > 0
      ? Math.max(1, riskConcentration)
      : 1;

    // Note: Focus effect is now embedded in the transparency calculation through coverage distribution
    // The focus multiplier here provides additional concentration effect
    const focusWeight = this.getFocusWeight();
    const focusMultiplier = (1 - sanitizedFocus * focusWeight) + sanitizedFocus * focusWeight * sanitizedConcentration;
    const managedRisk = baselineRisk * (1 - combinedEffectiveness * focusMultiplier);

    // Ensure managed risk doesn't go below 0
    return Math.max(0, managedRisk);
  }

  // Updated: Calculate managed risk details with country-specific coverage
  calculateManagedRiskDetails(
    selectedCountries,
    countryVolumes,
    countryRisks,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = this.defaultFocus ?? 0
  ) {
    const safeSelected = Array.isArray(selectedCountries) ? selectedCountries : [];
    if (safeSelected.length === 0) {
      const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
      const focusWeight = this.getFocusWeight();
      return {
        managedRisk: 0,
        baselineRisk: 0,
        riskConcentration: 1,
        focusMultiplier: (1 - sanitizedFocus * focusWeight) + sanitizedFocus * focusWeight * 1,
        combinedEffectiveness: 0,
        countryManagedRisks: {},
        countrySpecificCoverage: {}
      };
    }

    const metrics = this.calculatePortfolioMetrics(safeSelected, countryVolumes, countryRisks);
    const baselineRisk = metrics.baselineRisk;
    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const focusWeight = this.getFocusWeight();
    const sanitizedConcentration = Number.isFinite(metrics.riskConcentration) && metrics.riskConcentration > 0
      ? Math.max(1, metrics.riskConcentration)
      : 1;

    // Calculate country-specific coverage distribution
    const countrySpecificCoverage = this.calculateCountrySpecificCoverage(
      safeSelected, countryVolumes, countryRisks, hrddStrategy, sanitizedFocus
    );

    // Calculate transparency using country-specific coverage
    const overallTransparencyEffectiveness = this.calculateTransparencyEffectiveness(
      hrddStrategy, transparencyEffectiveness, safeSelected, countryVolumes, countryRisks, sanitizedFocus
    );
    
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);
    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

        const focusMultiplier = (1 - sanitizedFocus * focusWeight) + sanitizedFocus * focusWeight * sanitizedConcentration;

    const managedRisk = baselineRisk > 0
      ? Math.max(0, baselineRisk * (1 - combinedEffectiveness * focusMultiplier))
      : 0;

    // Calculate country-specific managed risks using individual transparency levels
    const managedRisksByCountry = {};
    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    safeSelected.forEach(countryCode => {
      const countryRisk = Number.isFinite(safeCountryRisks[countryCode]) ? safeCountryRisks[countryCode] : 0;

      if (countryRisk <= 0 || combinedEffectiveness <= 0) {
        managedRisksByCountry[countryCode] = Math.max(0, countryRisk);
        return;
      }

      // Calculate country-specific transparency
      const countryTransparency = this.calculateCountryTransparencyEffectiveness(
        countrySpecificCoverage, transparencyEffectiveness, countryCode
      );
      
      // Country-specific combined effectiveness
      const countryCombinenedEffectiveness = countryTransparency * overallResponsivenessEffectiveness;
      
      // Apply focus adjustment for individual country
      const riskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
      const biasedRiskRatio = this.getBiasedRiskRatio(riskRatio, sanitizedFocus);
      const countryFocusMultiplier = (1 - sanitizedFocus * focusWeight) + sanitizedFocus * focusWeight * biasedRiskRatio;
      
      const managedValue = countryRisk * (1 - Math.min(1, Math.max(0, countryCombinenedEffectiveness * countryFocusMultiplier)));
      managedRisksByCountry[countryCode] = Math.max(0, managedValue);
    });

    return {
      managedRisk,
      baselineRisk,
      riskConcentration: sanitizedConcentration,
      focusMultiplier,
      combinedEffectiveness,
      countryManagedRisks: managedRisksByCountry,
      countrySpecificCoverage
    };
  }

  // Calculate risk reduction percentage
  calculateRiskReduction(baselineRisk, managedRisk) {
    if (baselineRisk <= 0) return 0;
    return ((baselineRisk - managedRisk) / baselineRisk) * 100;
  }

  // Determine risk band based on score
  getRiskBand(score) {
    for (const [band, definition] of Object.entries(this.riskBands)) {
      if (score >= definition.min && score <= definition.max) {
        return band;
      }
    }
    return 'Unknown';
  }

  // Get color for risk score
  getRiskColor(score) {
    const band = this.getRiskBand(score);
    return this.riskBands[band]?.color || '#64748b'; // Default gray
  }

  // Get all risk band definitions for legend
  getRiskBandDefinitions() {
    return Object.entries(this.riskBands).map(([name, definition]) => ({
      name,
      range: `${definition.min}-${definition.max === 100 ? '100' : Math.floor(definition.max)}`,
      color: definition.color
    }));
  }

  // Validation methods
  validateWeights(weights) {
    if (!Array.isArray(weights) || weights.length !== 5) {
      return false;
    }
    
    return weights.every(weight => 
      typeof weight === 'number' && 
      weight >= 0 && 
      weight <= 50 // Allow up to 50% per factor
    );
  }

  validateHRDDStrategy(strategy) {
    if (!Array.isArray(strategy) || strategy.length !== this.hrddStrategyLabels.length) {
      return false;
    }

    return strategy.every(weight =>
      typeof weight === 'number' &&
      weight >= 0 && 
      weight <= 100
    );
  }

  validateTransparency(transparency) {
    if (!Array.isArray(transparency) || transparency.length !== this.hrddStrategyLabels.length) {
      return false;
    }

    return transparency.every(effectiveness =>
      typeof effectiveness === 'number' &&
      effectiveness >= 0 && 
      effectiveness <= 100
    );
  }

  validateResponsiveness(responsiveness) {
    if (!Array.isArray(responsiveness) || responsiveness.length !== this.responsivenessLabels.length) {
      return false;
    }

    return responsiveness.every(weight =>
      typeof weight === 'number' &&
      weight >= 0 &&
      weight <= 100
    );
  }

  validateResponsivenessEffectiveness(effectiveness) {
    if (!Array.isArray(effectiveness) || effectiveness.length !== this.responsivenessLabels.length) {
      return false;
    }

    return effectiveness.every(eff =>
      typeof eff === 'number' &&
      eff >= 0 && 
      eff <= 100
    );
  }

  // Get gradient colors for map visualization
  getGradientColors() {
    return [
      '#22c55e', // Low - Green
      '#84cc16', // Low-Medium - Light Green
      '#eab308', // Medium - Yellow
      '#f59e0b', // Medium-High - Amber
      '#f97316', // Medium-High - Orange
      '#ef4444', // High - Red
      '#dc2626', // High - Dark Red
      '#991b1b'  // Very High - Darkest Red
    ];
  }

  // Convert risk score to color index for gradient
  getColorIndex(score, maxIndex = 7) {
    const normalizedScore = Math.max(0, Math.min(100, score)) / 100;
    return Math.floor(normalizedScore * maxIndex);
  }

  // Updated: Get strategy effectiveness breakdown with country-specific coverage
  getStrategyBreakdown(
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = 0,
    riskConcentration = 1,
    selectedCountries = null,
    countryVolumes = null,
    countryRisks = null
  ) {
     const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(riskConcentration) && riskConcentration > 0
      ? Math.max(1, riskConcentration)
      : 1;
    const focusWeight = this.getFocusWeight();
    const focusMultiplier = (1 - sanitizedFocus * focusWeight) + sanitizedFocus * focusWeight * sanitizedConcentration;

    // Calculate transparency using appropriate method
    const overallTransparency = selectedCountries && countryVolumes && countryRisks
      ? this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness, selectedCountries, countryVolumes, countryRisks, sanitizedFocus)
      : this.calculateOriginalTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    
    // Get country-specific coverage if available
    const countrySpecificCoverage = selectedCountries && countryVolumes && countryRisks
      ? this.calculateCountrySpecificCoverage(selectedCountries, countryVolumes, countryRisks, hrddStrategy, sanitizedFocus)
      : null;

    const toolCategories = [
      {
        name: 'Worker Voice',
        tools: [0, 1],
        baseEffectiveness: [0.90, 0.45],
        categoryWeight: 1.0
      },
      {
        name: 'Audit',
        tools: [2, 3],
        baseEffectiveness: [0.25, 0.15],
        categoryWeight: 0.85
      },
      {
        name: 'Passive',
        tools: [4, 5],
        baseEffectiveness: [0.12, 0.05],
        categoryWeight: 0.70
      }
    ];

    const breakdown = {
      hrddStrategies: [],
      overallTransparency: overallTransparency,
      overallResponsiveness: this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness),
      primaryResponse: this.getPrimaryResponseMethod(responsivenessStrategy, responsivenessEffectiveness),
      focus: {
        level: sanitizedFocus,
        concentration: sanitizedConcentration,
        portfolioMultiplier: focusMultiplier
      },
      countrySpecificCoverage: countrySpecificCoverage
    };

    // Calculate individual strategy contributions
    for (let i = 0; i < hrddStrategy.length; i++) {
      const baseCoverage = Math.max(0, Math.min(100, hrddStrategy[i] || 0));
      const userEffectiveness = Math.max(0, Math.min(100, transparencyEffectiveness[i] || 0));
      
      // Find which category this tool belongs to
      let category = toolCategories.find(cat => cat.tools.includes(i));
      if (!category) category = { name: 'Other', baseEffectiveness: [0.05], categoryWeight: 0.5 };
      
      const toolIndexInCategory = category.tools ? category.tools.indexOf(i) : 0;
      const baseEffectiveness = category.baseEffectiveness[toolIndexInCategory] || 0.05;
      const averageEffectiveness = (baseEffectiveness + userEffectiveness / 100) / 2;

      // Calculate coverage range if country-specific data available
      let coverageRange = null;
      if (countrySpecificCoverage && selectedCountries) {
        const coverages = selectedCountries.map(countryCode => 
          countrySpecificCoverage[countryCode] ? countrySpecificCoverage[countryCode][i] : baseCoverage
        ).filter(c => Number.isFinite(c));
        
        if (coverages.length > 0) {
          const minCoverage = Math.min(...coverages);
          const maxCoverage = Math.max(...coverages);
          coverageRange = minCoverage !== maxCoverage 
            ? `${minCoverage.toFixed(1)}%-${maxCoverage.toFixed(1)}%`
            : `${minCoverage.toFixed(1)}%`;
        }
      }
      
      breakdown.hrddStrategies.push({
        name: this.hrddStrategyLabels[i],
        coverage: baseCoverage,
        coverageRange: coverageRange,
        baseEffectiveness: Math.round(baseEffectiveness * 100),
        userEffectiveness: userEffectiveness,
        averageEffectiveness: Math.round(averageEffectiveness * 100),
        category: category.name,
        contribution: baseCoverage * averageEffectiveness // Simple contribution metric
      });
    }

    return breakdown;
  }

  getPrimaryResponseMethod(responsivenessStrategy, responsivenessEffectiveness) {
    let maxWeight = 0;
    let primaryIndex = 0;

    for (let i = 0; i < responsivenessStrategy.length; i++) {
      if (responsivenessStrategy[i] > maxWeight) {
        maxWeight = responsivenessStrategy[i];
        primaryIndex = i;
      }
    }

    return {
      method: this.responsivenessLabels[primaryIndex],
      weight: maxWeight,
      effectiveness: responsivenessEffectiveness[primaryIndex]
    };
   }

  // Updated: Generate risk assessment summary with country-specific data
  generateRiskSummary(
    baselineRisk,
    managedRisk,
    selectedCountries,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = 0,
    riskConcentration = 1,
    countryVolumes = null,
    countryRisks = null
  ) {
    const riskReduction = this.calculateRiskReduction(baselineRisk, managedRisk);
    const breakdown = this.getStrategyBreakdown(
      hrddStrategy,
      transparencyEffectiveness,
      responsivenessStrategy,
      responsivenessEffectiveness,
      focus,
      riskConcentration,
      selectedCountries,
      countryVolumes,
      countryRisks
    );

    return {
      baseline: {
        score: baselineRisk,
        band: this.getRiskBand(baselineRisk),
        color: this.getRiskColor(baselineRisk)
      },
      managed: {
        score: managedRisk,
        band: this.getRiskBand(managedRisk),
        color: this.getRiskColor(managedRisk)
      },
      improvement: {
        riskReduction: riskReduction,
        absoluteReduction: baselineRisk - managedRisk,
        isImprovement: managedRisk < baselineRisk
      },
      portfolio: {
        countriesSelected: selectedCountries.length,
        averageRisk: baselineRisk,
        riskConcentration
      },
      strategy: breakdown
    };
  }

  // Updated: Export configuration for reporting
  exportConfiguration(state) {
    const focusValue = Number.isFinite(state.focus) ? state.focus : 0;
    const riskConcentration = Number.isFinite(state.riskConcentration) && state.riskConcentration > 0
      ? Math.max(1, state.riskConcentration)
      : 1;
    const focusWeight = this.getFocusWeight();
    const focusMultiplier = (1 - focusValue * focusWeight) + focusValue * focusWeight * riskConcentration;

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '4.0',
        toolName: 'HRDD Risk Assessment Tool - Risk-Adjusted Coverage Distribution'
      },
      portfolio: {
        selectedCountries: state.selectedCountries,
        countryVolumes: state.countryVolumes,
        totalCountries: state.selectedCountries.length
      },
      step1: {
        weights: state.weights,
        baselineRisk: state.baselineRisk,
        weightLabels: ['ITUC Rights Rating', 'Corruption Index', 'Migrant Worker Prevalence', 'WJP Index', 'Walk Free Slavery Index']
      },
      step2: {
        hrddStrategy: state.hrddStrategy,
        transparencyEffectiveness: state.transparencyEffectiveness,
        strategyLabels: this.hrddStrategyLabels,
        focus: focusValue,
        riskConcentration,
        focusMultiplier,
        methodology: 'Risk-adjusted coverage distribution with resource conservation and country-specific transparency calculation'
      },
      step3: {
        responsivenessStrategy: state.responsivenessStrategy,
        responsivenessEffectiveness: state.responsivenessEffectiveness,
        managedRisk: state.managedRisk,
        responsivenessLabels: this.responsivenessLabels
      },
      results: this.generateRiskSummary(
        state.baselineRisk,
        state.managedRisk,
        state.selectedCountries,
        state.hrddStrategy,
        state.transparencyEffectiveness,
        state.responsivenessStrategy,
        state.responsivenessEffectiveness,
        focusValue,
        riskConcentration,
        state.countryVolumes,
        state.countryRisks
      )
    };
  }
}

export const riskEngine = new RiskEngine();