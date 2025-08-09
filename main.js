
// main.js - Main application file that initializes the map and ties everything together
import { DATA_URLS } from './config.js';
import { initializeMapCore, updateMapView, map, createPrecinctLayer, precinctLayer, info } from './map-core.js';
import { fetchData } from './utils.js';
import { loadTransit, loadParks } from './overlays.js';
import { fetchAllDataForChunk, fetchAllChunks, saveDataToFile, updateDataManagerUI, loadFullData } from './data-manager.js';

// Make functions globally accessible
window.fetchAllDataForChunk = fetchAllDataForChunk;
window.fetchAllChunks = fetchAllChunks;
window.loadTransit = loadTransit;
window.loadParks = loadParks;
window.saveDataToFile = saveDataToFile;
window.updateMapView = updateMapView;
window.loadFullData = loadFullData;

// Main initialization function
async function initializeApplication() {
    console.log('Starting application initialization...');

    // Initialize core map components
    initializeMapCore();

    try {
        // Load base map data
        console.log('Fetching CSV and GeoJSON data...');
        const [csvData, geojsonDataString] = await Promise.all([
            fetchData(DATA_URLS.csv),
            fetchData(DATA_URLS.geojson)
        ]);
        console.log('Data fetched successfully, parsing...');

        // Parse the data
        const geojsonFeatureCollection = JSON.parse(geojsonDataString);
        const parsedCsv = Papa.parse(csvData, { header: true, dynamicTyping: true });
        const overlayData = new Map(parsedCsv.data.map(row => [row.Precinct_ID, row]));

        // Enhance GeoJSON with CSV data
        geojsonFeatureCollection.features = geojsonFeatureCollection.features.filter(f =>
            overlayData.has(f.properties.PRECINCT)
        );

        geojsonFeatureCollection.features.forEach(f =>
            Object.assign(f.properties, overlayData.get(f.properties.PRECINCT))
        );

        // Create the precinct layer
        console.log(`Creating precinct layer with ${geojsonFeatureCollection.features.length} features`);
        createPrecinctLayer(geojsonFeatureCollection);

        // Load full demographic data
        console.log('Loading full demographic data...');
        await loadFullData();

        // Try to load data from localStorage (saved from previous sessions)
        tryLoadFromLocalStorage();

        // Setup UI and event listeners
        setupEventListeners();

        // Initialize mobile-specific state
        initializeMobileState();

        // Fit map to precincts
        const bounds = precinctLayer.getBounds();
        if (bounds && bounds.isValid()) {
            console.log('Fitting map to precinct bounds');
            // Get the center of the bounds
            const center = bounds.getCenter();
            console.log('Setting map center to:', center, 'with zoom level 14');

            // Set to a specific high zoom level instead of using fitBounds
            map.setView([center.lat, center.lng], 13, { animate: true });
        }

        // Initial update of map view
        updateMapView();

        console.log('Application initialization completed successfully');

    } catch (error) {
        console.error("Error initializing map:", error);
        document.getElementById('map').innerHTML =
            `<div class="info" style="position:absolute;top:10px;left:10px;padding:10px;background-color:#f8d7da;color:#721c24;z-index:1000;">
                <strong>Error:</strong> Could not load map data.<br/>${error.message}
            </div>`;
    }
}

function tryLoadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('torrance-precinct-data');
        if (savedData) {
            const localData = JSON.parse(savedData);
            precinctLayer.getLayers().forEach(layer => {
                const precinctId = layer.feature.properties.Precinct_ID;
                if (localData[precinctId]) {
                    Object.assign(layer.feature.properties, localData[precinctId]);
                }
            });
            info.update(null, `Demographic data loaded from browser cache.`);
            updateDataManagerUI();
        } else {
            info.update(null, "Click 'Manage Data' to fetch census info.");
        }
    } catch (e) {
        console.log("Error loading data from localStorage:", e);
        info.update(null, "Click 'Manage Data' to fetch census info.");
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    document.getElementById('data-selector').addEventListener('change', updateMapView);
    document.getElementById('toggle-transit').addEventListener('change', updateMapView);
    document.getElementById('toggle-parks').addEventListener('change', updateMapView);
    document.getElementById('save-data-btn').addEventListener('click', saveDataToFile);
    // document.getElementById('fetch-all-btn').addEventListener('click', fetchAllChunks);

    // Fullscreen functionality
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);

    // Minimize panel functionality
    document.getElementById('minimize-btn').addEventListener('click', toggleControlPanel);

    document.getElementById('manage-data-btn').addEventListener('click', () => {
        document.getElementById('data-manager-panel').style.display = 'block';
    });

    const panelFetchBtn = document.getElementById('panel-fetch-all-btn');
    if (panelFetchBtn) {
        panelFetchBtn.addEventListener('click', fetchAllChunks);
    }

    const loadFullDataBtn = document.getElementById('load-full-data-btn');
    if (loadFullDataBtn) {
        loadFullDataBtn.addEventListener('click', loadFullData);
    }

    // Add event listener for panel close button
    const panelCloseBtn = document.getElementById('panel-close-btn');
    if (panelCloseBtn) {
        panelCloseBtn.addEventListener('click', () => {
            document.getElementById('data-manager-panel').style.display = 'none';
        });
    }

    // Handle window resize to manage mobile state changes
    window.addEventListener('resize', () => {
        // Debounce resize events
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            initializeMobileState();
        }, 250);
    });

    // Respond to map movement for dynamic styling
    map.on('moveend', () => {
        if (precinctLayer) {
            precinctLayer.setStyle();
        }
    });

    console.log('Event listeners set up successfully');
}

// Initialize mobile-specific UI state
function initializeMobileState() {
    // Check if device is mobile based on screen width
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Minimize control panel by default on mobile
        const controlPanel = document.querySelector('.control-panel');
        const minimizeIcon = document.getElementById('minimize-icon');

        controlPanel.classList.add('minimized');
        minimizeIcon.textContent = '+';
        minimizeIcon.parentElement.setAttribute('title', 'Show Controls');

        console.log('Mobile device detected - control panel minimized by default');
    }
}

// Fullscreen functionality
function toggleFullscreen() {
    const isFullscreen = document.body.classList.contains('fullscreen');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    const fullscreenText = document.getElementById('fullscreen-text');

    if (!isFullscreen) {
        // Enter fullscreen
        document.body.classList.add('fullscreen');
        fullscreenIcon.textContent = '⛉';
        fullscreenText.textContent = 'Exit Fullscreen';

        // Request browser fullscreen if supported
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen request failed:', err);
            });
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }

    } else {
        // Exit fullscreen
        document.body.classList.remove('fullscreen');
        fullscreenIcon.textContent = '⛶';
        fullscreenText.textContent = 'Fullscreen';

        // Exit browser fullscreen if supported
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.log('Exit fullscreen failed:', err);
            });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Trigger map resize after fullscreen change
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

// Control panel minimize/expand functionality
function toggleControlPanel() {
    const controlPanel = document.querySelector('.control-panel');
    const minimizeIcon = document.getElementById('minimize-icon');
    const isMinimized = controlPanel.classList.contains('minimized');

    if (isMinimized) {
        // Expand the panel
        controlPanel.classList.remove('minimized');
        minimizeIcon.textContent = '−';
        minimizeIcon.setAttribute('title', 'Hide Controls');
    } else {
        // Minimize the panel
        controlPanel.classList.add('minimized');
        minimizeIcon.textContent = '+';
        minimizeIcon.setAttribute('title', 'Show Controls');
    }

    // Trigger map resize after panel change
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 300); // Match the CSS transition duration
}

// Listen for fullscreen changes from browser (F11, ESC, etc.)
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    const isInFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    const bodyHasFullscreen = document.body.classList.contains('fullscreen');

    // Sync our CSS class with browser fullscreen state
    if (!isInFullscreen && bodyHasFullscreen) {
        document.body.classList.remove('fullscreen');
        document.getElementById('fullscreen-icon').textContent = '⛶';
        document.getElementById('fullscreen-text').textContent = 'Fullscreen';
    }

    // Resize map when fullscreen changes
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApplication);

// Log helpful information
console.log('%c🚌🌳 Torrance Data Visualizer', 'color: #228B22; font-size: 16px; font-weight: bold;');
console.log('%cType loadTransit() or loadParks() to load overlay data', 'color: #666;');
