import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { riskEngine } from './RiskEngine';

const WorldMap = ({ 
  countryRisks = {}, 
  selectedCountries = [], 
  onCountrySelect, 
  title = "Risk Assessment Map",
  height = 500,
  width = 960 
}) => {
  const svgRef = useRef();
  const [worldData, setWorldData] = useState(null);
  const [countries, setCountries] = useState(null);

  // Load world map data
  useEffect(() => {
    const loadWorldData = async () => {
      try {
        // Using a public topojson world map
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const world = await response.json();
        
        setWorldData(world);
        setCountries(world.objects.countries);
      } catch (error) {
        console.error('Error loading world data:', error);
        // Fallback: create simple world map structure
        createFallbackMap();
      }
    };

    loadWorldData();
  }, []);

  // Create fallback map if external data fails
  const createFallbackMap = () => {
    // Simple fallback - create basic country shapes
    // This is a simplified approach for when external data isn't available
    const fallbackCountries = [
      { id: 'USA', name: 'United States', coordinates: [[-125, 50], [-125, 25], [-65, 25], [-65, 50]] },
      { id: 'CHN', name: 'China', coordinates: [[75, 55], [75, 15], [135, 15], [135, 55]] },
      { id: 'DEU', name: 'Germany', coordinates: [[5, 55], [5, 47], [15, 47], [15, 55]] },
      // Add more countries as needed
    ];
    
    setCountries({ geometries: fallbackCountries });
  };

  // Initialize and update map
  useEffect(() => {
    if (!worldData || !countries) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous content

    // Set up projection and path
    const projection = d3.geoNaturalEarth1()
      .scale(150)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Create main group
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw countries
    if (worldData.objects && worldData.objects.countries) {
      const countries = topojson.feature(worldData, worldData.objects.countries);
      
      g.selectAll("path")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "country")
        .style("fill", d => {
          const countryId = d.id || d.properties.ISO_A3;
          const risk = countryRisks[countryId];
          return risk !== undefined ? riskEngine.getRiskColor(risk) : '#e5e7eb';
        })
        .style("stroke", "#ffffff")
        .style("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          const countryId = d.id || d.properties.ISO_A3;
          const countryName = d.properties.NAME || d.properties.NAME_LONG;
          if (onCountrySelect) {
            onCountrySelect(countryId, countryName);
          }
        })
        .on("mouseover", function(event, d) {
          const countryId = d.id || d.properties.ISO_A3;
          const countryName = d.properties.NAME || d.properties.NAME_LONG;
          const risk = countryRisks[countryId];
          
          d3.select(this)
            .style("stroke", "#000000")
            .style("stroke-width", 2);

          // Show tooltip
          const tooltip = d3.select("body").append("div")
            .attr("class", "map-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0);

          tooltip.transition()
            .duration(200)
            .style("opacity", 1);

          tooltip.html(`
            <strong>${countryName}</strong><br/>
            ${risk !== undefined ? `Risk Score: ${risk.toFixed(1)}<br/>Risk Band: ${riskEngine.getRiskBand(risk)}` : 'No data available'}
          `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this)
            .style("stroke", "#ffffff")
            .style("stroke-width", 0.5);

          // Remove tooltip
          d3.selectAll(".map-tooltip").remove();
        });

      // Highlight selected countries
      g.selectAll("path")
        .style("stroke", d => {
          const countryId = d.id || d.properties.ISO_A3;
          return selectedCountries.includes(countryId) ? "#000000" : "#ffffff";
        })
        .style("stroke-width", d => {
          const countryId = d.id || d.properties.ISO_A3;
          return selectedCountries.includes(countryId) ? 2 : 0.5;
        });
    }

  }, [worldData, countries, countryRisks, selectedCountries, width, height, onCountrySelect]);

  return (
    <div className="world-map-container">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <div className="map-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ border: '1px solid #ccc', background: '#f8fafc' }}
        />
      </div>
      
      {/* Risk Legend */}
      <div className="risk-legend mt-4">
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

// Fallback topojson implementation for when external library isn't available
const topojson = {
  feature: (topology, object) => {
    // Simplified implementation
    if (!object || !object.geometries) {
      return { type: "FeatureCollection", features: [] };
    }
    
    return {
      type: "FeatureCollection",
      features: object.geometries.map(geom => ({
        type: "Feature",
        id: geom.id,
        properties: geom.properties || {},
        geometry: geom
      }))
    };
  }
};

export default WorldMap;