// Core map functionality and layer management
import { METRICS_CONFIG } from './config.js';
import { formatValue, formatLegendValue, getMetricValue, quantileBreaks, equalIntervalBreaks, colorForValue } from './utils.js';

// Global map state
export let map, precinctLayer, transitLayer, parksLayer;
export let currentDataType = 'renter';
export let useDynamicScale = true; // Always on
export let info, legend, overlayLegend;

export function initializeMapCore() {
    // Initialize the map
    map = L.map('map').setView([33.8358, -118.3406], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize layer groups
    transitLayer = L.layerGroup();
    parksLayer = L.layerGroup();

    // Initialize info control
    initializeInfoControl();

    // Initialize legend controls
    initializeLegendControls();
}

function initializeInfoControl() {
    info = L.control({ position: 'topleft' });
    info.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'info');
        this.update();
        return this._div;
    };
    info.update = function (props, statusMessage = '') {
        const cfgsAvailable = (typeof METRICS_CONFIG !== 'undefined');
        const cfg = cfgsAvailable ? METRICS_CONFIG[currentDataType] : null;
        const title = cfg?.title || 'Torrance Data';
        let content = 'Hover over a precinct.';

        if (statusMessage) content = `<em>${statusMessage}</em>`;
        else if (cfg) content = 'Data from U.S. Census (ACS).';

        if (props) {
            content = `<b>Precinct: ${props.Precinct_ID}</b><br/>Area: ${props.Area_Name}`;
            // Always show a few common fields when available
            if (cfgsAvailable) {
                const renterCfg = METRICS_CONFIG.renter;
                const povertyCfg = METRICS_CONFIG.poverty;
                const unempCfg = METRICS_CONFIG.unemployment;
                const incomeCfg = METRICS_CONFIG.income;

                if (props[renterCfg.var] !== undefined && props[renterCfg.var] >= 0)
                    content += `<br/>Renter: ${formatValue(props[renterCfg.var], renterCfg)}`;
                if (props[povertyCfg.var] !== undefined && props[povertyCfg.var] >= 0)
                    content += `<br/>Poverty: ${formatValue(props[povertyCfg.var], povertyCfg)}`;
                if (props[unempCfg.var] !== undefined && props[unempCfg.var] >= 0)
                    content += `<br/>Unemployment: ${formatValue(props[unempCfg.var], unempCfg)}`;
                if (props[incomeCfg.var] !== undefined && props[incomeCfg.var] >= 0)
                    content += `<br/>Mean Income: ${formatValue(props[incomeCfg.var], incomeCfg)}`;
            }

            if (cfg && props[cfg.var] !== undefined && props[cfg.var] >= 0 && !['renter','poverty','unemployment','income'].includes(currentDataType)) {
                content += `<br/>${cfg.legendTitle}: ${formatValue(props[cfg.var], cfg)}`;
            }
        }
        this._div.innerHTML = `<h4>${title}</h4>${content}`;
    };
    info.addTo(map);

    // Move info control to center top after adding to map
    setTimeout(() => {
        const infoControl = document.querySelector('.leaflet-top.leaflet-left .info');
        if (infoControl && infoControl.parentElement) {
            const parent = infoControl.parentElement;
            parent.style.position = 'absolute';
            parent.style.top = '10px';
            parent.style.left = '50%';
            parent.style.transform = 'translateX(-50%)';
            parent.style.zIndex = '1000';
        }
    }, 100);
}

function initializeLegendControls() {
    // Main data legend
    legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'info legend');
        this.update();
        return this._div;
    };
    legend.update = function () {
        const div = this._div;
        const cfg = METRICS_CONFIG[currentDataType];
        if (!cfg) {
            div.style.display = 'none';
            return;
        }

        const { breaks, palette } = getActiveBreaksAndPalette();
        if (!breaks || breaks.length === 0) {
            div.style.display = 'none';
            return;
        }

        const labels = [`<strong>${cfg.legendTitle || cfg.title}</strong>`];
        for (let i = 0; i < breaks.length - 1; i++) {
            const from = breaks[i];
            const to = breaks[i + 1];
            const color = palette[i] || palette[palette.length - 1];
            labels.push(`<i style="background:${color}"></i> ${formatLegendValue(from, cfg)}&ndash;${formatLegendValue(to, cfg)}`);
        }
        div.innerHTML = labels.join('<br>');
        div.style.display = 'block';
    };
    legend.addTo(map);

    // Overlay legend (Transit/Parks)
    overlayLegend = L.control({ position: 'bottomleft' });
    overlayLegend.onAdd = function(map){
        this._div = L.DomUtil.create('div', 'info legend');
        this.update();
        return this._div;
    };
    overlayLegend.update = function() {
        const div = this._div;
        const transitOn = document.getElementById('toggle-transit')?.checked;
        const parksOn = document.getElementById('toggle-parks')?.checked;
        const lines = [];

        if (transitOn || parksOn) lines.push('<strong>Overlays</strong>');
        if (transitOn) {
            lines.push(`<i style="background:#1f77b4;border-radius:50%;width:12px;height:12px;margin-top:3px"></i> Transit Stop`);
        }
        if (parksOn) {
            lines.push(`<i style="background:rgba(34,139,34,0.3);border:2px solid #228B22;width:12px;height:12px;margin-top:3px"></i> Park`);
        }

        if (lines.length === 0) {
            div.style.display = 'none';
            div.innerHTML = '';
        } else {
            div.innerHTML = lines.join('<br>');
            div.style.display = 'block';
        }
    };
    overlayLegend.addTo(map);
}

