// Transit stops and parks overlay functionality
import { CACHE_DURATION } from './config.js';
import { showLoadingProgress, isCacheValid, getBboxCacheKey, createGoogleMapsLink } from './utils.js';
import { transitLayer, parksLayer, getMapBBox, overlayLegend, info } from './map-core.js';

// Overlay state
export let transitLoaded = false;
export let parksLoaded = false;

// Caching for overlay data
export let transitCache = new Map();
export let parksCache = new Map();

// Helper function to create emoji icon
function createEmojiIcon(emoji, size = 20) {
    return L.divIcon({
        html: `<div style="font-size: ${size}px; text-align: center; line-height: ${size}px;">${emoji}</div>`,
        className: 'emoji-icon',
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
}

// Cached version of fetchAndDisplayOverpassData
async function fetchAndDisplayOverpassDataCached(layerGroup, query, cache, options = {}, popupContentFn) {
    console.log('fetchAndDisplayOverpassDataCached called with cache size:', cache.size);
    const bbox = getMapBBox();
    const cacheKey = getBboxCacheKey(bbox);
    console.log('Cache key:', cacheKey);

    // Check if we have valid cached data for this area
    const cachedEntry = cache.get(cacheKey);
    console.log('Cached entry exists:', !!cachedEntry);

    if (cachedEntry) {
        console.log('Cache entry timestamp:', cachedEntry.timestamp, 'Age:', Date.now() - cachedEntry.timestamp, 'ms');
        console.log('Cache duration limit:', CACHE_DURATION, 'ms');
    }

    if (isCacheValid(cachedEntry, CACHE_DURATION)) {
        console.log('Using cached overlay data for area:', cacheKey);
        layerGroup.clearLayers();

        // Re-create layers from cached data
        for (const elementData of cachedEntry.elements) {
            if (elementData.type === 'node' && elementData.lat && elementData.lon) {
                let m;
                if (options.emojiIcon) {
                    m = L.marker([elementData.lat, elementData.lon], { icon: createEmojiIcon(options.emojiIcon) });
                } else {
                    m = L.circleMarker([elementData.lat, elementData.lon], {
                        radius: 4,
                        color: options.pointColor || '#1f77b4',
                        fillColor: options.pointColor || '#1f77b4',
                        fillOpacity: 0.8,
                        weight: 1
                    });
                }
                if (popupContentFn && elementData.popup) {
                    m.bindPopup(elementData.popup);
                }
                layerGroup.addLayer(m);
            } else if (elementData.type === 'polygon' && elementData.latlngs) {
                const poly = L.polygon(elementData.latlngs, {
                    color: options.polygonColor || '#228B22',
                    weight: 2,
                    fillOpacity: 0.3,
                    fillColor: options.polygonColor || '#228B22'
                });
                if (elementData.popup) poly.bindPopup(elementData.popup);
                layerGroup.addLayer(poly);
            }
        }
        return;
    }

    // Not in cache or expired, fetch fresh data
    console.log('Fetching fresh overlay data for area:', cacheKey);
    layerGroup.clearLayers();

    try {
        const url = 'https://overpass-api.de/api/interpreter';
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }) });
        if (!res.ok) throw new Error('Overpass request failed');
        const data = await res.json();
        const elements = data.elements || [];

        // Store elements for caching
        const cacheElements = [];

        console.log(`Loaded ${elements.length} elements from Overpass`);
        for (const el of elements) {
            if (el.type === 'node' && el.lat && el.lon) {
                let m;
                if (options.emojiIcon) {
                    m = L.marker([el.lat, el.lon], { icon: createEmojiIcon(options.emojiIcon) });
                } else {
                    m = L.circleMarker([el.lat, el.lon], {
                        radius: 4,
                        color: options.pointColor || '#1f77b4',
                        fillColor: options.pointColor || '#1f77b4',
                        fillOpacity: 0.8,
                        weight: 1
                    });
                }

                let popup = null;
                if (popupContentFn) {
                    popup = popupContentFn(el.tags || {}, el.lat, el.lon);
                    m.bindPopup(popup);
                }
                layerGroup.addLayer(m);

                // Store for cache
                cacheElements.push({
                    type: 'node',
                    lat: el.lat,
                    lon: el.lon,
                    tags: el.tags,
                    popup: popup
                });

            } else if (el.type === 'way' && el.geometry && el.geometry.length > 0) {
                const latlngs = el.geometry.map(g => [g.lat, g.lon]);
                if (latlngs.length >= 3 && options.isPolygon) {
                    const poly = L.polygon(latlngs, {
                        color: options.polygonColor || '#228B22',
                        weight: 2,
                        fillOpacity: 0.3,
                        fillColor: options.polygonColor || '#228B22'
                    });

                    let popup = null;
                    if (popupContentFn) {
                        const center = poly.getBounds().getCenter();
                        popup = popupContentFn(el.tags || {}, center.lat, center.lng);
                        poly.bindPopup(popup);
                    }
                    layerGroup.addLayer(poly);

                    // Store for cache
                    cacheElements.push({
                        type: 'polygon',
                        latlngs: latlngs,
                        tags: el.tags,
                        popup: popup
                    });
                }
            }
        }

        // Cache the results
        console.log('Caching', cacheElements.length, 'elements for key:', cacheKey);
        cache.set(cacheKey, {
            elements: cacheElements,
            timestamp: Date.now()
        });
        console.log('Cache size after set:', cache.size);
        console.log(`Cached ${cacheElements.length} elements for area:`, cacheKey);

    } catch (e) {
        console.error('Overpass fetch error', e);
        info.update(null, `Could not load overlay data: ${e.message}`);
    }
}

