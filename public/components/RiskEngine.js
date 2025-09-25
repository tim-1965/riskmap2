// RiskEngine.js - Modified to prevent rank reversals while maintaining focus allocation
export class RiskEngine {
  constructor() {
    // Step 1: Default weightings for the 5 input columns
    this.defaultWeights = [30, 30, 10, 20, 10]; // ITUC, Corruption, Migrant, WJP, Walkfree
    
    // Step 2: HRDD Strategy defaults - representing supplier base coverage percentages
    this.defaultHRDDStrategy = [35, 15, 25, 60, 80, 90]; // Coverage percentages: Worker voice is rare, passive approaches common
    this.defaultTransparencyEffectiveness = [90, 45, 25, 15, 12, 5]; // Research-backed base effectiveness rates

    // Step 3: Responsiveness Strategy defaults
    this.defaultResponsivenessStrategy = [35, 5, 20, 20, 10, 5]; // Portfolio of response levers from weakest to strongest
    this.defaultResponsivenessEffectiveness = [75, 80, 35, 25, 15, 5]; // Mid-point response effectiveness assumptions in percentages

    // Focus defaults for directing transparency/response capacity to higher-risk countries
    this.defaultFocus = 0.6;

    // MODIFIED: Further reduced parameters for stronger rank preservation
    this.focusBiasSettings = {
      minExponent: 1.0,
      maxExponent: 2.0, // Further reduced from 2.8 to 2.0
      minRiskRatio: 0.08, // Increased from 0.05 to 0.08
      maxRiskRatio: 2.5, // Further reduced from 4.0 to 2.5
      aggressionThreshold: 0.5
    };

    // Controls how strongly portfolio concentration amplifies focus-driven effectiveness gains
    this.focusConcentrationWeight = 2.75; // γ in mathematical specification
    
    // Resource conservation settings
    this.maxResourceExpansion = 0.3; // 30% maximum allowed resource increase

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

  // MODIFIED: Further reduced maximum focus exponent for stronger rank preservation
  getFocusExponent(focus = 0) {
    const safeFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const settings = this.focusBiasSettings || {};
    const minExp = Number.isFinite(settings.minExponent) ? settings.minExponent : 1.0;
    const maxExp = Number.isFinite(settings.maxExponent) ? Math.max(minExp, Math.min(2.0, settings.maxExponent)) : 2.0; // Further reduced to 2.0
    
    // Mathematical specification implementation with further reduced maximum
    if (safeFocus <= 0.5) {
      return minExp + safeFocus * (maxExp - minExp) * (safeFocus / 0.5);
    } else {
      const component = 0.5 + Math.pow(safeFocus - 0.5, 1.8) * 0.5;
      return minExp + (maxExp - minExp) * component;
    }
  }

  // MODIFIED: Enhanced compression for extreme cases with tightened parameters
  getBiasedRiskRatio(riskRatio, focus = 0, baselineRisk = 0, portfolioBaselineRisk = 0) {
    const settings = this.focusBiasSettings || {};
    const maxRatio = Number.isFinite(settings.maxRiskRatio) && settings.maxRiskRatio > 0
      ? settings.maxRiskRatio
      : 2.5; // Further reduced from 4.0
    const minRatio = Number.isFinite(settings.minRiskRatio) && settings.minRiskRatio >= 0
      ? settings.minRiskRatio
      : 0.08; // Increased from 0.05

    const clampedRatio = Math.min(
      maxRatio,
      Math.max(0, Number.isFinite(riskRatio) ? riskRatio : 0)
    );

    const exponent = this.getFocusExponent(focus);
    let biasedRatio = Math.pow(clampedRatio, exponent);
    
    // Apply bounds first
    biasedRatio = Math.max(minRatio, Math.min(maxRatio, biasedRatio));
    
    // Original compression for moderate focus
    if (focus > 0.6 && clampedRatio < 0.8) {
      const compressionFactor = 0.3 + 0.7 * Math.pow(clampedRatio, 2);
      biasedRatio *= compressionFactor;
    }
    
    // Enhanced compression for extreme cases (now with tighter bounds)
    if (focus > 0.7 && biasedRatio > 1.5) { // Reduced from 2.0 to 1.5
      const extremeCompressionFactor = 0.5 + 0.5 * Math.pow(1.5 / biasedRatio, 0.5); // Stronger compression
      biasedRatio *= extremeCompressionFactor;
    }

    return Math.max(minRatio, biasedRatio);
  }

  // Calculate portfolio focus multiplier exactly per specification
  calculatePortfolioFocusMultiplier(focus, riskConcentration) {
    const safeFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const safeConcentration = Number.isFinite(riskConcentration) && riskConcentration >= 1 
      ? riskConcentration 
      : 1;
    const gamma = this.focusConcentrationWeight;
    
    // Mathematical specification: F₀ = (1 - f · γ) + f · γ · C
    return (1 - safeFocus * gamma) + safeFocus * gamma * safeConcentration;
  }

  // Calculate country-specific focus multiplier per specification
  calculateCountryFocusMultiplier(focus, portfolioFocusMultiplier, biasedRiskRatio, countryRisk) {
    const safeFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const gamma = this.focusConcentrationWeight;
    
    // Mathematical specification:
    // If f > 0.6 AND bᵢ ≥ 70:
    //   Fᵢ = F₀ · [1 + (f-0.6) · 0.5]
    // Else:
    //   Fᵢ = (1 - f · γ) + f · γ · rᵢ'
    
    if (safeFocus > 0.6 && countryRisk >= 70) {
      const highRiskBonus = 1 + (safeFocus - 0.6) * 0.5;
      return portfolioFocusMultiplier * highRiskBonus;
    } else {
      return (1 - safeFocus * gamma) + safeFocus * gamma * biasedRiskRatio;
    }
  }

  // Calculate resource conservation factor
  calculateResourceConservationFactor(selectedCountries, countryVolumes, countryRisks, hrddStrategy, focus) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return {};
    }

    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    
    const portfolioMetrics = this.calculatePortfolioMetrics(selectedCountries, countryVolumes, countryRisks);
    const baselineRisk = portfolioMetrics.baselineRisk;
    
    if (baselineRisk <= 0) {
      const conservationFactors = {};
      selectedCountries.forEach(countryCode => {
        conservationFactors[countryCode] = 1.0;
      });
      return conservationFactors;
    }

    // Calculate expected vs actual resource usage per tool
    const conservationFactors = {};
    
    hrddStrategy.forEach((originalCoverage, toolIndex) => {
      let totalExpectedUsage = 0;
      let totalActualUsage = 0;
      let totalWeightedVolume = 0;
      
      selectedCountries.forEach(countryCode => {
        const countryRisk = safeRisks[countryCode] || 0;
        const countryVolume = safeVolumes[countryCode] || 10;
        const riskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
        const biasedRiskRatio = this.getBiasedRiskRatio(riskRatio, focus, countryRisk, baselineRisk);
        
        // Basic coverage adjustment
        let riskAdjustmentFactor = (1 - focus) + focus * biasedRiskRatio;
        
        // MODIFIED: Gradual high-risk boost instead of sharp threshold
        if (focus > 0.3 && countryRisk >= 40) {
          const riskNormalized = Math.min(1, (countryRisk - 40) / 40); // 0 to 1 for risks 40-80
          const focusNormalized = Math.min(1, (focus - 0.3) / 0.7); // 0 to 1 for focus 0.3-1.0
          const boostFactor = 1 + (riskNormalized * focusNormalized * 0.3); // Max 30% boost
          riskAdjustmentFactor *= boostFactor;
        }
        
        const adjustedCoverage = originalCoverage * riskAdjustmentFactor;
        
        totalExpectedUsage += (originalCoverage / 100) * countryVolume;
        totalActualUsage += (adjustedCoverage / 100) * countryVolume;
        totalWeightedVolume += countryVolume;
      });
      
      // Calculate allowed expansion
      const maxAllowedExpansion = 1 + focus * this.maxResourceExpansion;
      const maxAllowedUsage = totalExpectedUsage * maxAllowedExpansion;
      
      // Calculate conservation factor for this tool
      const toolConservationFactor = totalActualUsage > maxAllowedUsage && totalActualUsage > 0
        ? maxAllowedUsage / totalActualUsage
        : 1.0;
      
      // Apply to each country
      selectedCountries.forEach(countryCode => {
        if (!conservationFactors[countryCode]) {
          conservationFactors[countryCode] = [];
        }
        conservationFactors[countryCode][toolIndex] = toolConservationFactor;
      });
    });
    
