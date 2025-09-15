import React, { useState, useEffect } from 'react';

// Mock Data Service (since we can't access external APIs in this environment)
const mockCountries = [
  { name: "United States of America", isoCode: "USA", itucRightsRating: 67.5, corruptionIndex: 35.0, migrantWorkerPrevalence: 9.9, wjpIndex: 43.7, walkfreeSlaveryIndex: 3.3, baseRiskScore: 48 },
  { name: "China", isoCode: "CHN", itucRightsRating: 90.0, corruptionIndex: 57.0, migrantWorkerPrevalence: 0.1, wjpIndex: 68.3, walkfreeSlaveryIndex: 4.0, baseRiskScore: 68 },
  { name: "Germany", isoCode: "DEU", itucRightsRating: 0.0, corruptionIndex: 25.0, migrantWorkerPrevalence: 15.2, wjpIndex: 16.8, walkfreeSlaveryIndex: 0.6, baseRiskScore: 20 },
  { name: "United Kingdom", isoCode: "GBR", itucRightsRating: 67.5, corruptionIndex: 29.0, migrantWorkerPrevalence: 16.5, wjpIndex: 30.7, walkfreeSlaveryIndex: 1.8, baseRiskScore: 43 },
  { name: "Japan", isoCode: "JPN", itucRightsRating: 22.5, corruptionIndex: 29.0, migrantWorkerPrevalence: 2.8, wjpIndex: 24.7, walkfreeSlaveryIndex: 1.1, baseRiskScore: 24 },
  { name: "India", isoCode: "IND", itucRightsRating: 90.0, corruptionIndex: 62.0, migrantWorkerPrevalence: 0.3, wjpIndex: 49.5, walkfreeSlaveryIndex: 8.0, baseRiskScore: 67 },
  { name: "Brazil", isoCode: "BRA", itucRightsRating: 67.5, corruptionIndex: 66.0, migrantWorkerPrevalence: 0.7, wjpIndex: 52.2, walkfreeSlaveryIndex: 5.0, baseRiskScore: 60 },
  { name: "France", isoCode: "FRA", itucRightsRating: 22.5, corruptionIndex: 33.0, migrantWorkerPrevalence: 7.9, wjpIndex: 23.3, walkfreeSlaveryIndex: 2.1, baseRiskScore: 26 },
  { name: "Bangladesh", isoCode: "BGD", itucRightsRating: 90.0, corruptionIndex: 77.0, migrantWorkerPrevalence: 1.7, wjpIndex: 56.3, walkfreeSlaveryIndex: 7.1, baseRiskScore: 74 },
  { name: "Vietnam", isoCode: "VNM", itucRightsRating: 67.5, corruptionIndex: 60.0, migrantWorkerPrevalence: 0.3, wjpIndex: 36.7, walkfreeSlaveryIndex: 4.1, baseRiskScore: 55 }
];

// Risk Engine
class RiskEngine {
  constructor() {
    this.defaultWeights = [20, 20, 5, 10, 10];
    this.riskBands = {
      'Low': { min: 0, max: 19.99, color: '#22c55e' },
      'Medium': { min: 20, max: 39.99, color: '#eab308' },
      'Medium High': { min: 40, max: 59.99, color: '#f97316' },
      'High': { min: 60, max: 79.99, color: '#ef4444' },
      'Very High': { min: 80, max: 100, color: '#991b1b' }
    };
  }

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

