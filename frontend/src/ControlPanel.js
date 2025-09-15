import React, { useState, useEffect } from 'react';
import { riskEngine } from './RiskEngine';

const ControlPanel = ({ 
  weights, 
  onWeightsChange, 
  countries = [], 
  selectedCountries = [], 
  countryVolumes = {}, 
  onCountrySelect, 
  onVolumeChange,
  baselineRisk = 0
}) => {
  const [localWeights, setLocalWeights] = useState(weights || riskEngine.defaultWeights);

  // Weight labels
  const weightLabels = [
    'ITUC Rights Rating',
    'Corruption Index (TI)', 
    'ILO Migrant Worker Prevalence',
    'WJP Index 4.8',
    'Walk Free Slavery Index'
  ];

  useEffect(() => {
    setLocalWeights(weights || riskEngine.defaultWeights);
  }, [weights]);

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

  const handleCountrySelection = (countryIsoCode) => {
    if (onCountrySelect) {
      onCountrySelect(countryIsoCode);
    }
  };

  const handleVolumeChange = (countryIsoCode, volume) => {
    if (onVolumeChange) {
      onVolumeChange(countryIsoCode, Math.max(0, parseFloat(volume) || 0));
    }
  };

  const removeCountry = (countryIsoCode) => {
    if (onCountrySelect) {
      onCountrySelect(countryIsoCode); // Toggle selection (remove)
    }
  };

  const getTotalWeights = () => {
    return localWeights.reduce((sum, weight) => sum + weight, 0);
  };

  const getRiskBandColor = (risk) => {
    return riskEngine.getRiskColor(risk);
  };

  const getRiskBandName = (risk) => {
    return riskEngine.getRiskBand(risk);
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
          Total Weight: {getTotalWeights()} (weights can exceed 100%)
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
            onChange={(e) => e.target.value && handleCountrySelection(e.target.value)}
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
                        onChange={(e) => handleVolumeChange(countryCode, e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeCountry(countryCode)}
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
          backgroundColor: `${getRiskBandColor(baselineRisk)}20`,
          borderColor: getRiskBandColor(baselineRisk)
        }}>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: getRiskBandColor(baselineRisk) }}>
              {baselineRisk.toFixed(1)}
            </div>
            <div className="text-lg font-medium" style={{ color: getRiskBandColor(baselineRisk) }}>
              {getRiskBandName(baselineRisk)} Risk
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Based on {selectedCountries.length} selected {selectedCountries.length === 1 ? 'country' : 'countries'}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Adjust weightings to reflect your risk priorities</li>
          <li>• Click countries on the map or use the dropdown to select them</li>
          <li>• Set volume for each country (default: 10)</li>
          <li>• The baseline risk is calculated as a weighted average</li>
        </ul>
      </div>
    </div>
  );
};

export default ControlPanel;