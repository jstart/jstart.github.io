
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

        // Fit map to precincts
        const bounds = precinctLayer.getBounds();
        if (bounds && bounds.isValid()) {
            console.log('Fitting map to precinct bounds');
            map.fitBounds(bounds, { padding: [10, 10] });
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
    document.getElementById('fetch-all-btn').addEventListener('click', fetchAllChunks);
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

    // Respond to map movement for dynamic styling
    map.on('moveend', () => {
        if (precinctLayer) {
            precinctLayer.setStyle();
        }
    });

    console.log('Event listeners set up successfully');
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApplication);

// Log helpful information
console.log('%c🚌🌳 Torrance Data Visualizer', 'color: #228B22; font-size: 16px; font-weight: bold;');
console.log('%cType loadTransit() or loadParks() to load overlay data', 'color: #666;');
