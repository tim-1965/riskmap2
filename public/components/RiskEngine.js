// RiskEngine.js - Complete risk calculation logic with revised coverage-based transparency
export class RiskEngine {
  constructor() {
    // Step 1: Default weightings for the 5 input columns
    this.defaultWeights = [20, 20, 5, 10, 10]; // ITUC, Corruption, Migrant, WJP, Walkfree
    
    // Step 2: HRDD Strategy defaults - now representing supplier base coverage percentages
    this.defaultHRDDStrategy = [5, 15, 25, 60, 80, 90]; // Coverage percentages: Worker voice is rare, passive approaches common
    this.defaultTransparencyEffectiveness = [90, 45, 25, 15, 12, 5]; // Research-backed base effectiveness rates

    // Step 3: Responsiveness Strategy defaults
    this.defaultResponsivenessStrategy = [10, 5, 20, 20, 10, 5]; // Portfolio of response levers from weakest to strongest
    this.defaultResponsivenessEffectiveness = [70, 85, 35, 25, 15, 5]; // Mid-point response effectiveness assumptions in percentages

    // Focus defaults for directing transparency/response capacity to higher-risk countries
    this.defaultFocus = 0.6;

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

  // NEW: Coverage-based transparency calculation with diminishing returns
  calculateTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness) {
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

  // Step 3: Calculate final managed risk
  calculateManagedRisk(
    baselineRisk,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = this.defaultFocus ?? 0,
    riskConcentration = 1
  ) {
    if (baselineRisk <= 0) {
      return 0;
    }

    const overallTransparencyEffectiveness = this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);

    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(riskConcentration) && riskConcentration > 0
      ? Math.max(1, riskConcentration)
      : 1;

    const focusMultiplier = (1 - sanitizedFocus) + sanitizedFocus * sanitizedConcentration;
    const managedRisk = baselineRisk * (1 - combinedEffectiveness * focusMultiplier);

    // Ensure managed risk doesn't go below 0
    return Math.max(0, managedRisk);
  }

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
      return {
        managedRisk: 0,
        baselineRisk: 0,
        riskConcentration: 1,
        focusMultiplier: (1 - sanitizedFocus) + sanitizedFocus * 1,
        combinedEffectiveness: 0,
        countryManagedRisks: {}
      };
    }

    const metrics = this.calculatePortfolioMetrics(safeSelected, countryVolumes, countryRisks);
    const baselineRisk = metrics.baselineRisk;
    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(metrics.riskConcentration) && metrics.riskConcentration > 0
      ? Math.max(1, metrics.riskConcentration)
      : 1;

    const overallTransparencyEffectiveness = this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);
    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

    const focusMultiplier = (1 - sanitizedFocus) + sanitizedFocus * sanitizedConcentration;

    const managedRisk = baselineRisk > 0
      ? Math.max(0, baselineRisk * (1 - combinedEffectiveness * focusMultiplier))
      : 0;

    const managedRisksByCountry = {};
    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    safeSelected.forEach(countryCode => {
      const countryRisk = Number.isFinite(safeCountryRisks[countryCode]) ? safeCountryRisks[countryCode] : 0;

      if (baselineRisk <= 0 || combinedEffectiveness <= 0) {
        managedRisksByCountry[countryCode] = Math.max(0, countryRisk);
        return;
      }

      const relativeRisk = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
      const focusWeight = (1 - sanitizedFocus) + sanitizedFocus * relativeRisk;
      const reductionFactor = combinedEffectiveness * focusWeight;
      const managedValue = countryRisk * (1 - Math.min(1, Math.max(0, reductionFactor)));
      managedRisksByCountry[countryCode] = Math.max(0, managedValue);
    });

    return {
      managedRisk,
      baselineRisk,
      riskConcentration: sanitizedConcentration,
      focusMultiplier,
      combinedEffectiveness,
      countryManagedRisks: managedRisksByCountry
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

  // Get strategy effectiveness breakdown with new methodology
  getStrategyBreakdown(
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = 0,
    riskConcentration = 1
  ) {
    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(riskConcentration) && riskConcentration > 0
      ? Math.max(1, riskConcentration)
      : 1;
    const focusMultiplier = (1 - sanitizedFocus) + sanitizedFocus * sanitizedConcentration;

    // Calculate transparency using new coverage-based method
    const overallTransparency = this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    
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
      }
    };

    // Calculate individual strategy contributions using new methodology
    for (let i = 0; i < hrddStrategy.length; i++) {
      const coverage = Math.max(0, Math.min(100, hrddStrategy[i] || 0));
      const userEffectiveness = Math.max(0, Math.min(100, transparencyEffectiveness[i] || 0));
      
      // Find which category this tool belongs to
      let category = toolCategories.find(cat => cat.tools.includes(i));
      if (!category) category = { name: 'Other', baseEffectiveness: [0.05], categoryWeight: 0.5 };
      
      const toolIndexInCategory = category.tools ? category.tools.indexOf(i) : 0;
      const baseEffectiveness = category.baseEffectiveness[toolIndexInCategory] || 0.05;
      const averageEffectiveness = (baseEffectiveness + userEffectiveness / 100) / 2;
      
      breakdown.hrddStrategies.push({
        name: this.hrddStrategyLabels[i],
        coverage: coverage,
        baseEffectiveness: Math.round(baseEffectiveness * 100),
        userEffectiveness: userEffectiveness,
        averageEffectiveness: Math.round(averageEffectiveness * 100),
        category: category.name,
        contribution: coverage * averageEffectiveness // Simple contribution metric
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

  // Generate risk assessment summary
  generateRiskSummary(
    baselineRisk,
    managedRisk,
    selectedCountries,
    hrddStrategy,
    transparencyEffectiveness,
    responsivenessStrategy,
    responsivenessEffectiveness,
    focus = 0,
    riskConcentration = 1
  ) {
    const riskReduction = this.calculateRiskReduction(baselineRisk, managedRisk);
    const breakdown = this.getStrategyBreakdown(
      hrddStrategy,
      transparencyEffectiveness,
      responsivenessStrategy,
      responsivenessEffectiveness,
      focus,
      riskConcentration
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

  // Export configuration for reporting
  exportConfiguration(state) {
    const focusValue = Number.isFinite(state.focus) ? state.focus : 0;
    const riskConcentration = Number.isFinite(state.riskConcentration) && state.riskConcentration > 0
      ? Math.max(1, state.riskConcentration)
      : 1;
    const focusMultiplier = (1 - focusValue) + focusValue * riskConcentration;

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '3.1',
        toolName: 'HRDD Risk Assessment Tool - Coverage-Based Transparency'
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
        methodology: 'Coverage-based with diminishing returns and 90% transparency cap'
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
        riskConcentration
      )
    };
  }
}

export const riskEngine = new RiskEngine();