    return conservationFactors;
  }

  // MODIFIED: Country-specific coverage calculation with gradual boost
  calculateCountrySpecificCoverage(selectedCountries, countryVolumes, countryRisks, hrddStrategy, focus = 0.6) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return {};
    }

    const safeVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    const safeFocus = Math.max(0, Math.min(1, focus || 0));
    
    const portfolioMetrics = this.calculatePortfolioMetrics(selectedCountries, countryVolumes, countryRisks);
    const baselineRisk = portfolioMetrics.baselineRisk;
    
    if (baselineRisk <= 0) {
      const evenCoverage = {};
      selectedCountries.forEach(countryCode => {
        evenCoverage[countryCode] = [...hrddStrategy];
      });
      return evenCoverage;
    }

    // Calculate resource conservation factors
    const resourceConservationFactors = this.calculateResourceConservationFactor(
      selectedCountries, countryVolumes, countryRisks, hrddStrategy, safeFocus
    );

    const countrySpecificCoverage = {};
    
    selectedCountries.forEach(countryCode => {
      const countryRisk = safeRisks[countryCode] || 0;
      const countryVolume = safeVolumes[countryCode] || 10;
      
      // Calculate biased risk ratio
      const rawRiskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
      const biasedRiskRatio = this.getBiasedRiskRatio(rawRiskRatio, safeFocus, countryRisk, baselineRisk);
      
      // Mathematical specification: cᵢⱼ = cⱼ · [(1-f) + f · rᵢ'] · ηᵢ
      const baseCoverageAdjustment = (1 - safeFocus) + safeFocus * biasedRiskRatio;
      
      const adjustedCoverage = hrddStrategy.map((toolCoverage, toolIndex) => {
        // Apply base coverage adjustment
        let adjustedValue = toolCoverage * baseCoverageAdjustment;
        
        // MODIFIED: Apply gradual high-risk boost instead of sharp threshold
        if (safeFocus > 0.3 && countryRisk >= 40) {
          const riskNormalized = Math.min(1, (countryRisk - 40) / 40); // 0 to 1 for risks 40-80
          const focusNormalized = Math.min(1, (safeFocus - 0.3) / 0.7); // 0 to 1 for focus 0.3-1.0
          const boostFactor = 1 + (riskNormalized * focusNormalized * 0.3); // Max 30% boost (reduced from 80%)
          adjustedValue *= boostFactor;
        }
        
        // Apply resource conservation factor (ηᵢ)
        const conservationFactor = resourceConservationFactors[countryCode] && 
                                  resourceConservationFactors[countryCode][toolIndex]
          ? resourceConservationFactors[countryCode][toolIndex]
          : 1.0;
        
        adjustedValue *= conservationFactor;
        
        return Math.max(0, Math.min(100, adjustedValue));
      });
      
      countrySpecificCoverage[countryCode] = adjustedCoverage;
    });
    
    return countrySpecificCoverage;
  }

  // MODIFIED: Strengthened progressive effectiveness cap for better rank preservation
  calculateProgressiveEffectivenessCap(countryRisk) {
    // Higher risk countries have much lower maximum reduction percentages to preserve ranking
    const baselineNormalized = Math.min(1, Math.max(0, countryRisk / 100)); // 0 to 1
    
    // Strengthened progressive cap: High-risk countries (80+) max 50% reduction, low-risk countries (20-) max 70% reduction
    const minCap = 0.50; // Strengthened from 0.65 to 0.50
    const maxCap = 0.70; // Strengthened from 0.85 to 0.70
    
    return minCap + (maxCap - minCap) * (1 - baselineNormalized);
  }

  // Calculate focus effectiveness metrics across risk tiers
  calculateFocusEffectivenessMetrics(selectedCountries, countryRisks, managedRisks, focus = 0) {
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return {
        highRiskCountries: 0,
        mediumRiskCountries: 0,
        lowRiskCountries: 0,
        avgReductionHigh: 0,
        avgReductionMedium: 0,
        avgReductionLow: 0,
        focusEffectiveness: 0,
        differentialBenefit: 0
      };
    }

    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    const safeManagedRisks = (managedRisks && typeof managedRisks === 'object') ? managedRisks : {};

    const riskData = selectedCountries.map(countryCode => {
      const baselineRisk = safeCountryRisks[countryCode] || 0;
      const managedRisk = safeManagedRisks[countryCode] || baselineRisk;
      const reduction = baselineRisk - managedRisk;
      const reductionPercentage = baselineRisk > 0 ? (reduction / baselineRisk) * 100 : 0;
      
      return {
        countryCode,
        baselineRisk,
        managedRisk,
        reduction,
        reductionPercentage,
        riskTier: baselineRisk >= 60 ? 'high' : baselineRisk >= 40 ? 'medium' : 'low'
      };
    });

    const highRiskCountries = riskData.filter(d => d.riskTier === 'high');
    const mediumRiskCountries = riskData.filter(d => d.riskTier === 'medium');
    const lowRiskCountries = riskData.filter(d => d.riskTier === 'low');

    const avgReductionHigh = highRiskCountries.length > 0 ?
      highRiskCountries.reduce((sum, d) => sum + d.reductionPercentage, 0) / highRiskCountries.length : 0;
    const avgReductionMedium = mediumRiskCountries.length > 0 ?
      mediumRiskCountries.reduce((sum, d) => sum + d.reductionPercentage, 0) / mediumRiskCountries.length : 0;
    const avgReductionLow = lowRiskCountries.length > 0 ?
      lowRiskCountries.reduce((sum, d) => sum + d.reductionPercentage, 0) / lowRiskCountries.length : 0;

    const differentialBenefit = avgReductionHigh - avgReductionLow;
    const maxPossibleDifferential = focus * 50;
    const focusEffectiveness = maxPossibleDifferential > 0 ? 
      Math.min(100, (differentialBenefit / maxPossibleDifferential) * 100) : 0;

    return {
      highRiskCountries: highRiskCountries.length,
      mediumRiskCountries: mediumRiskCountries.length,
      lowRiskCountries: lowRiskCountries.length,
      avgReductionHigh,
      avgReductionMedium,
      avgReductionLow,
      focusEffectiveness,
      differentialBenefit,
      riskData,
      focus
    };
  }

  // Get focus benefit classification for individual countries
  getFocusBenefitLevel(countryRisk, baselineRisk, focus) {
    if (focus < 0.3) return 'standard';
    
    const riskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
    const biasedRatio = this.getBiasedRiskRatio(riskRatio, focus, countryRisk, baselineRisk);
    
    if (biasedRatio > 1.5) return 'high';
    if (biasedRatio > 1.1) return 'medium';
    if (biasedRatio < 0.7) return 'reduced';
    return 'standard';
  }

  // MODIFIED: Managed risk calculation with rank preservation mechanisms
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
        portfolioFocusMultiplier: this.calculatePortfolioFocusMultiplier(sanitizedFocus, 1),
        combinedEffectiveness: 0,
        countryManagedRisks: {},
        countrySpecificCoverage: {},
        focusEffectivenessMetrics: this.calculateFocusEffectivenessMetrics([], {}, {}, sanitizedFocus)
      };
    }

    const metrics = this.calculatePortfolioMetrics(safeSelected, countryVolumes, countryRisks);
    const baselineRisk = metrics.baselineRisk;
    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(metrics.riskConcentration) && metrics.riskConcentration > 0
      ? Math.max(1, metrics.riskConcentration)
      : 1;

    // Calculate portfolio focus multiplier per specification
    const portfolioFocusMultiplier = this.calculatePortfolioFocusMultiplier(sanitizedFocus, sanitizedConcentration);

    // Calculate country-specific coverage distribution
    const countrySpecificCoverage = this.calculateCountrySpecificCoverage(
      safeSelected, countryVolumes, countryRisks, hrddStrategy, sanitizedFocus
    );

    // Calculate overall responsiveness effectiveness
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);

    // MODIFIED: Calculate country-specific managed risks with rank preservation
    const managedRisksByCountry = {};
    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    let totalWeightedManagedRisk = 0;
    let totalVolume = 0;

    safeSelected.forEach(countryCode => {
      const countryRisk = Number.isFinite(safeCountryRisks[countryCode]) ? safeCountryRisks[countryCode] : 0;
      const countryVolume = Number.isFinite(countryVolumes?.[countryCode]) ? countryVolumes[countryCode] : 10;

      if (countryRisk <= 0) {
        managedRisksByCountry[countryCode] = 0;
        totalVolume += countryVolume;
        return;
      }

      // Calculate country-specific transparency
      const countryTransparency = this.calculateCountryTransparencyEffectiveness(
        countrySpecificCoverage, transparencyEffectiveness, countryCode
      );
      
      // Calculate country-specific focus multiplier
      const riskRatio = baselineRisk > 0 ? countryRisk / baselineRisk : 1;
      const biasedRiskRatio = this.getBiasedRiskRatio(riskRatio, sanitizedFocus, countryRisk, baselineRisk);
      const countryFocusMultiplier = this.calculateCountryFocusMultiplier(
        sanitizedFocus, portfolioFocusMultiplier, biasedRiskRatio, countryRisk
      );
      
      // Calculate base reduction factor
      const baseReductionFactor = countryTransparency * overallResponsivenessEffectiveness * countryFocusMultiplier;
      
      // NEW: Apply progressive effectiveness cap to preserve ranking
      const effectivenessCap = this.calculateProgressiveEffectivenessCap(countryRisk);
      const cappedReductionFactor = Math.min(baseReductionFactor, effectivenessCap);
      
      // Calculate managed risk
      let managedValue = Math.max(0, countryRisk * (1 - cappedReductionFactor));
      
      // MODIFIED: Increased risk floor to prevent extreme reductions
      const riskFloor = countryRisk * 0.25; // Increased from 0.12 to 0.25 (25% minimum retention)
      managedValue = Math.max(managedValue, riskFloor);
      
      managedRisksByCountry[countryCode] = managedValue;
      totalWeightedManagedRisk += managedValue * countryVolume;
      totalVolume += countryVolume;
    });

    // Mathematical specification: M = (Σᵢ wᵢ · mᵢ) / Σᵢ wᵢ
    const managedRisk = totalVolume > 0 ? totalWeightedManagedRisk / totalVolume : 0;

    // NEW: Direct rank preservation constraint to prevent any inversions
    const sortedCountries = safeSelected
      .map(code => ({ 
        code, 
        baseline: safeCountryRisks[code] || 0, 
        managed: managedRisksByCountry[code] || 0,
        volume: Number.isFinite(countryVolumes?.[code]) ? countryVolumes[code] : 10
      }))
      .sort((a, b) => b.baseline - a.baseline); // Sort by baseline risk descending

    // Ensure no rank inversions: each country must have managed risk >= next country + 0.5
    let totalWeightedManagedRiskCorrected = 0;
    let totalVolumeCorrected = 0;
    
    for (let i = 1; i < sortedCountries.length; i++) {
      const current = sortedCountries[i];
      const previous = sortedCountries[i-1];
      
      if (current.managed >= previous.managed) {
        // Force current country to have lower managed risk than previous
        const correctedManagedRisk = Math.max(
          current.baseline * 0.25, // Still respect the 25% floor
          previous.managed - 0.5    // But ensure it's lower than the previous
        );
        managedRisksByCountry[current.code] = correctedManagedRisk;
        current.managed = correctedManagedRisk;
      }
    }
    
    // Recalculate portfolio managed risk with corrected values
    safeSelected.forEach(countryCode => {
      const countryVolume = Number.isFinite(countryVolumes?.[countryCode]) ? countryVolumes[countryCode] : 10;
      const managedValue = managedRisksByCountry[countryCode] || 0;
      totalWeightedManagedRiskCorrected += managedValue * countryVolume;
      totalVolumeCorrected += countryVolume;
    });
    
    const finalManagedRisk = totalVolumeCorrected > 0 ? totalWeightedManagedRiskCorrected / totalVolumeCorrected : managedRisk;

    // Calculate transparency using country-specific coverage
    const overallTransparencyEffectiveness = this.calculateTransparencyEffectiveness(
      hrddStrategy, transparencyEffectiveness, safeSelected, countryVolumes, countryRisks, sanitizedFocus
    );
    
    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

    // Calculate focus effectiveness metrics
    const focusEffectivenessMetrics = this.calculateFocusEffectivenessMetrics(
      safeSelected, safeCountryRisks, managedRisksByCountry, sanitizedFocus
    );

    return {
      managedRisk: finalManagedRisk,
      baselineRisk,
      riskConcentration: sanitizedConcentration,
      portfolioFocusMultiplier,
      combinedEffectiveness,
      countryManagedRisks: managedRisksByCountry,
      countrySpecificCoverage,
      focusEffectivenessMetrics
    };
  }

  // Rest of the existing methods remain the same...
  getFocusWeight() {
    return Number.isFinite(this.focusConcentrationWeight)
      ? Math.max(0, Math.min(100, this.focusConcentrationWeight))
      : 2.75;
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
      const volume = typeof safeVolumes[countryCode] === 'number' ? safeVolumes[countryCode] : 10;
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

  // Step 1: Generate a detailed baseline summary for the current selection
  generateBaselineSummary(selectedCountries, countries, countryRisks, countryVolumes) {
    const safeSelected = Array.isArray(selectedCountries)
      ? selectedCountries
        .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
        .filter(Boolean)
      : [];

    const safeCountryRisks = (countryRisks && typeof countryRisks === 'object') ? countryRisks : {};
    const safeCountryVolumes = (countryVolumes && typeof countryVolumes === 'object') ? countryVolumes : {};
    const safeCountryList = Array.isArray(countries) ? countries : [];

    const countryLookup = safeCountryList.reduce((acc, country) => {
      if (country && typeof country.isoCode === 'string') {
        acc[country.isoCode.toUpperCase()] = country;
      }
      return acc;
    }, {});

    if (safeSelected.length === 0) {
      return {
        baselineRisk: 0,
        riskBand: this.getRiskBand(0),
        riskColor: this.getRiskColor(0),
        portfolio: {
          countriesSelected: 0,
          totalVolume: 0,
          averageRisk: 0,
          riskConcentration: 1,
          weightedRisk: 0
        },
        distribution: {
          byBand: {},
          statistics: {
            minRisk: 0,
            maxRisk: 0,
            averageRisk: 0,
            medianRisk: 0
          }
        },
        countries: [],
        highlights: {
          topRiskCountries: [],
          topVolumeCountries: []
        }
      };
    }

    const metrics = this.calculatePortfolioMetrics(safeSelected, countryVolumes, countryRisks);
    const baselineRisk = Number.isFinite(metrics?.baselineRisk) ? metrics.baselineRisk : 0;
    const totalVolume = Number.isFinite(metrics?.totalVolume) ? metrics.totalVolume : 0;
    const riskConcentration = Number.isFinite(metrics?.riskConcentration) && metrics.riskConcentration > 0
      ? metrics.riskConcentration
      : 1;

    const countryBreakdown = safeSelected.map(code => {
      const risk = Number.isFinite(safeCountryRisks[code]) ? safeCountryRisks[code] : 0;
      const volume = typeof safeCountryVolumes[code] === 'number' ? safeCountryVolumes[code] : 10;
      const countryInfo = countryLookup[code] || {};
      const portfolioShare = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;
      const band = this.getRiskBand(risk);

      return {
        isoCode: code,
        name: typeof countryInfo.name === 'string' ? countryInfo.name : code,
        region: countryInfo.region || countryInfo.subRegion || null,
        risk,
        riskBand: band,
        riskColor: this.getRiskColor(risk),
        volume,
        portfolioShare
      };
    });

    const sortedByRisk = [...countryBreakdown].sort((a, b) => (b.risk || 0) - (a.risk || 0));
    const sortedByVolume = [...countryBreakdown].sort((a, b) => (b.volume || 0) - (a.volume || 0));

    const riskValues = sortedByRisk.map(entry => Number.isFinite(entry.risk) ? entry.risk : 0);
    const riskCount = riskValues.length;
    const sumRisk = riskValues.reduce((sum, value) => sum + value, 0);
    const averageRisk = riskCount > 0 ? sumRisk / riskCount : 0;
    const sortedRiskValues = [...riskValues].sort((a, b) => a - b);
    let medianRisk = 0;
    if (sortedRiskValues.length > 0) {
      const mid = Math.floor(sortedRiskValues.length / 2);
      medianRisk = sortedRiskValues.length % 2 === 0
        ? (sortedRiskValues[mid - 1] + sortedRiskValues[mid]) / 2
        : sortedRiskValues[mid];
    }

    const riskBandCounts = countryBreakdown.reduce((acc, entry) => {
      const band = entry.riskBand || 'Unknown';
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {});

    return {
      baselineRisk,
      riskBand: this.getRiskBand(baselineRisk),
      riskColor: this.getRiskColor(baselineRisk),
      portfolio: {
        countriesSelected: safeSelected.length,
        totalVolume,
        averageRisk: baselineRisk,
        riskConcentration,
        weightedRisk: Number.isFinite(metrics?.weightedRisk) ? metrics.weightedRisk : 0,
        weightedRiskSquares: Number.isFinite(metrics?.weightedRiskSquares) ? metrics.weightedRiskSquares : 0
      },
      distribution: {
        byBand: riskBandCounts,
        statistics: {
          minRisk: sortedRiskValues.length > 0 ? sortedRiskValues[0] : 0,
          maxRisk: sortedRiskValues.length > 0 ? sortedRiskValues[sortedRiskValues.length - 1] : 0,
          averageRisk,
          medianRisk
        }
      },
      countries: sortedByRisk,
      highlights: {
        topRiskCountries: sortedByRisk.slice(0, 5),
        topVolumeCountries: sortedByVolume.slice(0, 5)
      }
    };
  }

  // Calculate country-specific transparency using distributed coverage
  calculateCountryTransparencyEffectiveness(countrySpecificCoverage, transparencyEffectiveness, countryCode) {
    const countryCoverage = countrySpecificCoverage[countryCode];
    if (!countryCoverage || !Array.isArray(countryCoverage)) {
      return 0;
    }

    if (!this.validateHRDDStrategy(countryCoverage) || !this.validateTransparency(transparencyEffectiveness)) {
      return 0;
    }

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

    const maxTransparency = 0.90;
    let combinedTransparency = 0;

    toolCategories.forEach(category => {
      let categoryTransparency = 0;
      let categoryProduct = 1;

      category.tools.forEach((toolIndex, i) => {
        const coverage = Math.max(0, Math.min(100, countryCoverage[toolIndex] || 0)) / 100;
        const baseEff = category.baseEffectiveness[i];
        const userEff = Math.max(0, Math.min(100, transparencyEffectiveness[toolIndex] || 0)) / 100;
        
        const effectiveRate = (baseEff + userEff) / 2;
        categoryProduct *= (1 - coverage * effectiveRate);
      });

      categoryTransparency = 1 - categoryProduct;
      combinedTransparency = 1 - (1 - combinedTransparency) * (1 - categoryTransparency * category.categoryWeight);
    });

    return Math.min(combinedTransparency, maxTransparency);
  }

  // Calculate overall transparency effectiveness using country-specific coverage
  calculateTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness, selectedCountries = null, countryVolumes = null, countryRisks = null, focus = 0.6) {
    if (!selectedCountries || !countryVolumes || !countryRisks) {
      return this.calculateOriginalTransparencyEffectiveness(hrddCoverage, transparencyEffectiveness);
    }

    const countrySpecificCoverage = this.calculateCountrySpecificCoverage(
      selectedCountries, countryVolumes, countryRisks, hrddCoverage, focus
    );

    if (Object.keys(countrySpecificCoverage).length === 0) {
      return 0;
    }

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

    const maxTransparency = 0.90;
    let combinedTransparency = 0;

    toolCategories.forEach(category => {
      let categoryTransparency = 0;
      let categoryProduct = 1;

      category.tools.forEach((toolIndex, i) => {
        const coverage = Math.max(0, Math.min(100, hrddCoverage[toolIndex] || 0)) / 100;
        const baseEff = category.baseEffectiveness[i];
        const userEff = Math.max(0, Math.min(100, transparencyEffectiveness[toolIndex] || 0)) / 100;
        
        const effectiveRate = (baseEff + userEff) / 2;
        categoryProduct *= (1 - coverage * effectiveRate);
      });

      categoryTransparency = 1 - categoryProduct;
      combinedTransparency = 1 - (1 - combinedTransparency) * (1 - categoryTransparency * category.categoryWeight);
    });

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
      const effectiveness = (responsivenessEffectiveness[i] || 0) / 100;

      weightedEffectiveness += strategyWeight * effectiveness;
      totalWeight += strategyWeight;
    }

    return totalWeight > 0 ? weightedEffectiveness / totalWeight : 0;
  }

  // Main managed risk calculation method using new approach
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
    // If we have country-specific data, use the detailed calculation
    if (selectedCountries && countryVolumes && countryRisks) {
      const details = this.calculateManagedRiskDetails(
        selectedCountries,
        countryVolumes,
        countryRisks,
        hrddStrategy,
        transparencyEffectiveness,
        responsivenessStrategy,
        responsivenessEffectiveness,
        focus
      );
      return details.managedRisk;
    }

    // Fallback to original method if country-specific data not available
    if (baselineRisk <= 0) {
      return 0;
    }

    const overallTransparencyEffectiveness = this.calculateOriginalTransparencyEffectiveness(hrddStrategy, transparencyEffectiveness);
    const overallResponsivenessEffectiveness = this.calculateResponsivenessEffectiveness(responsivenessStrategy, responsivenessEffectiveness);
    const combinedEffectiveness = overallTransparencyEffectiveness * overallResponsivenessEffectiveness;

    const sanitizedFocus = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
    const sanitizedConcentration = Number.isFinite(riskConcentration) && riskConcentration > 0
      ? Math.max(1, riskConcentration)
      : 1;

    const portfolioFocusMultiplier = this.calculatePortfolioFocusMultiplier(sanitizedFocus, sanitizedConcentration);
    const managedRisk = baselineRisk * (1 - combinedEffectiveness * portfolioFocusMultiplier);

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
    return this.riskBands[band]?.color || '#64748b';
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
      weight <= 50
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
      '#22c55e',
      '#84cc16',
      '#eab308',
      '#f59e0b',
      '#f97316',
      '#ef4444',
      '#dc2626',
      '#991b1b'
    ];
  }

  // Convert risk score to color index for gradient
  getColorIndex(score, maxIndex = 7) {
    const normalizedScore = Math.max(0, Math.min(100, score)) / 100;
    return Math.floor(normalizedScore * maxIndex);
  }

  // Get strategy effectiveness breakdown with country-specific coverage
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
    const portfolioFocusMultiplier = this.calculatePortfolioFocusMultiplier(sanitizedFocus, sanitizedConcentration);

    const defaultStrategy = Array.isArray(this.defaultHRDDStrategy)
      ? this.defaultHRDDStrategy
      : [];
    const defaultTransparency = Array.isArray(this.defaultTransparencyEffectiveness)
      ? this.defaultTransparencyEffectiveness
      : [];
    const toolCount = Array.isArray(this.hrddStrategyLabels) && this.hrddStrategyLabels.length > 0
      ? this.hrddStrategyLabels.length
      : Math.max(
        defaultStrategy.length,
        defaultTransparency.length,
        Array.isArray(hrddStrategy) ? hrddStrategy.length : 0
      );

    const normalizedStrategy = new Array(toolCount).fill(0);
    const normalizedTransparency = new Array(toolCount).fill(0);

    for (let i = 0; i < toolCount; i++) {
      const strategyValue = Array.isArray(hrddStrategy) ? Number(hrddStrategy[i]) : NaN;
      const fallbackStrategyValue = Number(defaultStrategy[i]);
      const resolvedStrategyValue = Number.isFinite(strategyValue)
        ? strategyValue
        : (Number.isFinite(fallbackStrategyValue) ? fallbackStrategyValue : 0);
      normalizedStrategy[i] = Math.max(0, Math.min(100, resolvedStrategyValue));

      const transparencyValue = Array.isArray(transparencyEffectiveness) ? Number(transparencyEffectiveness[i]) : NaN;
      const fallbackTransparencyValue = Number(defaultTransparency[i]);
      const resolvedTransparencyValue = Number.isFinite(transparencyValue)
        ? transparencyValue
        : (Number.isFinite(fallbackTransparencyValue) ? fallbackTransparencyValue : 0);
      normalizedTransparency[i] = Math.max(0, Math.min(100, resolvedTransparencyValue));
    }

    const safeSelectedCountries = Array.isArray(selectedCountries)
      ? selectedCountries.filter(code => typeof code === 'string' && code.length > 0)
      : [];

    const overallTransparency = safeSelectedCountries.length > 0 && countryVolumes && countryRisks
      ? this.calculateTransparencyEffectiveness(
        normalizedStrategy,
        normalizedTransparency,
        safeSelectedCountries,
        countryVolumes,
        countryRisks,
        sanitizedFocus
      )
      : this.calculateOriginalTransparencyEffectiveness(normalizedStrategy, normalizedTransparency);

    const countrySpecificCoverage = safeSelectedCountries.length > 0 && countryVolumes && countryRisks
      ? this.calculateCountrySpecificCoverage(safeSelectedCountries, countryVolumes, countryRisks, normalizedStrategy, sanitizedFocus)
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
        portfolioMultiplier: portfolioFocusMultiplier
      },
       countrySpecificCoverage: countrySpecificCoverage
    };

    for (let i = 0; i < normalizedStrategy.length; i++) {
      const baseCoverage = Math.max(0, Math.min(100, normalizedStrategy[i] || 0));
      const userEffectiveness = Math.max(0, Math.min(100, normalizedTransparency[i] || 0));

      let category = toolCategories.find(cat => cat.tools.includes(i));
      if (!category) category = { name: 'Other', baseEffectiveness: [0.05], categoryWeight: 0.5 };

      const toolIndexInCategory = category.tools ? category.tools.indexOf(i) : 0;
      const baseEffectiveness = category.baseEffectiveness[toolIndexInCategory] || 0.05;
      const averageEffectiveness = (baseEffectiveness + userEffectiveness / 100) / 2;

      let coverageRange = null;
      if (countrySpecificCoverage && safeSelectedCountries.length > 0) {
        const coverages = safeSelectedCountries.map(countryCode =>
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
        name: Array.isArray(this.hrddStrategyLabels) && this.hrddStrategyLabels[i]
          ? this.hrddStrategyLabels[i]
          : `Tool ${i + 1}`,
        coverage: baseCoverage,
        coverageRange: coverageRange,
        baseEffectiveness: Math.round(baseEffectiveness * 100),
        userEffectiveness: userEffectiveness,
        averageEffectiveness: Math.round(averageEffectiveness * 100),
        category: category.name,
        contribution: baseCoverage * averageEffectiveness
      });
    }

    return breakdown;
  }

   getPrimaryResponseMethod(responsivenessStrategy, responsivenessEffectiveness) {
    const fallbackStrategy = Array.isArray(this.defaultResponsivenessStrategy)
      ? this.defaultResponsivenessStrategy
      : [];
    const safeStrategy = Array.isArray(responsivenessStrategy) && responsivenessStrategy.length > 0
      ? responsivenessStrategy
      : fallbackStrategy;

    const fallbackEffectiveness = Array.isArray(this.defaultResponsivenessEffectiveness)
      ? this.defaultResponsivenessEffectiveness
      : [];
    const safeEffectiveness = Array.isArray(responsivenessEffectiveness) && responsivenessEffectiveness.length > 0
      ? responsivenessEffectiveness
      : fallbackEffectiveness;

    if (!Array.isArray(safeStrategy) || safeStrategy.length === 0) {
      const defaultLabel = Array.isArray(this.responsivenessLabels) && this.responsivenessLabels.length > 0
        ? this.responsivenessLabels[0]
        : 'Not specified';
      const defaultEffectiveness = Number.isFinite(safeEffectiveness[0]) ? safeEffectiveness[0] : 0;

      return {
        method: defaultLabel,
        weight: 0,
        effectiveness: defaultEffectiveness
      };
    }

    let maxWeight = -Infinity;
    let primaryIndex = 0;

    for (let i = 0; i < safeStrategy.length; i += 1) {
      const weight = Number.isFinite(safeStrategy[i]) ? safeStrategy[i] : 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        primaryIndex = i;
      }
    }

    if (!Number.isFinite(maxWeight) || maxWeight < 0) {
      maxWeight = 0;
      primaryIndex = 0;
    }

    const labelIndex = Array.isArray(this.responsivenessLabels) && this.responsivenessLabels.length > 0
      ? Math.min(primaryIndex, this.responsivenessLabels.length - 1)
      : 0;
    const effectivenessIndex = safeEffectiveness.length > 0
      ? Math.min(primaryIndex, safeEffectiveness.length - 1)
      : 0;

    return {
      method: this.responsivenessLabels?.[labelIndex] || 'Not specified',
      weight: Math.max(0, Number.isFinite(maxWeight) ? maxWeight : 0),
      effectiveness: Number.isFinite(safeEffectiveness?.[effectivenessIndex])
        ? safeEffectiveness[effectivenessIndex]
        : 0
    };
  }

  // Generate risk assessment summary with country-specific data
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
    const safeSelectedCountries = Array.isArray(selectedCountries) ? selectedCountries : [];

    // Use detailed calculation if data available
    if (safeSelectedCountries && countryVolumes && countryRisks) {
      const details = this.calculateManagedRiskDetails(
        safeSelectedCountries,
        countryVolumes,
        countryRisks,
        hrddStrategy,
        transparencyEffectiveness,
        responsivenessStrategy,
        responsivenessEffectiveness,
        focus
      );

      const riskReduction = this.calculateRiskReduction(details.baselineRisk, details.managedRisk);
      const breakdown = this.getStrategyBreakdown(
        hrddStrategy,
        transparencyEffectiveness,
        responsivenessStrategy,
        responsivenessEffectiveness,
        focus,
        details.riskConcentration,
        selectedCountries,
        countryVolumes,
        countryRisks
      );

      return {
        baseline: {
          score: details.baselineRisk,
          band: this.getRiskBand(details.baselineRisk),
          color: this.getRiskColor(details.baselineRisk)
        },
        managed: {
          score: details.managedRisk,
          band: this.getRiskBand(details.managedRisk),
          color: this.getRiskColor(details.managedRisk)
        },
        improvement: {
          riskReduction: riskReduction,
          absoluteReduction: details.baselineRisk - details.managedRisk,
          isImprovement: details.managedRisk < details.baselineRisk
        },
        portfolio: {
          countriesSelected: selectedCountries.length,
          averageRisk: details.baselineRisk,
          riskConcentration: details.riskConcentration
        },
        strategy: breakdown,
        focusEffectiveness: details.focusEffectivenessMetrics,
        countryManagedRisks: details.countryManagedRisks
      };
    }

    // Fallback for cases without country-specific data
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
    const portfolioFocusMultiplier = this.calculatePortfolioFocusMultiplier(focusValue, riskConcentration);

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '6.1',
        toolName: 'HRDD Risk Assessment Tool - Rank Preservation Enhanced'
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
        portfolioFocusMultiplier,
        methodology: 'Enhanced with rank preservation mechanisms'
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


  // Panel 6 Budget Analysis Methods (conditionally available)
  // Panel 6 Budget Analysis Methods (conditionally available)

