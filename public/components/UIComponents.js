// UIComponents.js - Enhanced UI components with new layout panels
import { riskEngine } from './RiskEngine.js';

export class UIComponents {
  
  // Enhanced D3 World Map Component
  static async createWorldMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title, height = 500, width = 960 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="world-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>
        <div id="map-loading" style="padding: 40px; color: #6b7280;">
          <div>Loading world map...</div>
          <div style="font-size: 14px; margin-top: 8px;">Please wait while we render the interactive map.</div>
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

      this._renderD3Map(worldData, {
        container: 'map-wrapper',
        countries,
        countryRisks: safeCountryRisks,
        selectedCountries: safeSelectedCountries,
        onCountrySelect,
        width,
        height: Math.max(height, 600)
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
        title
      });
    }
  }

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

  static _renderD3Map(worldData, { container, countries, countryRisks, selectedCountries, onCountrySelect, width, height }) {
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
        .on('mouseover', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup))
        .on('mouseout', () => this._hideMapTooltip());

      // Enhanced zoom controls
      const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
          mapGroup.attr('transform', event.transform);
        });
      
      svg.call(zoom);

      // Add zoom control buttons
      const zoomControls = svg.append('g')
        .attr('class', 'zoom-controls')
        .attr('transform', 'translate(20, 20)');

      // Zoom in button
      zoomControls.append('rect')
        .attr('x', 0).attr('y', 0).attr('width', 30).attr('height', 30)
        .attr('fill', 'white').attr('stroke', '#374151').attr('stroke-width', 1).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.5));

      zoomControls.append('text')
        .attr('x', 15).attr('y', 20).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .style('font-size', '18px').style('font-weight', 'bold').style('fill', '#374151')
        .style('pointer-events', 'none').text('+');

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

    } catch (error) {
      console.warn('D3 map rendering failed, using fallback:', error);
      this._createSimpleMapGrid(container, { countries, countryRisks, selectedCountries, onCountrySelect });
    }
  }

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

      // If the id is purely numeric, fall back to name-based resolution
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

  static _showMapTooltip(event, countryData, countryRisks, countryMetadata = new Map(), nameLookup = new Map()) {
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

    tooltip.html(`
      <strong>${countryName}</strong><br/>
      ${risk !== undefined ?
        `Risk Score: ${risk.toFixed(1)}<br/>Risk Band: ${riskEngine.getRiskBand(risk)}` :
        'No data available'
      }
    `)
    .style('left', (pageX + 10) + 'px')
    .style('top', (pageY - 10) + 'px');
  }

  static _hideMapTooltip() {
    d3.selectAll('.map-tooltip').remove();
  }

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

  static _createFallbackMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title }) {
    this._createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title });
  }

  static _createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="simple-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        ${title ? `<h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>` : ''}
        <div class="map-grid" id="simpleMapGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 20px 0;">
        </div>
      </div>
    `;

    const mapGrid = document.getElementById('simpleMapGrid');
    if (!mapGrid) return;

    const displayCountries = countries.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20);

    displayCountries.forEach(country => {
      const risk = countryRisks[country.isoCode] || 0;
      const isSelected = selectedCountries.includes(country.isoCode);
      
      const countryTile = document.createElement('div');
      countryTile.style.cssText = `
        padding: 12px 8px; border-radius: 4px; border: 2px solid ${isSelected ? '#000' : '#e5e7eb'};
        cursor: pointer; font-size: 11px; font-weight: 500; color: white; text-align: center;
        background-color: ${riskEngine.getRiskColor(risk)}; opacity: ${risk > 0 ? 0.9 : 0.4};
        min-height: 60px; display: flex; flex-direction: column; justify-content: center;
      `;
      
      countryTile.innerHTML = `<div>${country.name.length > 12 ? country.isoCode : country.name}</div>`;
      countryTile.addEventListener('click', () => {
        if (onCountrySelect) onCountrySelect(country.isoCode);
      });
      
      mapGrid.appendChild(countryTile);
    });
  }

  // NEW LAYOUT PANELS

  // Country Selection Panel (Middle Left)
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

  // Results Panel (Middle Right)
  static createResultsPanel(containerId, { selectedCountries, countries, countryRisks, baselineRisk }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const riskColor = riskEngine.getRiskColor(baselineRisk);
    const riskBand = riskEngine.getRiskBand(baselineRisk);

    container.innerHTML = `
      <div class="results-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Portfolio Risk Assessment</h2>
        
        <div id="baselineDisplay" style="padding: 32px; border-radius: 12px; border: 3px solid ${riskColor}; background-color: ${riskColor}15; margin-bottom: 24px;">
          <div style="text-align: center;">
            <div style="font-size: 56px; font-weight: bold; color: ${riskColor}; margin-bottom: 12px;">
              ${baselineRisk.toFixed(1)}
            </div>
            <div style="font-size: 24px; font-weight: 600; color: ${riskColor}; margin-bottom: 12px;">
              ${riskBand} Risk
            </div>
            <div style="font-size: 16px; color: #6b7280;">
              Based on ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'}
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
            This baseline risk will be used in Step 2 to configure HRDD strategies and 
            in Step 3 to calculate managed risk levels after implementing controls.
          </p>
        </div>
      </div>
    `;

    this.updateRiskBreakdown(selectedCountries, countries, countryRisks);
  }

  // Risk Factor Weightings Panel (Bottom)
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
      const volume = countryVolumes[countryCode] || 10;

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

  static updateResultsPanel(selectedCountries, countries, countryRisks, baselineRisk) {
    const baselineDisplay = document.getElementById('baselineDisplay');
    if (baselineDisplay) {
      const riskColor = riskEngine.getRiskColor(baselineRisk);
      const riskBand = riskEngine.getRiskBand(baselineRisk);
      
      baselineDisplay.style.backgroundColor = `${riskColor}15`;
      baselineDisplay.style.borderColor = riskColor;
      baselineDisplay.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 56px; font-weight: bold; color: ${riskColor}; margin-bottom: 12px;">
            ${baselineRisk.toFixed(1)}
          </div>
          <div style="font-size: 24px; font-weight: 600; color: ${riskColor}; margin-bottom: 12px;">
            ${riskBand} Risk
          </div>
          <div style="font-size: 16px; color: #6b7280;">
            Based on ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'}
          </div>
        </div>
      `;
    }

    this.updateRiskBreakdown(selectedCountries, countries, countryRisks);
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
}