function getVisibleValues(cfg) {
    if (!precinctLayer) return [];
    const vals = [];
    let undefinedCount = 0;
    precinctLayer.getLayers().forEach(l => {
        const v = getMetricValue(l.feature.properties, cfg);
        if (v !== undefined && v >= 0) {
            vals.push(v);
        } else if (v === undefined) {
            undefinedCount++;
        }
    });
    
    if (vals.length === 0) {
        console.log(`⚠️ No data found for ${cfg.var} (${cfg.title}). ${undefinedCount} precincts have undefined values.`);
    }
    
    return vals;
}

export function getActiveBreaksAndPalette() {
    const cfg = METRICS_CONFIG[currentDataType];
    if (!cfg) return { breaks: [], palette: [] };

    const palette = cfg.palette;
    const bucketCount = palette.length;

    if (!useDynamicScale) {
        // Fallback to simple fixed ranges
        if (cfg.type === 'percent') {
            const breaks = [0, 20, 40, 60, 80, 100];
            return { breaks, palette };
        } else if (currentDataType === 'income') {
            const breaks = [40000, 60000, 80000, 100000, 120000, 140000];
            return { breaks, palette };
        } else {
            const vals = getVisibleValues(cfg);
            if (!vals.length) return { breaks: [], palette };
            const min = Math.min(...vals), max = Math.max(...vals);
            return { breaks: equalIntervalBreaks(min, max, bucketCount+1), palette };
        }
    }

    const vals = getVisibleValues(cfg).filter(v=>isFinite(v));
    if (!vals.length) return { breaks: [], palette };

    const min = cfg.type === 'percent' ? 0 : Math.min(...vals);
    const max = Math.max(...vals);
    let breaks = quantileBreaks(vals, bucketCount+1);

    // Ensure first break starts at baseline (0 for percent) and last equals max
    breaks[0] = min;
    breaks[breaks.length-1] = max;

    // Ensure strictly increasing
    for (let i=1;i<breaks.length;i++) {
        if (breaks[i] <= breaks[i-1]) breaks[i] = breaks[i-1] + (max-min)/(bucketCount);
    }

    return { breaks, palette };
}

export function style(feature) {
    let fillColor = '#f0f0f0';
    let fillOpacity = 0.7;

    const cfg = METRICS_CONFIG[currentDataType];
    if (cfg) {
        const v = getMetricValue(feature.properties, cfg);
        const { breaks, palette } = getActiveBreaksAndPalette();
        if (breaks.length) fillColor = colorForValue(v, breaks, palette);
    }

    return { fillColor, weight: 2, opacity: 1, color: 'white', fillOpacity };
}

function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({ weight: 4, color: '#333' });
    if (!L.Browser.ie) {
        layer.bringToFront();
    }
    info.update(layer.feature.properties);
}

function resetHighlight(e) {
    precinctLayer.resetStyle(e.target);
    info.update();
}

export function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => map.fitBounds(e.target.getBounds())
    });
}

export function createPrecinctLayer(geojsonData) {
    precinctLayer = L.geoJSON(geojsonData, { style, onEachFeature }).addTo(map);
    return precinctLayer;
}

export function updateMapView() {
    const selectedValue = document.getElementById('data-selector').value;
    currentDataType = selectedValue;

    // Update the map styling
    if (precinctLayer) {
        precinctLayer.setStyle(style);
    }

    // Update legend
    legend.update();

    // Update info panel
    info.update();

    // Update overlays
    updateOverlays();
}

function updateOverlays() {
    const transitOn = document.getElementById('toggle-transit')?.checked;
    const parksOn = document.getElementById('toggle-parks')?.checked;

    // Handle transit overlay
    if (transitOn) {
        if (!map.hasLayer(transitLayer)) transitLayer.addTo(map);
    } else {
        if (map.hasLayer(transitLayer)) map.removeLayer(transitLayer);
    }

    // Handle parks overlay
    if (parksOn) {
        if (!map.hasLayer(parksLayer)) parksLayer.addTo(map);
    } else {
        if (map.hasLayer(parksLayer)) map.removeLayer(parksLayer);
    }

    overlayLegend.update();
}

export function getMapBBox() {
    const b = precinctLayer?.getBounds?.() || map.getBounds();
    const s = b.getSouth();
    const w = b.getWest();
    const n = b.getNorth();
    const e = b.getEast();
    return { s, w, n, e };
}