// Default cost assumptions - grouped together for easy modification
getDefaultCostAssumptions() {
  return {
    // Panel 3 Tool Costs (6 tools)
    toolAnnualProgrammeCosts: [100, 100, 100, 100, 100, 100], // Fixed annual programme costs
    toolPerSupplierCosts: [100, 100, 100, 100, 100, 100],     // Variable per-supplier costs  
    toolInternalHours: [100, 100, 100, 100, 100, 100],        // Internal hours per supplier per tool
    
    // Panel 4 Response Method Costs (6 methods)
    responseInternalHours: [100, 100, 100, 100, 100, 100],    // Internal hours per supplier per response method
    
    // General defaults
    defaultSupplierCount: 250,
    defaultHourlyRate: 40
  };
}

 calculateBudgetAnalysis(
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
  ) {

  // Check if Panel 6 is enabled (this will be available globally)
  if (typeof window !== 'undefined' && window.hrddApp && !window.hrddApp.ENABLE_PANEL_6) {
    return null;
  }

  const defaults = this.getDefaultCostAssumptions();
 const safeSupplierCount = Math.max(1, Math.floor(supplierCount || 1));
    const safeHourlyRate = Math.max(0, Number.isFinite(hourlyRate) ? hourlyRate : 20);

    const toolCount = Array.isArray(this.hrddStrategyLabels)
      ? this.hrddStrategyLabels.length
      : 6;
    const responseCount = Array.isArray(this.responsivenessLabels)
      ? this.responsivenessLabels.length
      : 6;

    const safeAnnualProgrammeCosts = Array.from({ length: toolCount }, (_, index) => {
      const value = Array.isArray(toolAnnualProgrammeCosts)
        ? toolAnnualProgrammeCosts[index]
        : undefined;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const safePerSupplierCosts = Array.from({ length: toolCount }, (_, index) => {
      const value = Array.isArray(toolPerSupplierCosts)
        ? toolPerSupplierCosts[index]
        : undefined;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const safeToolInternalHours = Array.from({ length: toolCount }, (_, index) => {
      const value = Array.isArray(toolInternalHours)
        ? toolInternalHours[index]
        : undefined;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const safeResponseInternalHours = Array.from({ length: responseCount }, (_, index) => {
      const value = Array.isArray(responseInternalHours)
        ? responseInternalHours[index]
        : undefined;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const safeHrddStrategy = Array.from({ length: toolCount }, (_, index) => {
      const value = Array.isArray(hrddStrategy) ? hrddStrategy[index] : undefined;
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });

    const safeResponsivenessStrategy = Array.from({ length: responseCount }, (_, index) => {
      const value = Array.isArray(responsivenessStrategy)
        ? responsivenessStrategy[index]
        : Array.isArray(this.defaultResponsivenessStrategy)
          ? this.defaultResponsivenessStrategy[index]
          : 0;
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });

    // Calculate actual deployment per tool based on coverage percentages
    const toolDeployments = safeHrddStrategy.map((coverage, index) => {
      const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
      const suppliersUsingTool = Math.ceil(safeSupplierCount * coverageRatio);

      const annualProgrammeBase = safeAnnualProgrammeCosts[index] || 0;
      const annualProgrammeCost = annualProgrammeBase * coverageRatio;
      const perSupplierCost = safePerSupplierCosts[index] || 0;
      const hoursPerSupplier = safeToolInternalHours[index] || 0;

      const totalExternalCost = annualProgrammeCost + (suppliersUsingTool * perSupplierCost);
      const totalInternalCost = suppliersUsingTool * hoursPerSupplier * safeHourlyRate;
      const totalCost = totalExternalCost + totalInternalCost;

      return {
        toolIndex: index,
        toolName: Array.isArray(this.hrddStrategyLabels)
          ? this.hrddStrategyLabels[index]
          : `Tool ${index + 1}`,
        coverage,
        suppliersUsingTool,
        annualProgrammeBase,
        annualProgrammeCost,
        perSupplierCost,
        externalCostPerSupplier: suppliersUsingTool > 0
          ? totalExternalCost / suppliersUsingTool
          : perSupplierCost,
        hoursPerSupplier,
        totalExternalCost,
        totalInternalCost,
        totalCost
      };
    });

    const responseDeployments = safeResponsivenessStrategy.map((coverage, index) => {
      const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
      const suppliersUsingMethod = Math.ceil(safeSupplierCount * coverageRatio);
      const hoursPerSupplier = safeResponseInternalHours[index] || 0;

      const totalInternalCost = suppliersUsingMethod * hoursPerSupplier * safeHourlyRate;

      return {
        responseIndex: index,
        responseName: Array.isArray(this.responsivenessLabels)
          ? this.responsivenessLabels[index]
          : `Response ${index + 1}`,
        coverage,
        suppliersUsingMethod,
        hoursPerSupplier,
        totalInternalCost
      };
    });

    const totalExternalCost = toolDeployments.reduce((sum, tool) => sum + tool.totalExternalCost, 0);
    const totalToolInternalCost = toolDeployments.reduce((sum, tool) => sum + tool.totalInternalCost, 0);
    const totalResponseInternalCost = responseDeployments.reduce((sum, response) => sum + response.totalInternalCost, 0);
    const totalInternalCost = totalToolInternalCost + totalResponseInternalCost;
    const totalBudget = totalExternalCost + totalInternalCost;

    return {
      supplierCount: safeSupplierCount,
      hourlyRate: safeHourlyRate,
      totalExternalCost,
      totalInternalCost,
      totalToolInternalCost,
      totalResponseInternalCost,
      totalBudget,
      costPerSupplier: totalBudget / safeSupplierCount,
      toolDeployments,
      responseDeployments,
      currentAllocation: safeHrddStrategy,
      responseAllocation: safeResponsivenessStrategy
    };
  }

  // Enhanced budget optimization algorithm for the RiskEngine class
// Replace the existing optimizeBudgetAllocation method with this improved version

optimizeBudgetAllocation(
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
) {
  // Check if Panel 6 is enabled
  if (typeof window !== 'undefined' && window.hrddApp && !window.hrddApp.ENABLE_PANEL_6) {
    return null;
  }

  // Calculate current budget and effectiveness
  const currentBudget = this.calculateBudgetAnalysis(
    supplierCount, hourlyRate, toolAnnualProgrammeCosts, toolPerSupplierCosts,
    toolInternalHours, responseInternalHours, hrddStrategy, transparencyEffectiveness,
    responsivenessStrategy, responsivenessEffectiveness, selectedCountries,
    countryVolumes, countryRisks, focus
  );

  if (!currentBudget) return null;

  const targetBudget = currentBudget.totalBudget;
  const budgetTolerance = targetBudget * 0.05; // 5% tolerance

  // Enhanced cost calculation function
  const calculateAllocationCost = (toolAllocation, responseAllocation) => {
    let totalCost = 0;
    const safeSupplierCount = Math.max(1, Math.floor(supplierCount));
    const safeHourlyRate = Math.max(0, parseFloat(hourlyRate) || 0);
    
    // Panel 3 tool costs
    toolAllocation.forEach((coverage, index) => {
      const coverageRatio = Math.max(0, Math.min(1, coverage / 100));
      const suppliersUsingTool = Math.ceil(safeSupplierCount * coverageRatio);
      const annualCost = (toolAnnualProgrammeCosts[index] || 0) * coverageRatio;
      const perSupplierCost = (toolPerSupplierCosts[index] || 0) * suppliersUsingTool;
      const internalCost = suppliersUsingTool * (toolInternalHours[index] || 0) * safeHourlyRate;
      totalCost += annualCost + perSupplierCost + internalCost;
    });
    
    // Panel 4 response method costs
    responseAllocation.forEach((allocation, index) => {
      const effectiveSuppliers = Math.ceil(safeSupplierCount * (allocation / 100));
      const internalCost = effectiveSuppliers * (responseInternalHours[index] || 0) * safeHourlyRate;
      totalCost += internalCost;
    });
    
    return totalCost;
  };

  // Enhanced evaluation function with penalty for budget violations
  const evaluateAllocation = (toolAllocation, responseAllocation) => {
    // Maintain voice linkage constraint
    const linkedResponseAllocation = [...responseAllocation];
    linkedResponseAllocation[0] = toolAllocation[0];

    const cost = calculateAllocationCost(toolAllocation, linkedResponseAllocation);
    const budgetViolation = Math.abs(cost - targetBudget);
    
    // Calculate risk reduction effectiveness
    const details = this.calculateManagedRiskDetails(
      selectedCountries, countryVolumes, countryRisks,
      toolAllocation, transparencyEffectiveness,
      linkedResponseAllocation, responsivenessEffectiveness, focus
    );
    
    let fitness = details.managedRisk;
    
    // Apply budget penalty (exponential penalty for violations > tolerance)
    if (budgetViolation > budgetTolerance) {
      const penaltyFactor = Math.pow(budgetViolation / budgetTolerance, 2);
      fitness += penaltyFactor * 10; // Heavy penalty for budget violations
    }
    
    return { 
      managedRisk: details.managedRisk, 
      cost, 
      fitness, 
      budgetViolation,
      responseAllocation: linkedResponseAllocation 
    };
  };

  // Initialize tracking variables
  let bestToolAllocation = [...hrddStrategy];
  let bestResponseAllocation = [...responsivenessStrategy];
  let bestFitness = Infinity;
  let bestResult = null;

  // Calculate current performance baseline
  const currentResult = evaluateAllocation(hrddStrategy, responsivenessStrategy);
  bestFitness = currentResult.fitness;
  bestResult = currentResult;

  const updateProgress = (iteration, total, strategy) => {
    if (typeof document !== 'undefined') {
      const progressEl = document.getElementById('optimizationProgress');
      if (progressEl) {
        progressEl.textContent = `${strategy} (${iteration}/${total})`;
      }
    }
  };

  // PHASE 1: SIMULATED ANNEALING GLOBAL SEARCH
  const runSimulatedAnnealing = (startingTools, startingResponses, iterations = 200) => {
    let currentTools = [...startingTools];
    let currentResponses = [...startingResponses];
    let currentResult = evaluateAllocation(currentTools, currentResponses);
    
    let localBestTools = [...currentTools];
    let localBestResponses = [...currentResult.responseAllocation];
    let localBestFitness = currentResult.fitness;
    
    const initialTemp = 20.0;
    const coolingRate = 0.95;
    let temperature = initialTemp;
    
    for (let i = 0; i < iterations; i++) {
      // Generate neighbor solution
      const newTools = currentTools.map((val, idx) => {
        const stepSize = Math.random() * 20 - 10; // -10 to +10
        const voiceBonus = idx === 0 ? 5 : 0; // Favor continuous voice increases
        return Math.max(5, Math.min(95, val + stepSize + voiceBonus * Math.random()));
      });
      
      const newResponses = currentResponses.map((val, idx) => {
        if (idx === 0) return newTools[0]; // Voice linkage
        const stepSize = Math.random() * 16 - 8; // -8 to +8
        return Math.max(5, Math.min(95, val + stepSize));
      });
      
      const newResult = evaluateAllocation(newTools, newResponses);
      
      // Accept or reject based on simulated annealing criteria
      const deltaFitness = newResult.fitness - currentResult.fitness;
      const acceptProbability = deltaFitness <= 0 ? 1.0 : Math.exp(-deltaFitness / temperature);
      
      if (Math.random() < acceptProbability) {
        currentTools = newTools;
        currentResponses = newResult.responseAllocation;
        currentResult = newResult;
        
        // Track local best
        if (newResult.fitness < localBestFitness) {
          localBestTools = [...newTools];
          localBestResponses = [...newResult.responseAllocation];
          localBestFitness = newResult.fitness;
        }
      }
      
      temperature *= coolingRate;
    }
    
    return { tools: localBestTools, responses: localBestResponses, fitness: localBestFitness };
  };

  // PHASE 2: GENETIC ALGORITHM WITH MULTIPLE POPULATIONS
  const runGeneticAlgorithm = (generations = 150, populationSize = 20) => {
    // Initialize diverse population
    const population = [];
    
    // Add strategic starting points
    const strategies = [
      { tools: [70, 40, 15, 30, 60, 80], responses: [70, 10, 20, 15, 10, 5] },
      { tools: [25, 15, 60, 35, 75, 85], responses: [25, 15, 35, 20, 10, 10] },
      { tools: [50, 35, 35, 25, 55, 70], responses: [50, 15, 30, 25, 15, 5] },
      { tools: [85, 55, 45, 20, 45, 60], responses: [85, 20, 25, 15, 5, 5] },
      { tools: [...hrddStrategy], responses: [...responsivenessStrategy] }
    ];
    
    strategies.forEach(strategy => {
      population.push({
        tools: [...strategy.tools],
        responses: [...strategy.responses],
        fitness: Infinity
      });
    });
    
    // Add random individuals to fill population
    while (population.length < populationSize) {
      const randomTools = Array.from({ length: 6 }, () => Math.random() * 90 + 5);
      const randomResponses = Array.from({ length: 6 }, (_, i) => 
        i === 0 ? randomTools[0] : Math.random() * 90 + 5
      );
      
      population.push({
        tools: randomTools,
        responses: randomResponses,
        fitness: Infinity
      });
    }
    
    // Evaluate initial population
    population.forEach(individual => {
      const result = evaluateAllocation(individual.tools, individual.responses);
      individual.fitness = result.fitness;
      individual.responseAllocation = result.responseAllocation;
    });
    
    // Evolution loop
    for (let gen = 0; gen < generations; gen++) {
      updateProgress(gen + 1, generations, `Genetic Algorithm Gen`);
      
      // Selection: tournament selection
      const selectParent = () => {
        const tournamentSize = 3;
        let best = population[Math.floor(Math.random() * population.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
          const candidate = population[Math.floor(Math.random() * population.length)];
          if (candidate.fitness < best.fitness) {
            best = candidate;
          }
        }
        return best;
      };
      
      // Create next generation
      const newPopulation = [];
      
      // Keep best 20% (elitism)
      const sorted = [...population].sort((a, b) => a.fitness - b.fitness);
      const eliteCount = Math.floor(populationSize * 0.2);
      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push({ ...sorted[i] });
      }
      
      // Generate offspring
      while (newPopulation.length < populationSize) {
        const parent1 = selectParent();
        const parent2 = selectParent();
        
        // Crossover
        const child = { tools: [], responses: [], fitness: Infinity };
        for (let i = 0; i < 6; i++) {
          // Blend crossover with mutation
          const alpha = 0.5 + (Math.random() - 0.5) * 0.3;
          const toolValue = alpha * parent1.tools[i] + (1 - alpha) * parent2.tools[i];
          const responseValue = i === 0 ? toolValue : // Voice linkage
            alpha * parent1.responses[i] + (1 - alpha) * parent2.responses[i];
          
          // Add mutation
          const mutationStrength = 8;
          const toolMutation = (Math.random() - 0.5) * mutationStrength;
          const responseMutation = (Math.random() - 0.5) * mutationStrength;
          
          child.tools[i] = Math.max(5, Math.min(95, toolValue + toolMutation));
          child.responses[i] = Math.max(5, Math.min(95, 
            i === 0 ? child.tools[i] : responseValue + responseMutation
          ));
        }
        
        // Evaluate child
        const result = evaluateAllocation(child.tools, child.responses);
        child.fitness = result.fitness;
        child.responseAllocation = result.responseAllocation;
        
        newPopulation.push(child);
      }
      
      population.splice(0, population.length, ...newPopulation);
    }
    
    // Return best individual
    const best = population.reduce((best, current) => 
      current.fitness < best.fitness ? current : best
    );
    
    return { tools: best.tools, responses: best.responseAllocation, fitness: best.fitness };
  };

  // PHASE 3: ADVANCED LOCAL SEARCH
  const runAdvancedLocalSearch = (startingTools, startingResponses, iterations = 100) => {
    let currentTools = [...startingTools];
    let currentResponses = [...startingResponses];
    let currentResult = evaluateAllocation(currentTools, currentResponses);
    
    const directions = [
      [1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 1],
      [-1, 0, 0, 0, 0, 0], [0, -1, 0, 0, 0, 0], [0, 0, -1, 0, 0, 0],
      [0, 0, 0, -1, 0, 0], [0, 0, 0, 0, -1, 0], [0, 0, 0, 0, 0, -1]
    ];
    
    for (let iter = 0; iter < iterations; iter++) {
      let improved = false;
      const stepSize = Math.max(2, 15 * (1 - iter / iterations)); // Decreasing step size
      
      // Try each direction for tools
      for (const direction of directions) {
        const newTools = currentTools.map((val, idx) => 
          Math.max(5, Math.min(95, val + direction[idx] * stepSize))
        );
        
        const newResponses = [...currentResponses];
        newResponses[0] = newTools[0]; // Maintain voice linkage
        
        const result = evaluateAllocation(newTools, newResponses);
        
        if (result.fitness < currentResult.fitness) {
          currentTools = newTools;
          currentResponses = result.responseAllocation;
          currentResult = result;
          improved = true;
          break;
        }
      }
      
      // Try response methods (excluding voice which is linked)
      if (!improved) {
        for (let respIdx = 1; respIdx < 6; respIdx++) {
          for (const step of [stepSize, -stepSize]) {
            const newResponses = [...currentResponses];
            newResponses[respIdx] = Math.max(5, Math.min(95, newResponses[respIdx] + step));
            
            const result = evaluateAllocation(currentTools, newResponses);
            
            if (result.fitness < currentResult.fitness) {
              currentResponses = result.responseAllocation;
              currentResult = result;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
      
      if (!improved) break; // Local optimum reached
    }
    
    return { tools: currentTools, responses: currentResponses, fitness: currentResult.fitness };
  };

  // Execute optimization phases
  const totalPhases = 3;
  let phase = 1;
  
  // Phase 1: Simulated Annealing from multiple starting points
  updateProgress(0, 100, `Phase ${phase}/${totalPhases}: Simulated Annealing`);
  
  const saStartingPoints = [
    { tools: [...hrddStrategy], responses: [...responsivenessStrategy] },
    { tools: [70, 40, 15, 30, 60, 80], responses: [70, 10, 20, 15, 10, 5] },
    { tools: [25, 15, 60, 35, 75, 85], responses: [25, 15, 35, 20, 10, 10] },
    { tools: [85, 55, 45, 20, 45, 60], responses: [85, 20, 25, 15, 5, 5] }
  ];
  
  for (const startPoint of saStartingPoints) {
    const saResult = runSimulatedAnnealing(startPoint.tools, startPoint.responses, 150);
    if (saResult.fitness < bestFitness) {
      bestToolAllocation = [...saResult.tools];
      bestResponseAllocation = [...saResult.responses];
      bestFitness = saResult.fitness;
    }
  }
  
  phase++;
  
  // Phase 2: Genetic Algorithm
  updateProgress(0, 100, `Phase ${phase}/${totalPhases}: Genetic Algorithm`);
  const gaResult = runGeneticAlgorithm(120, 18);
  if (gaResult.fitness < bestFitness) {
    bestToolAllocation = [...gaResult.tools];
    bestResponseAllocation = [...gaResult.responses];
    bestFitness = gaResult.fitness;
  }
  
  phase++;
  
  // Phase 3: Advanced Local Search from best solutions
  updateProgress(0, 100, `Phase ${phase}/${totalPhases}: Local Search Refinement`);
  const localResult = runAdvancedLocalSearch(bestToolAllocation, bestResponseAllocation, 80);
  if (localResult.fitness < bestFitness) {
    bestToolAllocation = [...localResult.tools];
    bestResponseAllocation = [...localResult.responses];
    bestFitness = localResult.fitness;
  }
  
  // Final evaluation and result generation
  const finalResult = evaluateAllocation(bestToolAllocation, bestResponseAllocation);
  const optimizedDetails = this.calculateManagedRiskDetails(
    selectedCountries, countryVolumes, countryRisks,
    bestToolAllocation, transparencyEffectiveness,
    bestResponseAllocation, responsivenessEffectiveness, focus
  );
  
  // Calculate improvements
  const currentDetails = this.calculateManagedRiskDetails(
    selectedCountries, countryVolumes, countryRisks,
    hrddStrategy, transparencyEffectiveness,
    responsivenessStrategy, responsivenessEffectiveness, focus
  );
  
  const currentEffectiveness = currentDetails.managedRisk < currentDetails.baselineRisk ?
    ((currentDetails.baselineRisk - currentDetails.managedRisk) / currentDetails.baselineRisk * 100) : 0;
  const optimizedEffectiveness = optimizedDetails.managedRisk < optimizedDetails.baselineRisk ?
    ((optimizedDetails.baselineRisk - optimizedDetails.managedRisk) / optimizedDetails.baselineRisk * 100) : 0;
  
  const improvement = optimizedEffectiveness - currentEffectiveness;
  const voiceIncrease = bestToolAllocation[0] - hrddStrategy[0];
  
  // Generate insight
  let insight = '';
  if (improvement > 8) {
    insight = `Major optimization opportunity found: ${improvement.toFixed(1)}% better risk reduction through advanced multi-phase optimization. `;
    if (voiceIncrease > 10) {
      insight += `Key finding: significantly increase continuous worker voice coverage (+${voiceIncrease.toFixed(0)}%). `;
    }
    insight += `The enhanced algorithm tested multiple solution approaches to find this optimal configuration.`;
  } else if (improvement > 3) {
    insight = `Significant optimization achieved (${improvement.toFixed(1)}% improvement) through comprehensive analysis of tool and response combinations using genetic algorithms and simulated annealing.`;
  } else if (improvement > 0.5) {
    insight = `Moderate optimization identified (${improvement.toFixed(1)}% improvement). The multi-phase approach found incremental improvements through strategic reallocation.`;
  } else {
    insight = `Your current allocation is already well-optimized. The comprehensive multi-phase analysis (simulated annealing + genetic algorithm + local search) found minimal improvement opportunities within budget constraints.`;
  }
  
  // Clear progress indicator
  updateProgress(100, 100, 'Optimization Complete');
  
  return {
    baselineRisk: currentDetails.baselineRisk,
    currentManagedRisk: currentDetails.managedRisk,
    optimizedManagedRisk: optimizedDetails.managedRisk,
    currentToolAllocation: hrddStrategy,
    currentResponseAllocation: responsivenessStrategy,
    optimizedToolAllocation: bestToolAllocation,
    optimizedResponseAllocation: bestResponseAllocation,
    currentEffectiveness,
    optimizedEffectiveness,
    improvement,
    insight,
    budgetUtilization: Math.abs(finalResult.cost - targetBudget) < budgetTolerance ? 100 : 
      (finalResult.cost / targetBudget * 100),
    budgetConstraintMet: finalResult.budgetViolation <= budgetTolerance,
    finalBudget: finalResult.cost,
    targetBudget,
    algorithmsUsed: ['Simulated Annealing', 'Genetic Algorithm', 'Advanced Local Search'],
    
    // Enhanced breakdown
    toolChanges: bestToolAllocation.map((alloc, i) => ({
      tool: this.hrddStrategyLabels[i],
      current: hrddStrategy[i],
      optimized: alloc,
      change: alloc - hrddStrategy[i]
    })),
    responseChanges: bestResponseAllocation.map((alloc, i) => ({
      method: this.responsivenessLabels[i],
      current: responsivenessStrategy[i],
      optimized: alloc,
      change: alloc - responsivenessStrategy[i]
    }))
  };
}

  // Helper method to adjust allocation to target budget
  // Helper method to adjust both tool and response allocations to target budget
adjustCombinedAllocationToTargetBudget(toolAllocation, responseAllocation, targetBudget, calculateCost) {
  const maxAdjustments = 30;
  let adjustments = 0;
  let currentToolAllocation = [...toolAllocation];
  let currentResponseAllocation = [...responseAllocation];
  
  while (adjustments < maxAdjustments) {
    const currentCost = calculateCost(currentToolAllocation, currentResponseAllocation);
    const difference = currentCost - targetBudget;
    
    if (Math.abs(difference) < targetBudget * 0.05) break; // Within 5% tolerance
    
    if (difference > 0) {
      // Cost too high, reduce allocations strategically
      // Priority: reduce non-voice tools first, then response methods, then voice as last resort
      
      const nonVoiceToolsWithRoom = [1, 2, 3, 4, 5].filter(i => currentToolAllocation[i] > 10);
      const responseMethodsWithRoom = [1, 2, 3, 4, 5].filter(i => currentResponseAllocation[i] > 10);
      
      if (nonVoiceToolsWithRoom.length > 0) {
        const toolToReduce = nonVoiceToolsWithRoom[Math.floor(Math.random() * nonVoiceToolsWithRoom.length)];
        currentToolAllocation[toolToReduce] = Math.max(5, currentToolAllocation[toolToReduce] - 8);
      } else if (responseMethodsWithRoom.length > 0) {
        const methodToReduce = responseMethodsWithRoom[Math.floor(Math.random() * responseMethodsWithRoom.length)];
        currentResponseAllocation[methodToReduce] = Math.max(5, currentResponseAllocation[methodToReduce] - 8);
      } else if (currentToolAllocation[0] > 15) {
        // Reduce voice only if necessary and not too low
        currentToolAllocation[0] = Math.max(10, currentToolAllocation[0] - 5);
        currentResponseAllocation[0] = currentToolAllocation[0]; // Maintain linkage
      }
    } else {
      // Cost too low, increase allocations strategically
      // Priority: increase voice first, then high-impact tools/methods
      
      if (currentToolAllocation[0] < 85) {
        currentToolAllocation[0] = Math.min(95, currentToolAllocation[0] + 8);
        currentResponseAllocation[0] = currentToolAllocation[0]; // Maintain linkage
      } else if (currentToolAllocation[2] < 85) { // Unannounced audits
        currentToolAllocation[2] = Math.min(95, currentToolAllocation[2] + 6);
      } else if (currentResponseAllocation[1] < 85) { // Commercial levers
        currentResponseAllocation[1] = Math.min(95, currentResponseAllocation[1] + 6);
      } else {
        // Increase random allocation
        const isToolIncrease = Math.random() < 0.6; // 60% chance to increase tools
        if (isToolIncrease) {
          const toolToIncrease = Math.floor(Math.random() * 6);
          if (currentToolAllocation[toolToIncrease] < 90) {
            currentToolAllocation[toolToIncrease] = Math.min(95, currentToolAllocation[toolToIncrease] + 5);
            if (toolToIncrease === 0) {
              currentResponseAllocation[0] = currentToolAllocation[0]; // Maintain linkage
            }
          }
        } else {
          const methodToIncrease = Math.floor(Math.random() * 6);
          if (currentResponseAllocation[methodToIncrease] < 90) {
            currentResponseAllocation[methodToIncrease] = Math.min(95, currentResponseAllocation[methodToIncrease] + 5);
            if (methodToIncrease === 0) {
              currentToolAllocation[0] = currentResponseAllocation[0]; // Maintain linkage
            }
          }
        }
      }
    }
    
    adjustments++;
  }
  
  return [currentToolAllocation, currentResponseAllocation];
}

// Helper method to adjust allocation to target budget (legacy method kept for compatibility)
adjustToTargetBudget(allocation, targetBudget, calculateCost) {
  const maxAdjustments = 20;
  let adjustments = 0;
  
  while (adjustments < maxAdjustments) {
    const currentCost = calculateCost(allocation);
    const difference = currentCost - targetBudget;
    
    if (Math.abs(difference) < targetBudget * 0.03) break; // Within 3% tolerance
    
    if (difference > 0) {
      // Cost too high, reduce allocation (avoid reducing continuous voice if possible)
      const nonVoiceTools = [1, 2, 3, 4, 5].filter(i => allocation[i] > 10);
      if (nonVoiceTools.length > 0) {
        const toolToReduce = nonVoiceTools[Math.floor(Math.random() * nonVoiceTools.length)];
        allocation[toolToReduce] = Math.max(5, allocation[toolToReduce] - 5);
      } else if (allocation[0] > 10) {
        allocation[0] = Math.max(5, allocation[0] - 5);
      }
    } else {
      // Cost too low, increase allocation (prefer continuous voice)
      if (allocation[0] < 90) {
        allocation[0] = Math.min(95, allocation[0] + 5);
      } else {
        const toolToIncrease = Math.floor(Math.random() * 6);
        if (allocation[toolToIncrease] < 90) {
          allocation[toolToIncrease] = Math.min(95, allocation[toolToIncrease] + 5);
        }
      }
    }
    
    adjustments++;
  }
  
  return allocation;
}
}
export const riskEngine = new RiskEngine();