export async function loadTransit() {
    const {s,w,n,e} = getMapBBox();
    const q = `
    [out:json][timeout:25][bbox:${s},${w},${n},${e}];
    (
      node["highway"="bus_stop"];
      node["railway"="station"];
      node["public_transport"="stop_position"];
      node["public_transport"="platform"];
      way["railway"="station"];
      way["public_transport"="station"];
    );
    out body center;`;

    showLoadingProgress(true, 'Loading transit stops from OSM...', 0);
    await fetchAndDisplayOverpassDataCached(transitLayer, q, transitCache, {
        pointColor: '#1f77b4',
        emojiIcon: '🚌'
    }, (tags, lat, lng)=>{
        // Use the most descriptive name available
        const name = tags.name || tags.ref || tags['name:en'] || 'Unnamed Stop';
        const type = tags.highway || tags.railway || tags.public_transport || 'transit';
        const operator = tags.operator ? `<br/>Operator: ${tags.operator}` : '';
        const route = tags.route_ref ? `<br/>Routes: ${tags.route_ref}` : '';
        const address = tags['addr:full'] || tags['addr:street'] || '';
        const googleMapsLink = createGoogleMapsLink(lat, lng, name, address);
        return `<b>🚌 ${name}</b><br/>Type: ${type}${operator}${route}<br/>${googleMapsLink}`;
    });

    showLoadingProgress(false);
    transitLoaded = true;
    overlayLegend.update();
}

export async function loadParks() {
    const {s,w,n,e} = getMapBBox();
    const q = `
    [out:json][timeout:25][bbox:${s},${w},${n},${e}];
    (
      node["leisure"="park"];
      node["leisure"="garden"];
      node["leisure"="playground"];
      node["leisure"="nature_reserve"];
      node["leisure"="sports_centre"];
      node["leisure"="recreation_ground"];
      node["amenity"="park"];
      node["amenity"="community_centre"];
      node["landuse"="recreation_ground"];
      node["landuse"="forest"];
      node["landuse"="grass"];
      node["natural"="wood"];
      node["natural"="grassland"];
      way["leisure"="park"];
      way["leisure"="garden"];
      way["leisure"="nature_reserve"];
      way["leisure"="recreation_ground"];
      way["leisure"="sports_centre"];
      way["landuse"="recreation_ground"];
      way["landuse"="forest"];
      way["landuse"="grass"];
      way["landuse"="greenfield"];
      way["natural"="wood"];
      way["natural"="grassland"];
      way["amenity"="community_centre"];
      relation["leisure"="park"];
      relation["leisure"="nature_reserve"];
      relation["landuse"="recreation_ground"];
      relation["landuse"="forest"];
      relation["natural"="wood"];
    );
    out body geom center tags;`;

    showLoadingProgress(true, 'Loading parks from OSM...', 0);
    await fetchAndDisplayOverpassDataCached(parksLayer, q, parksCache, {
        isPolygon: true,
        polygonColor: '#228B22',
        emojiIcon: '🌳'
    }, (tags, lat, lng)=>{
        // Use the most descriptive name available
        const name = tags.name || tags['name:en'] || tags.amenity || tags.leisure || 'Unnamed Park';
        const type = tags.leisure || tags.landuse || tags.amenity || 'park';
        const operator = tags.operator ? `<br/>Operated by: ${tags.operator}` : '';
        const website = tags.website ? `<br/><a href="${tags.website}" target="_blank" style="color: #228B22;">🌐 Website</a>` : '';
        const address = tags['addr:full'] || tags['addr:street'] || '';
        const googleMapsLink = createGoogleMapsLink(lat, lng, name, address);
        return `<b>🌳 ${name}</b><br/>Type: ${type}${operator}${website}<br/>${googleMapsLink}`;
    });

    showLoadingProgress(false);
    parksLoaded = true;
    overlayLegend.update();
}

// Cache management functions
export function clearOverlayCache() {
    transitCache.clear();
    parksCache.clear();
    console.log('Overlay cache cleared');

    // Refresh overlays if they're currently loaded
    if (transitLoaded && map.hasLayer(transitLayer)) {
        loadTransit();
    }
    if (parksLoaded && map.hasLayer(parksLayer)) {
        loadParks();
    }
}

export function getCacheStats() {
    return {
        transitCacheSize: transitCache.size,
        parksCacheSize: parksCache.size,
        totalCached: transitCache.size + parksCache.size
    };
}