    for (let i = 0; i < values.length; i++) {
      if (values[i] > 0) {
        weightedSum += values[i] * weights[i];
        totalWeight += weights[i];
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  getRiskBand(score) {
    for (const [band, definition] of Object.entries(this.riskBands)) {
      if (score >= definition.min && score <= definition.max) {
        return band;
      }
    }
    return 'Unknown';
  }

  getRiskColor(score) {
    const band = this.getRiskBand(score);
    return this.riskBands[band]?.color || '#64748b';
  }

  calculateBaselineRisk(selectedCountries, countryVolumes, countryRisks) {
    let totalVolumeRisk = 0;
    let totalVolume = 0;

    selectedCountries.forEach(countryCode => {
      const volume = countryVolumes[countryCode] || 10;
      const risk = countryRisks[countryCode] || 0;
      
      totalVolumeRisk += volume * risk;
      totalVolume += volume;
    });

    return totalVolume > 0 ? totalVolumeRisk / totalVolume : 0;
  }

  getRiskBandDefinitions() {
    return Object.entries(this.riskBands).map(([name, definition]) => ({
      name,
      range: `${definition.min}-${definition.max === 100 ? '100' : Math.floor(definition.max)}`,
      color: definition.color
    }));
  }
}

const riskEngine = new RiskEngine();

// Simple World Map Component
const SimpleWorldMap = ({ countryRisks, selectedCountries, onCountrySelect, title }) => {
  const handleCountryClick = (countryCode) => {
    if (onCountrySelect) {
      onCountrySelect(countryCode);
    }
  };

  return (
    <div className="world-map-container bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      
      {/* Simplified map representation */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {mockCountries.map(country => {
          const risk = countryRisks[country.isoCode] || 0;
          const isSelected = selectedCountries.includes(country.isoCode);
          
          return (
            <div
              key={country.isoCode}
              onClick={() => handleCountryClick(country.isoCode)}
              className={`p-3 rounded cursor-pointer border-2 transition-all ${
                isSelected ? 'border-black' : 'border-gray-200'
              }`}
              style={{ 
                backgroundColor: riskEngine.getRiskColor(risk),
                opacity: risk > 0 ? 0.8 : 0.3
              }}
            >
              <div className="text-white text-xs font-medium text-center">
                {country.name.length > 15 ? country.isoCode : country.name}
              </div>
              {risk > 0 && (
                <div className="text-white text-xs text-center mt-1">
                  {risk.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Risk Legend */}
      <div className="risk-legend">
        <h4 className="text-sm font-medium mb-2">Risk Levels:</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {riskEngine.getRiskBandDefinitions().map(band => (
            <div key={band.name} className="flex items-center gap-1">
              <div 
                className="w-4 h-4 border border-gray-300"
                style={{ backgroundColor: band.color }}
              />
              <span className="text-xs">{band.name} ({band.range})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Control Panel Component
const ControlPanel = ({ 
  weights, 
  onWeightsChange, 
  countries, 
  selectedCountries, 
  countryVolumes, 
  onCountrySelect, 
  onVolumeChange,
  baselineRisk 
}) => {
  const [localWeights, setLocalWeights] = useState(weights || riskEngine.defaultWeights);

  const weightLabels = [
    'ITUC Rights Rating',
    'Corruption Index (TI)', 
    'ILO Migrant Worker Prevalence',
    'WJP Index 4.8',
    'Walk Free Slavery Index'
  ];

  const handleWeightChange = (index, value) => {
    const newWeights = [...localWeights];
    newWeights[index] = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setLocalWeights(newWeights);
    
    if (onWeightsChange) {
      onWeightsChange(newWeights);
    }
  };

  const resetWeights = () => {
    setLocalWeights(riskEngine.defaultWeights);
    if (onWeightsChange) {
      onWeightsChange(riskEngine.defaultWeights);
    }
  };

  const getTotalWeights = () => {
    return localWeights.reduce((sum, weight) => sum + weight, 0);
  };

  return (
    <div className="control-panel bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-6">Risk Assessment Controls</h2>
      
      {/* Weights Section */}
      <div className="weights-section mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Risk Factor Weightings</h3>
          <button 
            onClick={resetWeights}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Reset to Default
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4 mb-4">
          {weightLabels.map((label, index) => (
            <div key={index} className="weight-input-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={localWeights[index]}
                  onChange={(e) => handleWeightChange(index, e.target.value)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={localWeights[index]}
                  onChange={(e) => handleWeightChange(index, e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-sm text-gray-600">
          Total Weight: {getTotalWeights()}
        </div>
      </div>

      {/* Country Selection Section */}
      <div className="country-selection mb-8">
        <h3 className="text-lg font-semibold mb-4">Country Selection</h3>
        
        {/* Country Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Country to Portfolio:
          </label>
          <select 
            onChange={(e) => e.target.value && onCountrySelect(e.target.value)}
            value=""
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a country...</option>
            {countries
              .filter(country => !selectedCountries.includes(country.isoCode))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(country => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
          </select>
        </div>

        {/* Selected Countries */}
        {selectedCountries.length > 0 && (
          <div>
            <h4 className="text-md font-medium mb-3">Selected Countries & Volumes:</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedCountries.map(countryCode => {
                const country = countries.find(c => c.isoCode === countryCode);
                const volume = countryVolumes[countryCode] || 10;
                return (
                  <div key={countryCode} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                    <div className="flex-1">
                      <span className="font-medium">{country?.name || countryCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Volume:</label>
                      <input
                        type="number"
                        min="0"
                        value={volume}
                        onChange={(e) => onVolumeChange(countryCode, e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={() => onCountrySelect(countryCode)}
                      className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Baseline Risk Display */}
      <div className="baseline-risk">
        <h3 className="text-lg font-semibold mb-3">Portfolio Baseline Risk</h3>
        <div className="p-4 rounded-lg border-2" style={{ 
          backgroundColor: `${riskEngine.getRiskColor(baselineRisk)}20`,
          borderColor: riskEngine.getRiskColor(baselineRisk)
        }}>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: riskEngine.getRiskColor(baselineRisk) }}>
              {baselineRisk.toFixed(1)}
            </div>
            <div className="text-lg font-medium" style={{ color: riskEngine.getRiskColor(baselineRisk) }}>
              {riskEngine.getRiskBand(baselineRisk)} Risk
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Based on {selectedCountries.length} selected {selectedCountries.length === 1 ? 'country' : 'countries'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Application Component
const HRDDRiskApp = () => {
  const [countries] = useState(mockCountries);
  const [weights, setWeights] = useState(riskEngine.defaultWeights);
  const [selectedCountries, setSelectedCountries] = useState(['USA', 'CHN', 'DEU']);
  const [countryVolumes, setCountryVolumes] = useState({ USA: 10, CHN: 15, DEU: 8 });
  const [countryRisks, setCountryRisks] = useState({});
  const [baselineRisk, setBaselineRisk] = useState(0);

  // Calculate risks for all countries when weights change
  useEffect(() => {
    const newCountryRisks = {};
    countries.forEach(country => {
      newCountryRisks[country.isoCode] = riskEngine.calculateWeightedRisk(country, weights);
    });
    setCountryRisks(newCountryRisks);
  }, [countries, weights]);

  // Calculate baseline risk when selection or volumes change
  useEffect(() => {
    const newBaselineRisk = riskEngine.calculateBaselineRisk(selectedCountries, countryVolumes, countryRisks);
    setBaselineRisk(newBaselineRisk);
  }, [selectedCountries, countryVolumes, countryRisks]);

  const handleCountrySelect = (countryCode) => {
    setSelectedCountries(prev => {
      if (prev.includes(countryCode)) {
        // Remove country
        const newSelected = prev.filter(code => code !== countryCode);
        const newVolumes = { ...countryVolumes };
        delete newVolumes[countryCode];
        setCountryVolumes(newVolumes);
        return newSelected;
      } else {
        // Add country with default volume
        setCountryVolumes(prev => ({ ...prev, [countryCode]: 10 }));
        return [...prev, countryCode];
      }
    });
  };

  const handleVolumeChange = (countryCode, volume) => {
    setCountryVolumes(prev => ({
      ...prev,
      [countryCode]: Math.max(0, parseFloat(volume) || 0)
    }));
  };

  return (
    <div className="hrdd-risk-app min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Human Rights Due Diligence Risk Assessment Tool
          </h1>
          <p className="text-lg text-gray-600">
            Step 1: Calculate Baseline Risk for Supply Chain Countries
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <ControlPanel
              weights={weights}
              onWeightsChange={setWeights}
              countries={countries}
              selectedCountries={selectedCountries}
              countryVolumes={countryVolumes}
              onCountrySelect={handleCountrySelect}
              onVolumeChange={handleVolumeChange}
              baselineRisk={baselineRisk}
            />
          </div>

          {/* Map Display */}
          <div className="lg:col-span-2">
            <SimpleWorldMap
              countryRisks={countryRisks}
              selectedCountries={selectedCountries}
              onCountrySelect={handleCountrySelect}
              title="Baseline Risk Assessment Map"
            />
            
            {/* Next Steps Placeholder */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <p className="text-blue-800 text-sm">
                Step 2 will allow you to configure HRDD strategies (monitoring, audits, etc.)
                <br />
                Step 3 will measure responsiveness effectiveness to calculate managed risk levels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDDRiskApp;