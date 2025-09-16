// UIComponents.js - Enhanced UI components with D3 world map and full functionality
import { riskEngine } from './RiskEngine.js';

export class UIComponents {
  
  // Enhanced D3 World Map Component
  static async createWorldMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title, height = 500, width = 960 }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing content
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

    try {
      // Ensure visualization libraries are available
      await this._loadD3();

      // Load world map data
      const worldData = await this._loadWorldData();
      
      // Create the D3 map
      this._renderD3Map(worldData, {
        container: 'map-wrapper',
        countries,
        countryRisks,
        selectedCountries,
        onCountrySelect,
        width,
        height
      });

      // Create legend
      this._createMapLegend('mapLegend');
      
      // Remove loading message
      const loadingElement = document.getElementById('map-loading');
      if (loadingElement) loadingElement.remove();

    } catch (error) {
      console.error('Error creating world map:', error);
      // Fall back to simple grid map
      this._createFallbackMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title });
    }
  }

  // Load D3 library dynamically
  static async _loadD3() {
    if (typeof d3 !== 'undefined') {
      return;
    }

    if (this._d3LoadingPromise) {
      return this._d3LoadingPromise;
    }

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

  // Load world map topology data
  static async _loadWorldData() {
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      if (!response.ok) throw new Error('Failed to load world data');
      return await response.json();
    } catch (error) {
      console.warn('Failed to load external world data:', error);
      // Return simplified world data
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
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat]
        ]]
      }
    });

    const features = [
      createRectFeature('USA', 'United States', -125, 24, -66, 49),
      createRectFeature('CAN', 'Canada', -141, 49, -52, 70),
      createRectFeature('MEX', 'Mexico', -118, 14, -86, 33),
      createRectFeature('BRA', 'Brazil', -74, -35, -34, 6),
      createRectFeature('ARG', 'Argentina', -73, -55, -53, -21),
      createRectFeature('GBR', 'United Kingdom', -8, 49, 2, 59),
      createRectFeature('FRA', 'France', -5, 43, 7, 51),
      createRectFeature('DEU', 'Germany', 5, 47, 15, 55),
      createRectFeature('ESP', 'Spain', -10, 35, 5, 44),
      createRectFeature('ITA', 'Italy', 7, 36, 19, 47),
      createRectFeature('RUS', 'Russia', 30, 50, 120, 70),
      createRectFeature('CHN', 'China', 73, 18, 135, 53),
      createRectFeature('IND', 'India', 68, 7, 89, 35),
      createRectFeature('AUS', 'Australia', 112, -44, 154, -10),
      createRectFeature('JPN', 'Japan', 130, 30, 146, 46),
      createRectFeature('ZAF', 'South Africa', 16, -35, 33, -22),
      createRectFeature('EGY', 'Egypt', 24, 22, 36, 32),
      createRectFeature('NGA', 'Nigeria', 3, 4, 15, 14),
      createRectFeature('SAU', 'Saudi Arabia', 34, 16, 56, 32),
      createRectFeature('TUR', 'Turkey', 26, 36, 45, 43),
      createRectFeature('IRN', 'Iran', 44, 25, 64, 40),
      createRectFeature('PAK', 'Pakistan', 60, 24, 77, 37),
      createRectFeature('KOR', 'South Korea', 125, 33, 130, 39),
      createRectFeature('IDN', 'Indonesia', 95, -11, 141, 6),
      createRectFeature('PHL', 'Philippines', 117, 5, 126, 20),
      createRectFeature('THA', 'Thailand', 97, 5, 106, 21),
      createRectFeature('VNM', 'Vietnam', 102, 8, 110, 23),
      createRectFeature('KEN', 'Kenya', 34, -5, 42, 5),
      createRectFeature('ETH', 'Ethiopia', 33, 3, 44, 15),
      createRectFeature('DZA', 'Algeria', -9, 19, 12, 37),
      createRectFeature('MAR', 'Morocco', -13, 21, -1, 36),
      createRectFeature('PER', 'Peru', -82, -18, -68, 1),
      createRectFeature('COL', 'Colombia', -79, -5, -66, 13),
      createRectFeature('CHL', 'Chile', -75, -56, -66, -17)
    ];

    return {
      type: 'FeatureCollection',
      features
    };
  }

  // Render D3 world map
  static _renderD3Map(worldData, { container, countries, countryRisks, selectedCountries, onCountrySelect, width, height }) {
    const wrapper = document.getElementById(container);
    if (!wrapper) return;

    wrapper.innerHTML = '';

    try {
      const features = this._extractWorldFeatures(worldData);
      if (!features.length) {
        throw new Error('No geographic features available');
      }

      const featureCollection = { type: 'FeatureCollection', features };

      // Create SVG canvas
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

      // Draw ocean background and graticule for context
      const graticule = d3.geoGraticule10();
      mapGroup.append('path')
        .datum({ type: 'Sphere' })
        .attr('d', path)
        .attr('fill', '#e0f2fe')
        .attr('stroke', '#bae6fd')
        .attr('stroke-width', 0.6)
        .attr('pointer-events', 'none');

      mapGroup.append('path')
        .datum(graticule)
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', '#bfdbfe')
        .attr('stroke-width', 0.3)
        .attr('stroke-dasharray', '2,4')
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
        .attr('tabindex', d => d.__isoCode ? 0 : null)
        .attr('role', d => d.__isoCode ? 'button' : null)
        .attr('aria-label', d => {
          const iso = d.__isoCode;
          if (!iso) return null;
          return metadataMap.get(iso)?.name || d.properties?.NAME || iso;
        })
        .attr('aria-pressed', d => selectedCountries.includes(d.__isoCode) ? 'true' : 'false')
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
            .style('stroke-width', isSelected ? 0.6 : 1.5)
            .attr('aria-pressed', isSelected ? 'false' : 'true');

          if (onCountrySelect) {
            onCountrySelect(countryId);
          }
        })
        .on('mouseover', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup))
        .on('mousemove', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup))
        .on('mouseout', () => this._hideMapTooltip())
        .on('focus', (event, d) => this._showMapTooltip(event, d, countryRisks, metadataMap, nameLookup))
        .on('blur', () => this._hideMapTooltip())
        .on('keydown', (event, d) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const countryId = d.__isoCode;
            if (countryId && onCountrySelect) {
              onCountrySelect(countryId);
            }
          }
        });

      const zoom = d3.zoom()
        .scaleExtent([0.75, 8])
        .on('zoom', (event) => {
          mapGroup.attr('transform', event.transform);
        });
      svg.call(zoom);
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

      const transform = topology.transform;
      const arcs = topology.arcs || [];
      const decodedArcs = arcs.map(arc => this._decodeArc(arc, transform));

      const buildRing = (ring = []) => {
        const coordinates = [];

        ring.forEach((arcIndex, index) => {
          const reversed = arcIndex < 0;
          const arc = decodedArcs[reversed ? ~arcIndex : arcIndex];
          if (!arc || arc.length === 0) return;

          const points = reversed ? [...arc].reverse() : arc;
          const segment = index > 0 ? points.slice(1) : points;
          coordinates.push(...segment);
        });

        if (coordinates.length) {
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
            coordinates.push([...first]);
          }
        }

        return coordinates;
      };

      const convertGeometry = (geometry) => {
        if (!geometry) return null;

        switch (geometry.type) {
          case 'Polygon':
            return {
              type: 'Polygon',
              coordinates: geometry.arcs.map(buildRing).filter(ring => ring && ring.length)
            };
          case 'MultiPolygon':
            return {
              type: 'MultiPolygon',
              coordinates: geometry.arcs
                .map(polygon => polygon.map(buildRing).filter(ring => ring && ring.length))
                .filter(polygon => polygon.length)
            };
          default:
            return null;
        }
      };

      const createFeature = (geometry, properties = {}) => {
        const geom = convertGeometry(geometry);
        if (!geom) return null;
        return {
          type: 'Feature',
          properties: { ...properties, ...geometry?.properties },
          geometry: geom
        };
      };

      if (object.type === 'GeometryCollection' && Array.isArray(object.geometries)) {
        return object.geometries
          .map(geometry => createFeature(geometry, object.properties))
          .filter(Boolean);
      }

      const feature = createFeature(object, object.properties);
      return feature ? [feature] : [];
    } catch (error) {
      console.warn('Failed to convert topology to features:', error);
      return [];
    }
  }

  static _decodeArc(arc = [], transform) {
    const coordinates = [];
    let x = 0;
    let y = 0;

    const scaleX = transform?.scale?.[0] ?? 1;
    const scaleY = transform?.scale?.[1] ?? 1;
    const translateX = transform?.translate?.[0] ?? 0;
    const translateY = transform?.translate?.[1] ?? 0;

    arc.forEach(point => {
      x += point[0];
      y += point[1];

      coordinates.push([
        translateX + x * scaleX,
        translateY + y * scaleY
      ]);
    });

    return coordinates;
  }

  // Get country ID from map data
  static _getCountryId(countryData) {
    // Try different property names for country identification
    const id = countryData.id ||
      countryData.properties?.ISO_A3 ||
      countryData.properties?.iso_a3 ||
      countryData.properties?.ADM0_A3 ||
      countryData.properties?.SOV_A3;

    return typeof id === 'string' ? id.toUpperCase() : id;
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

      const directMatch = nameLookup.get(normalized) || nameLookup.get(normalized.replace(/^the/, ''));
      if (directMatch) return directMatch;
    }

    for (const candidate of candidates) {
      const normalized = this._normalizeCountryName(candidate);
      if (!normalized) continue;

      for (const [iso, country] of metadataMap.entries()) {
        const countryName = this._normalizeCountryName(country?.name);
        if (!countryName) continue;

        if (normalized === countryName ||
          normalized.includes(countryName) ||
          countryName.includes(normalized)) {
          return iso;
        }
      }
    }

    return null;
  }

  static _getFeatureNameCandidates(feature) {
    const properties = feature?.properties || {};
    const names = [
      properties.NAME,
      properties.name,
      properties.NAME_LONG,
      properties.NAME_EN,
      properties.NAME_SORT,
      properties.BRK_NAME,
      properties.ABBREV,
      properties.FORMAL_EN,
      properties.FORMAL_FR
    ];

    const cleaned = new Set();
    names.forEach(name => {
      if (!name || typeof name !== 'string') return;
      cleaned.add(name);
      cleaned.add(name.replace(/\(.+?\)/g, '').trim());
      cleaned.add(name.replace(/^The\s+/i, '').trim());
    });

    cleaned.delete('');
    return Array.from(cleaned);
  }

  static _normalizeCountryName(name) {
    if (typeof name !== 'string') return '';

    return name
      .replace(/&/g, ' and ')
      .replace(/Dem\./gi, 'Democratic ')
      .replace(/Rep\./gi, 'Republic ')
      .replace(/Eq\./gi, 'Equatorial ')
      .replace(/Is\./gi, 'Islands ')
      .replace(/St\./gi, 'Saint ')
      .replace(/\./g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  static _buildCountryNameLookup(metadataMap) {
    const lookup = new Map();

    metadataMap.forEach((country, iso) => {
      const normalizedName = this._normalizeCountryName(country?.name);
      if (normalizedName) lookup.set(normalizedName, iso);

      const alternates = this._generateAlternateNames(country?.name);
      alternates.forEach(name => {
        const normalized = this._normalizeCountryName(name);
        if (normalized) lookup.set(normalized, iso);
      });

      const isoKey = this._normalizeCountryName(iso);
      if (isoKey) lookup.set(isoKey, iso);
    });

    const manualAliases = this._getManualNameAliases();
    Object.entries(manualAliases).forEach(([alias, iso]) => {
      const normalized = this._normalizeCountryName(alias);
      if (normalized && iso) {
        lookup.set(normalized, iso);
      }
    });

    return lookup;
  }

  static _generateAlternateNames(name = '') {
    if (!name || typeof name !== 'string') return [];

    const alternates = new Set();

    const withoutParentheses = name.replace(/\(.+?\)/g, '').replace(/\s+/g, ' ').trim();
    if (withoutParentheses && withoutParentheses !== name) {
      alternates.add(withoutParentheses);
    }

    if (name.includes(',')) {
      const parts = name.split(',').map(part => part.trim());
      parts.forEach(part => alternates.add(part));
      if (parts.length === 2) {
        alternates.add(`${parts[1]} ${parts[0]}`.trim());
      }
    }

    if (/^The\s+/i.test(name)) {
      alternates.add(name.replace(/^The\s+/i, '').trim());
    }

    if (name.includes(' and ')) {
      name.split(' and ').forEach(part => alternates.add(part.trim()));
    }

    if (name.includes('Republic')) {
      alternates.add(name.replace(/Republic of/gi, '').trim());
      alternates.add(name.replace(/Republic/gi, '').trim());
    }

    if (name.includes('Democratic')) {
      alternates.add(name.replace(/Democratic Republic of/gi, '').trim());
      alternates.add(name.replace(/Democratic/gi, '').trim());
    }

    if (name.includes('Kingdom')) {
      alternates.add(name.replace(/Kingdom of/gi, '').trim());
    }

    if (name.includes('State of')) {
      alternates.add(name.replace(/State of/gi, '').trim());
    }

    if (name.includes('Federation')) {
      alternates.add(name.replace(/Federation/gi, '').trim());
    }

    return Array.from(alternates).filter(Boolean);
  }

  static _getManualNameAliases() {
    return {
      'bolivia': 'BOL',
      'boliviaplurinationalstateof': 'BOL',
      'bruneidarussalam': 'BRN',
      'capeverde': 'CPV',
      'congo': 'COG',
      'congorepublic': 'COG',
      'congobrepublicofthe': 'COG',
      'congodemocraticrepublicofthe': 'COD',
      'congodemocraticrepublic': 'COD',
      'cotedivoire': 'CIV',
      'ivorycoast': 'CIV',
      'czechrepublic': 'CZE',
      'czechia': 'CZE',
      'swaziland': 'SWZ',
      'eswatini': 'SWZ',
      'gambia': 'GMB',
      'hongkong': 'HKG',
      'iran': 'IRN',
      'iranislamicrepublicof': 'IRN',
      'southkorea': 'KOR',
      'northkorea': 'PRK',
      'laos': 'LAO',
      'macedonia': 'MKD',
      'northmacedonia': 'MKD',
      'moldova': 'MDA',
      'myanmar': 'MMR',
      'burma': 'MMR',
      'palestine': 'PSE',
      'russia': 'RUS',
      'russianfederation': 'RUS',
      'syria': 'SYR',
      'syrianarabrepublic': 'SYR',
      'tanzania': 'TZA',
      'unitedkingdom': 'GBR',
      'unitedkingdomofgreatbritainandnorthernireland': 'GBR',
      'unitedstates': 'USA',
      'unitedstatesofamerica': 'USA',
      'venezuela': 'VEN',
      'venezuela bolivarian republic of': 'VEN',
      'viet nam': 'VNM',
      'vietnam': 'VNM'
    };
  }

  // Show map tooltip
  static _showMapTooltip(event, countryData, countryRisks, countryMetadata = new Map(), nameLookup = new Map()) {
    const countryId = countryData.__isoCode || this._getFeatureIsoCode(countryData, countryMetadata, nameLookup);
    const countryName = countryMetadata.get(countryId)?.name ||
      countryData.properties?.NAME ||
      countryData.properties?.NAME_LONG ||
      countryData.properties?.name ||
      countryId || 'Unknown';
    const risk = countryId ? countryRisks[countryId] : undefined;


    // Remove existing tooltips
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

    tooltip.transition()
      .duration(200)
      .style('opacity', 1);

    const target = event.currentTarget || event.target;
    const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const targetRect = target?.getBoundingClientRect?.();
    const fallbackX = (targetRect?.left ?? 0) + scrollX + (targetRect?.width ?? 0) / 2;
    const fallbackY = (targetRect?.top ?? 0) + scrollY + (targetRect?.height ?? 0) / 2;
    const pageX = event.pageX ?? fallbackX;
    const pageY = event.pageY ?? fallbackY;

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

  // Hide map tooltip
  static _hideMapTooltip() {
    d3.selectAll('.map-tooltip').remove();
  }

  // Create map legend
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

  // Fallback simple map grid
  static _createFallbackMap(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title }) {
    console.log('Using fallback grid map');
    this._createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title });
  }

  // Simple grid map (enhanced version of original)
  static _createSimpleMapGrid(containerId, { countries, countryRisks, selectedCountries, onCountrySelect, title }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="simple-map-container" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); text-align: center;">
        ${title ? `<h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>` : ''}
        <div class="map-grid" id="simpleMapGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 20px 0; max-height: 400px; overflow-y: auto;">
          <!-- Countries will be inserted here -->
        </div>
        <div class="legend" id="simpleMapLegend" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 16px;">
          <!-- Legend will be inserted here -->
        </div>
      </div>
    `;

    const mapGrid = document.getElementById('simpleMapGrid');
    const mapLegend = document.getElementById('simpleMapLegend');

    if (!mapGrid || !mapLegend) return;

    // Sort countries by name and show up to 20
    const displayCountries = countries
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);

    // Create country tiles
    displayCountries.forEach(country => {
      const risk = countryRisks[country.isoCode] || 0;
      const isSelected = selectedCountries.includes(country.isoCode);
      
      const countryTile = document.createElement('div');
      countryTile.className = `map-country ${isSelected ? 'selected' : ''}`;
      countryTile.style.cssText = `
        padding: 12px 8px;
        border-radius: 4px;
        border: 2px solid ${isSelected ? '#000' : '#e5e7eb'};
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        color: white;
        text-align: center;
        transition: all 0.2s;
        background-color: ${riskEngine.getRiskColor(risk)};
        opacity: ${risk > 0 ? 0.9 : 0.4};
        min-height: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      `;
      
      const displayName = country.name.length > 12 ? country.isoCode : country.name;
      countryTile.innerHTML = `
        <div style="line-height: 1.2;">${displayName}</div>
        ${risk > 0 ? `<div style="font-size: 10px; margin-top: 4px; opacity: 0.9;">${risk.toFixed(1)}</div>` : ''}
      `;
      
      countryTile.addEventListener('click', () => {
        if (onCountrySelect) {
          onCountrySelect(country.isoCode);
        }
      });

      // Add hover effects
      countryTile.addEventListener('mouseenter', () => {
        countryTile.style.transform = 'scale(1.05)';
        countryTile.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      });

      countryTile.addEventListener('mouseleave', () => {
        countryTile.style.transform = 'scale(1)';
        countryTile.style.boxShadow = 'none';
      });
      
      mapGrid.appendChild(countryTile);
    });

    // Create legend
    this._createMapLegend('simpleMapLegend');
  }

  // Enhanced control panel with all React functionality
  static createControlPanel(containerId, {
    weights,
    onWeightsChange,
    countries,
    selectedCountries,
    countryVolumes,
    onCountrySelect,
    onVolumeChange,
    baselineRisk
  }) {
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
      if (onWeightsChange) {
        onWeightsChange([...localWeights]);
      }
    };

    const updateBaselineDisplay = () => {
      const riskColor = riskEngine.getRiskColor(baselineRisk);
      const riskBand = riskEngine.getRiskBand(baselineRisk);
      
      const display = document.getElementById('baselineDisplay');
      if (display) {
        display.style.backgroundColor = `${riskColor}20`;
        display.style.borderColor = riskColor;
        display.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: bold; color: ${riskColor}; margin-bottom: 8px;">
              ${baselineRisk.toFixed(1)}
            </div>
            <div style="font-size: 20px; font-weight: 600; color: ${riskColor}; margin-bottom: 8px;">
              ${riskBand} Risk
            </div>
            <div style="font-size: 14px; color: #6b7280;">
              Based on ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'}
            </div>
          </div>
        `;
      }
    };

    container.innerHTML = `
      <div class="control-panel" style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 24px; color: #1f2937;">Risk Assessment Controls</h2>
        
        <!-- Weights Section -->
        <div class="weights-section" style="margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #374151;">Risk Factor Weightings</h3>
            <button id="resetWeights" style="padding: 8px 16px; background-color: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
              Reset to Default
            </button>
          </div>
          
          <div id="weightsContainer" style="margin-bottom: 16px;">
            <!-- Weight controls will be inserted here -->
          </div>
          
          <div style="font-size: 14px; color: #6b7280; padding: 8px; background-color: #f9fafb; border-radius: 4px;">
            Total Weight: <span id="totalWeights" style="font-weight: 600;">${localWeights.reduce((sum, w) => sum + w, 0)}</span>
            <span style="font-size: 12px; opacity: 0.8;">(weights can exceed 100%)</span>
          </div>
        </div>

        <!-- Country Selection Section -->
        <div class="country-selection" style="margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #374151;">Country Selection</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
              Add Country to Portfolio:
            </label>
            <select id="countrySelect" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; background-color: white;">
              <option value="">Select a country...</option>
            </select>
          </div>

          <div id="selectedCountries">
            <!-- Selected countries will be displayed here -->
          </div>
        </div>

        <!-- Baseline Risk Display -->
        <div class="baseline-risk">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #374151;">Portfolio Baseline Risk</h3>
          <div id="baselineDisplay" style="padding: 24px; border-radius: 8px; border: 2px solid; transition: all 0.3s;">
            <!-- Risk display will be updated here -->
          </div>
        </div>

        <!-- Instructions -->
        <div style="background-color: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">How to use:</h4>
          <ul style="font-size: 14px; margin: 0; padding-left: 16px; line-height: 1.5;">
            <li>Adjust weightings to reflect your risk priorities</li>
            <li>Click countries on the map or use the dropdown to select them</li>
            <li>Set volume for each country (default: 10)</li>
            <li>The baseline risk is calculated as a weighted average</li>
          </ul>
        </div>
      </div>
    `;

    // Create enhanced weight controls
    const weightsContainer = document.getElementById('weightsContainer');
    weightLabels.forEach((label, index) => {
      const weightControl = document.createElement('div');
      weightControl.style.cssText = 'margin-bottom: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #fafafa;';
      weightControl.innerHTML = `
        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
          ${label} <span id="weightValue_${index}" style="font-weight: 600; color: #1f2937;">(${localWeights[index]}%)</span>
        </label>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="range" min="0" max="50" value="${localWeights[index]}" id="weight_${index}" style="flex: 1; height: 6px; border-radius: 3px; background-color: #d1d5db;">
          <input type="number" min="0" max="50" value="${localWeights[index]}" id="weightNum_${index}" style="width: 70px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: center;">
        </div>
      `;
      weightsContainer.appendChild(weightControl);

      // Enhanced event listeners
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
      
      // Add visual feedback
      rangeInput.addEventListener('input', (e) => {
        const percentage = (e.target.value / e.target.max) * 100;
        e.target.style.background = `linear-gradient(to right, #3b82f6 ${percentage}%, #d1d5db ${percentage}%)`;
      });
    });

    // Enhanced reset button
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

    resetButton.addEventListener('mouseenter', () => {
      resetButton.style.backgroundColor = '#4b5563';
    });

    resetButton.addEventListener('mouseleave', () => {
      resetButton.style.backgroundColor = '#6b7280';
    });

    // Enhanced country dropdown
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

    // Update displays
    this.updateSelectedCountriesDisplay(selectedCountries, countries, countryVolumes, onCountrySelect, onVolumeChange);
    updateBaselineDisplay();
  }

  // Enhanced selected countries display
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
        <!-- Country items will be inserted here -->
      </div>
    `;

    const countryList = document.getElementById('countryList');
    selectedCountries.forEach((countryCode, index) => {
      const country = countries.find(c => c.isoCode === countryCode);
      const volume = countryVolumes[countryCode] || 10;

      const countryItem = document.createElement('div');
      countryItem.style.cssText = `
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        padding: 16px; 
        ${index > 0 ? 'border-top: 1px solid #e5e7eb;' : ''}
        background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};
        transition: background-color 0.2s;
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
                  style="padding: 6px 12px; background-color: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background-color 0.2s;">
            Remove
          </button>
        </div>
      `;

      // Add hover effect
      countryItem.addEventListener('mouseenter', () => {
        countryItem.style.backgroundColor = '#f0f9ff';
      });

      countryItem.addEventListener('mouseleave', () => {
        countryItem.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      });

      countryList.appendChild(countryItem);

      // Enhanced event listeners
      const volumeInput = document.getElementById(`volume_${countryCode}`);
      const removeButton = document.getElementById(`remove_${countryCode}`);

      volumeInput.addEventListener('input', (e) => {
        const value = Math.max(0, parseFloat(e.target.value) || 0);
        e.target.value = value;
        if (onVolumeChange) {
          onVolumeChange(countryCode, value);
        }
      });

      removeButton.addEventListener('click', () => {
        if (onCountrySelect) {
          onCountrySelect(countryCode);
        }
      });

      removeButton.addEventListener('mouseenter', () => {
        removeButton.style.backgroundColor = '#dc2626';
      });

      removeButton.addEventListener('mouseleave', () => {
        removeButton.style.backgroundColor = '#ef4444';
      });
    });
  }
}