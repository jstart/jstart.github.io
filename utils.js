// Utility functions for data formatting and processing
import { METRICS_CONFIG } from './config.js';

export function formatValue(val, cfg) {
    if (val === undefined || val === null || val < 0) return 'N/A';
    if (cfg.type === 'currency') return `$${Number(val).toLocaleString()}`;
    if (cfg.type === 'percent') return `${Number(val).toFixed(1)}%`;
    return `${Number(val).toFixed(1)}${cfg.unit || ''}`;
}

export function formatLegendValue(val, cfg) {
    if (cfg.type === 'currency') return `$${(val/1000).toFixed(0)}k`;
    if (cfg.type === 'percent') return `${val.toFixed(0)}%`;
    return `${val.toFixed(0)}${cfg.unit || ''}`;
}

export async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    return response.text();
}

export function getMetricValue(props, cfg) {
    const v = props[cfg.var];
    return typeof v === 'number' ? v : undefined;
}

export function quantileBreaks(values, k) {
    if (!values.length) return [];
    const sorted = [...values].sort((a,b)=>a-b);
    const breaks = [];
    const count = Math.min(k, Math.max(2, Math.floor(sorted.length)));
    const buckets = count;
    const per = 1 / (buckets - 1);
    for (let i=0;i<buckets;i++) {
        const q = i*per;
        const idx = Math.floor(q*(sorted.length-1));
        breaks.push(sorted[idx]);
    }
    return Array.from(new Set(breaks));
}

export function equalIntervalBreaks(min, max, k) {
    if (min === undefined || max === undefined) return [];
    const breaks = [];
    const step = (max - min) / (k - 1);
    for (let i=0;i<k;i++) breaks.push(min + i*step);
    return breaks;
}

export function colorForValue(val, breaks, palette) {
    if (val === undefined || val === null || !isFinite(val)) return '#f0f0f0';
    for (let i = breaks.length - 1; i >= 1; i--) {
        if (val >= breaks[i-1]) return palette[i-1] || palette[palette.length-1];
    }
    return palette[0];
}

export function showLoadingProgress(show = true, text = 'Loading...', progress = 0) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const progressBar = document.getElementById('progress-bar');

    if (show) {
        overlay.style.display = 'block';
        loadingText.textContent = text;
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
    } else {
        overlay.style.display = 'none';
    }
}

// Cache management utilities
export function isCacheValid(cacheEntry, cacheDuration) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < cacheDuration;
}

export function getBboxCacheKey(bbox) {
    const {s, w, n, e} = bbox;
    // Round to reasonable precision to increase cache hits
    return `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
}

export function createGoogleMapsLink(lat, lng, name, address) {
    // If we have a specific address, use it for better accuracy
    if (address && address.trim()) {
        const encodedAddress = encodeURIComponent(address.trim());
        return `<a href="https://www.google.com/maps/search/${encodedAddress}" target="_blank" style="color: #1f77b4; text-decoration: none;">📍 Open in Google Maps</a>`;
    }
    // Otherwise use lat/lng coordinates
    return `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" style="color: #1f77b4; text-decoration: none;">📍 Open in Google Maps</a>`;
}
