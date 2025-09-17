// RiskEngine.js - Complete risk calculation logic for all 3 steps
export class RiskEngine {
  constructor() {
    // Step 1: Default weightings for the 5 input columns
    this.defaultWeights = [20, 20, 5, 10, 10]; // ITUC, Corruption, Migrant, WJP, Walkfree
    
    // Step 2: HRDD Strategy defaults
    this.defaultHRDDStrategy = [5, 20, 30, 30, 15]; // Continuous monitoring, Unannounced audit, Announced audit, SAQ, Do nothing
    this.defaultTransparencyEffectiveness = [85, 50, 15, 5, 0]; // Effectiveness percentages for each strategy
    
    // Step 3: Responsiveness Strategy defaults  
    this.defaultResponsivenessStrategy = [100, 80, 40, 20, -20]; // Real time, 1 week, 2 weeks, 4 weeks, 3 months, no action (converted to percentages)
    
    // Strategy labels
    this.hrddStrategyLabels = [
      'Continuous Monitoring',
      'Unannounced Social Audit', 
      'Announced/Self-Arranged Social Audit',
      'Self-Assessment Questionnaire (SAQ)',
      'Do Nothing'
    ];
    
    this.responsivenessLabels = [
      'Real Time Response',
      '1 Week Response',
      '2 Weeks Response', 
      '4 Weeks Response',
      '3 Months Response',
      'No Action'
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

  // Step 1: Calculate baseline risk for portfolio (sumproduct of volumes and risks)
  calculateBaselineRisk(selectedCountries, countryVolumes, countryRisks) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return 0;
    }

    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};

    let totalVolumeRisk = 0;
    let totalVolume = 0;

    selectedCountries.forEach(countryCode => {
      const volume = typeof safeVolumes[countryCode] === 'number' ? safeVolumes[countryCode] : 10; // Default volume is 10
      const risk = typeof safeRisks[countryCode] === 'number' ? safeRisks[countryCode] : 0;

      totalVolumeRisk += volume * risk;
      totalVolume += volume;
    });

    return totalVolume > 0 ? totalVolumeRisk / totalVolume : 0;
  }

  // Step 2 & 3: Calculate overall transparency effectiveness
  calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness) {
    if (!this.validateHRDDStrategy(hrddStrategy) || !this.validateTransparency(transparencyEffectiveness)) {
      return 0;
    }

    let weightedEffectiveness = 0;
    let totalWeight = 0;

    for (let i = 0; i < hrddStrategy.length; i++) {
      const strategyWeight = hrddStrategy[i];
      const effectiveness = transparencyEffectiveness[i] / 100; // Convert percentage to decimal
      
      weightedEffectiveness += strategyWeight * effectiveness;
      totalWeight += strategyWeight;
    }

    return totalWeight > 0 ? weightedEffectiveness / totalWeight : 0;
  }

  // Step 3: Calculate overall responsiveness effectiveness
  calculateResponsivenessEffectiveness(responsivenessStrategy) {
    if (!this.validateResponsiveness(responsivenessStrategy)) {
      return 0;
    }

    // Find the highest weighted responsiveness approach
    let maxWeight = 0;
    let selectedEffectiveness = 0;

    for (let i = 0; i < responsivenessStrategy.length; i++) {
      if (responsivenessStrategy[i] > maxWeight) {
        maxWeight = responsivenessStrategy[i];
        selectedEffectiveness = this.defaultResponsivenessStrategy[i] / 100; // Convert to decimal
      }
    }

    return selectedEffectiveness;
  }

  // Step 3: Calculate final managed risk
  calculateManagedRisk(baselineRisk, hrddStrategy, transparencyEffectiveness, responsivenessStrategy) {
    if (baselineRisk <= 0) {
      return 0;
    }

    const overallTransparencyEffectiveness = this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy);
    
    // Formula: Managed Risk = Baseline Risk × (1 - Transparency Effectiveness × Responsiveness Effectiveness)
    const riskReductionFactor = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;
    const managedRisk = baselineRisk * (1 - riskReductionFactor);
    
    // Ensure managed risk doesn't go below 0
    return Math.max(0, managedRisk);
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
    if (!Array.isArray(strategy) || strategy.length !== 5) {
      return false;
    }
    
    return strategy.every(weight => 
      typeof weight === 'number' && 
      weight >= 0 && 
      weight <= 100
    );
  }

  validateTransparency(transparency) {
    if (!Array.isArray(transparency) || transparency.length !== 5) {
      return false;
    }
    
    return transparency.every(effectiveness => 
      typeof effectiveness === 'number' && 
      effectiveness >= 0 && 
      effectiveness <= 100
    );
  }

  validateResponsiveness(responsiveness) {
    if (!Array.isArray(responsiveness) || responsiveness.length !== 5) {
      return false;
    }
    
    return responsiveness.every(weight => 
      typeof weight === 'number' && 
      weight >= 0 && 
      weight <= 100
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

  // Get strategy effectiveness breakdown
  getStrategyBreakdown(hrddStrategy, transparencyEffectiveness, responsivenessStrategy) {
    const breakdown = {
      hrddStrategies: [],
      overallTransparency: this.calculateTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness),
      overallResponsiveness: this.calculateResponsivenessEffectiveness(responsivenessStrategy),
      primaryResponse: this.getPrimaryResponseMethod(responsivenessStrategy)
    };

    // Calculate individual strategy contributions
    let totalWeight = hrddStrategy.reduce((sum, weight) => sum + weight, 0);
    
    for (let i = 0; i < hrddStrategy.length; i++) {
      if (hrddStrategy[i] > 0) {
        breakdown.hrddStrategies.push({
          name: this.hrddStrategyLabels[i],
          weight: hrddStrategy[i],
          percentage: totalWeight > 0 ? (hrddStrategy[i] / totalWeight) * 100 : 0,
          transparency: transparencyEffectiveness[i],
          contribution: (hrddStrategy[i] / totalWeight) * (transparencyEffectiveness[i] / 100) * 100
        });
      }
    }

    return breakdown;
  }

  getPrimaryResponseMethod(responsivenessStrategy) {
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
      effectiveness: this.defaultResponsivenessStrategy[primaryIndex]
    };
  }

  // Generate risk assessment summary
  generateRiskSummary(baselineRisk, managedRisk, selectedCountries, hrddStrategy, transparencyEffectiveness, responsivenessStrategy) {
    const riskReduction = this.calculateRiskReduction(baselineRisk, managedRisk);
    const breakdown = this.getStrategyBreakdown(hrddStrategy, transparencyEffectiveness, responsivenessStrategy);
    
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
        averageRisk: baselineRisk
      },
      strategy: breakdown
    };
  }

  // Export configuration for reporting
  exportConfiguration(state) {
    return {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '3.0',
        toolName: 'HRDD Risk Assessment Tool'
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
        strategyLabels: this.hrddStrategyLabels
      },
      step3: {
        responsivenessStrategy: state.responsivenessStrategy,
        managedRisk: state.managedRisk,
        responsivenessLabels: this.responsivenessLabels
      },
      results: this.generateRiskSummary(
        state.baselineRisk, 
        state.managedRisk, 
        state.selectedCountries,
        state.hrddStrategy,
        state.transparencyEffectiveness,
        state.responsivenessStrategy
      )
    };
  }
}

export const riskEngine = new RiskEngine();