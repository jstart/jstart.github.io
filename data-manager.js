// Census data fetching and management functionality
import { CENSUS_DATA_CHUNKS, BASE_CENSUS_VARS, DATA_URLS, METRICS_CONFIG } from './config.js';
import { showLoadingProgress, fetchData } from './utils.js';
import { precinctLayer, info } from './map-core.js';

// Global data state
export let variableLabels = {};
export let fullDataLoaded = false;
export let fullData = {};

export async function fetchFipsCode(layer) {
    const props = layer.feature.properties;
    if (props.FIPS) return;
    
    const center = layer.getBounds().getCenter();
    try {
        const response = await fetch(`https://geo.fcc.gov/api/census/block/find?latitude=${center.lat}&longitude=${center.lng}&format=json`);
        if (!response.ok) throw new Error(`FCC API Error`);
        const data = await response.json();
        props.FIPS = (data.Block && data.Block.FIPS) ? data.Block.FIPS : null;
    } catch (error) {
        console.error(`[${props.Precinct_ID}] FIPS fetch error:`, error);
        props.FIPS = null;
    }
}

export async function loadVariableLabels() {
    if (Object.keys(variableLabels).length > 0) {
        console.log('Variable labels already loaded');
        return;
    }

    console.log('Loading ACS variable labels...');
    showLoadingProgress(true, 'Loading variable labels...', 0);

    try {
        const csvData = await fetchData(DATA_URLS.variableLabels);
        const parsed = Papa.parse(csvData, { header: true });
        
        parsed.data.forEach(row => {
            if (row.Variable && row.Label) {
                variableLabels[row.Variable] = row.Label;
            }
        });

        console.log(`Loaded ${Object.keys(variableLabels).length} variable labels`);
        
        // Show which config variables we have labels for
        const allConfigVars = Object.values(METRICS_CONFIG).map(metric => metric.var);
        const foundVars = allConfigVars.filter(v => variableLabels[v]);
        const missingVars = allConfigVars.filter(v => !variableLabels[v]);
        
        console.log(`🔍 Found labels for ${foundVars.length}/${allConfigVars.length} config variables`);
        console.log(`🔍 Sample found variables: ${foundVars.slice(0, 5).join(', ')}`);
        if (missingVars.length > 0) {
            console.log(`⚠️ Missing labels for ${missingVars.length} variables: ${missingVars.slice(0, 5).join(', ')}`);
        }
        
        // Show sample variable labels
        const sampleLabels = Object.entries(variableLabels).slice(0, 3);
        console.log(`🔍 Sample variable labels:`, sampleLabels);

        showLoadingProgress(false);
    } catch (error) {
        console.error('Error loading variable labels:', error);
        showLoadingProgress(false);
    }
}export async function loadFullData() {
    if (fullDataLoaded) {
        console.log('Full data already loaded');
        return;
    }

    console.log('🔍 Starting loadFullData() with JSON...');
    
    try {
        await loadVariableLabels();
        
        console.log('Loading full demographic data from JSON...');
        showLoadingProgress(true, 'Loading demographic data...', 25);

        // Add cache busting to ensure we get the latest file
        const cacheBuster = new Date().getTime();
        const response = await fetch(`${DATA_URLS.fullData}?v=${cacheBuster}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const jsonData = await response.json();
        console.log('Parsing demographic data...');
        showLoadingProgress(true, 'Processing demographic data...', 50);

        // JSON data is an array of objects with nested ACS_2022 data
        jsonData.forEach(row => {
            if (row.Precinct_ID && row.ACS_2022) {
                // Flatten the structure by combining basic info with ACS data
                const combinedData = {
                    ...row,
                    ...row.ACS_2022
                };
                fullData[row.Precinct_ID] = combinedData;
            }
        });

        console.log(`🔍 Loaded full data for ${Object.keys(fullData).length} precincts`);
        
        // Debug: show sample data structure
        const firstPrecinct = Object.keys(fullData)[0];
        if (firstPrecinct) {
            const allColumns = Object.keys(fullData[firstPrecinct]);
            console.log(`🔍 Total JSON properties: ${allColumns.length}`);
            
            // Check for specific columns we need (updated to use JSON field names)
            const testVars = [
                'Percent!!CLASS OF WORKER!!Civilian employed population 16 years and over!!Government workers',
                'Percent!!PERCENTAGE OF FAMILIES AND PEOPLE WHOSE INCOME IN THE PAST 12 MONTHS IS BELOW THE POVERTY LEVEL!!All people',
                'Percent!!HOUSING TENURE!!Occupied housing units!!Renter-occupied'
            ];
            testVars.forEach(varName => {
                if (fullData[firstPrecinct][varName] !== undefined) {
                    console.log(`🔍 Found direct variable ${varName} = ${fullData[firstPrecinct][varName]}`);
                }
            });
            
            // Check for government worker related columns
            const govColumns = allColumns.filter(col => col.includes('Government'));
            console.log(`🔍 Government-related properties found: ${govColumns.length}`);
            if (govColumns.length > 0) {
                console.log(`🔍 Sample government properties:`, govColumns.slice(0, 3));
            }
        }
        
        fullDataLoaded = true;

        // Mark all demographic categories as loaded since JSON contains comprehensive data
        console.log('🔍 Marking all census data chunks as loaded since JSON contains comprehensive data...');
        precinctLayer.getLayers().forEach(layer => {
            const props = layer.feature.properties;
            // Mark all chunk variables as loaded by setting them to a default value
            Object.values(CENSUS_DATA_CHUNKS).forEach(chunk => {
                chunk.vars.forEach(variable => {
                    if (props[variable] === undefined) {
                        props[variable] = -1; // Use -1 to indicate "no data" but loaded
                    }
                });
            });
        });

        // Now apply the data to the map layers
        console.log('🔍 Applying full data to layers...');
        applyFullDataToLayers();

        showLoadingProgress(false);
    } catch (error) {
        console.error('Error loading full demographic data:', error);
        info.update(null, 'Error loading demographic data. Please try again.');
        showLoadingProgress(false);
    }
}

function applyFullDataToLayers() {
    if (!precinctLayer || precinctLayer.getLayers().length === 0) {
        console.log('No precinct layers to apply data to');
        return;
    }

    console.log('Applying full demographic data to map layers...');
    console.log(`🔍 Available variables in variableLabels: ${Object.keys(variableLabels).length}`);
    console.log(`🔍 Available data for precincts: ${Object.keys(fullData).length}`);
    
    let appliedCount = 0;
    let mappingCount = 0;

    precinctLayer.getLayers().forEach(layer => {
        const props = layer.feature.properties;
        const precinctId = props.Precinct_ID || props.PRECINCT;
        
        if (precinctId && fullData[precinctId]) {
            const demographicData = fullData[precinctId];
            
            // Apply data using direct field name mapping (since JSON uses descriptive field names)
            Object.values(METRICS_CONFIG).forEach(metric => {
                const variable = metric.var;
                
                // For JSON data with descriptive field names, use the variable directly
                let value = demographicData[variable];
                
                // Enhanced debugging for key variables
                if (variable.includes('Government workers') || variable.includes('POVERTY') || variable.includes('HOUSING TENURE')) {
                    console.log(`🔍 Debug - Precinct: ${layer.feature.properties.NAME || precinctId}`);
                    console.log(`   Variable: ${variable.substring(0, 80)}...`);
                    console.log(`   Value: "${value}" (type: ${typeof value})`);
                }
                
                if (value !== undefined && value !== '' && value !== null) {
                    // Convert string values to numbers
                    if (typeof value === 'string') {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            value = numValue;
                        }
                    }
                    
                    // Validate values for percentage fields - if value > 100, likely raw count not percentage
                    if (metric.type === 'percent' && typeof value === 'number' && value > 100) {
                        const precinctName = layer.feature.properties.NAME || layer.feature.properties.Precinct_ID || 'Unknown';
                        console.log(`⚠️ Skipping ${variable} - value ${value} too high for percentage - Precinct: ${precinctName}`);
                        return; // Skip this mapping
                    }
                    
                    props[variable] = value;
                    mappingCount++;
                    if (mappingCount <= 10) {
                        console.log(`🔍 Mapped ${variable.substring(0, 50)}... = ${value} (${typeof value})`);
                    }
                } else {
                    if (mappingCount < 5) {
                        console.log(`⚠️ No value found for ${variable.substring(0, 50)}...`);
                    }
                }
            });
            
            appliedCount++;
        }
    });

    console.log(`Applied demographic data to ${appliedCount} precincts with ${mappingCount} total mappings`);
    info.update(null, `Demographic data loaded for ${appliedCount} precincts`);
    
    // Update the data manager UI to reflect loaded data
    updateDataManagerUI();
}

export async function fetchCensusChunk(layer, varList) {
    const props = layer.feature.properties;
    if (!props.FIPS) return;
    
    try {
        const [state, county, tract] = [props.FIPS.substring(0, 2), props.FIPS.substring(2, 5), props.FIPS.substring(5, 11)];
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5/profile?get=${varList.join(',')}&for=tract:${tract}&in=state:${state}&in=county:${county}`;
        const response = await fetch(censusUrl);
        if (!response.ok) throw new Error(`Census API Error`);
        const censusData = await response.json();
        
        if (censusData && censusData.length > 1) {
            varList.forEach((variable, index) => {
                const val = parseFloat(censusData[1][index]);
                props[variable] = val < 0 ? -1 : val;
            });
        }
    } catch (error) {
        console.error(`[${props.Precinct_ID}] Census fetch error:`, error);
    }
}

export async function fetchAllDataForChunk(chunkKey) {
    const chunk = CENSUS_DATA_CHUNKS[chunkKey];
    if (!chunk) {
        console.error(`Unknown chunk key: ${chunkKey}`);
        return;
    }

    // If we have full JSON data loaded, don't make API calls
    if (fullDataLoaded) {
        console.log(`✅ Skipping API fetch for ${chunk.name} - data already available in JSON`);
        info.update(null, `${chunk.name} data already loaded from JSON.`);
        updateDataManagerUI();
        return;
    }

    if (!precinctLayer || precinctLayer.getLayers().length === 0) {
        console.error('Precinct layer not loaded yet');
        info.update(null, 'Map data not ready. Please wait for precincts to load.');
        return;
    }

    const button = document.getElementById(`btn-${chunkKey}`);
    if (button) {
        button.disabled = true;
        button.textContent = 'Fetching...';
    }

    const layers = precinctLayer.getLayers();
    const totalLayers = layers.length;
    console.log(`Fetching ${chunk.name} for ${totalLayers} precincts`);

    // Show initial loading progress
    showLoadingProgress(true, `Fetching ${chunk.name}...`, 0);

    for (let i = 0; i < layers.length; i++) {
        const progress = ((i + 1) / totalLayers) * 100;
        const currentPrecinct = layers[i].feature.properties.Precinct_ID || `${i + 1}`;

        // Update loading overlay
        showLoadingProgress(true, `Fetching ${chunk.name} for precinct ${currentPrecinct}`, progress);

        const layer = layers[i];
        if (!layer.feature.properties.FIPS) {
            showLoadingProgress(true, `Getting location data for precinct ${currentPrecinct}`, progress);
            await fetchFipsCode(layer);
        }

        showLoadingProgress(true, `Fetching census data for precinct ${currentPrecinct}`, progress);
        await fetchCensusChunk(layer, chunk.vars);
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Hide loading overlay and update UI
    showLoadingProgress(false);
    updateDataManagerUI();
    info.update(null, `${chunk.name} data loaded successfully.`);

    // Auto-save to localStorage after fetching data
    saveToLocalStorage();

    // Reset button state
    if (button) {
        button.textContent = 'Fetch';
    }
}

export async function fetchAllChunks() {
    // If we have full JSON data loaded, don't make API calls
    if (fullDataLoaded) {
        console.log('✅ Skipping all API fetches - comprehensive data already loaded from JSON');
        info.update(null, 'All demographic data already loaded from JSON.');
        return;
    }

    if (!precinctLayer || precinctLayer.getLayers().length === 0) {
        console.error('Precinct layer not loaded yet');
        info.update(null, 'Map data not ready. Please wait for precincts to load first.');
        return;
    }

    console.log('Starting to fetch all census chunks...');
    const chunkKeys = Object.keys(CENSUS_DATA_CHUNKS);
    const total = chunkKeys.length;
    console.log(`Will fetch ${total} chunks:`, chunkKeys);

    for (let i = 0; i < total; i++) {
        const key = chunkKeys[i];
        const name = CENSUS_DATA_CHUNKS[key].name;
        console.log(`Fetching chunk ${i + 1}/${total}: ${key} (${name})`);
        showLoadingProgress(true, `Fetching ${name} (${i + 1} of ${total})...`, ((i) / total) * 100);
        await fetchAllDataForChunk(key);
    }
    
    showLoadingProgress(false);
    info.update(null, 'All census chunks fetched.');
    console.log('Completed fetching all census chunks.');
}

function saveToLocalStorage() {
    try {
        const dataToSave = {};
        precinctLayer.getLayers().forEach(layer => {
            const props = layer.feature.properties;
            if (props.Precinct_ID) {
                const precinctData = { FIPS: props.FIPS };
                const allVars = [...BASE_CENSUS_VARS, ...Object.values(CENSUS_DATA_CHUNKS).flatMap(c => c.vars)];
                allVars.forEach(v => { 
                    if (props[v] !== undefined) precinctData[v] = props[v]; 
                });
                dataToSave[props.Precinct_ID] = precinctData;
            }
        });
        localStorage.setItem('torrance-precinct-data', JSON.stringify(dataToSave));
        console.log("Data auto-saved to localStorage.");
    } catch (e) {
        console.log("Warning: Could not save data to localStorage:", e);
    }
}

export function saveDataToFile() {
    const dataToSave = {};
    precinctLayer.getLayers().forEach(layer => {
        const props = layer.feature.properties;
        if (props.Precinct_ID) {
            const precinctData = { FIPS: props.FIPS };
            const allVars = [...BASE_CENSUS_VARS, ...Object.values(CENSUS_DATA_CHUNKS).flatMap(c => c.vars)];
            allVars.forEach(v => { 
                if (props[v] !== undefined) precinctData[v] = props[v]; 
            });
            dataToSave[props.Precinct_ID] = precinctData;
        }
    });

    const dataStr = JSON.stringify(dataToSave, null, 2);

    // Save to localStorage for future sessions
    localStorage.setItem('torrance-precinct-data', dataStr);
    console.log("Data saved to localStorage for future sessions.");

    // Also download as file
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = 'precinct-data.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    // Update user with success message
    info.update(null, "Data saved to browser cache and downloaded as file.");
}

export function updateDataManagerUI() {
    const container = document.getElementById('data-chunks-container');
    if (!container || !precinctLayer || precinctLayer.getLayers().length === 0) return;
    
    container.innerHTML = '';
    const firstLayerProps = precinctLayer.getLayers()[0].feature.properties;

    Object.entries(CENSUS_DATA_CHUNKS).forEach(([key, chunk]) => {
        // If we have full JSON data loaded, consider all chunks as available
        const isLoaded = fullDataLoaded || chunk.vars.every(v => firstLayerProps[v] !== undefined);
        const div = document.createElement('div');
        div.className = 'data-chunk';
        
        let statusText = '';
        let buttonText = '';
        
        if (fullDataLoaded) {
            statusText = ' (Available in JSON)';
            buttonText = 'View';  // Change from "Fetch" to "View" since data is already loaded
        } else if (isLoaded) {
            statusText = ' (Loaded)';
            buttonText = 'Fetch';
        } else {
            statusText = ' (Not Loaded)';
            buttonText = 'Fetch';
        }
        
        div.innerHTML = `
            <div>
                <span>${chunk.name}</span>
                <span class="${isLoaded || fullDataLoaded ? 'status-loaded' : 'status-not-loaded'}">${statusText}</span>
            </div>
            <button id="btn-${key}" onclick="window.fetchAllDataForChunk('${key}')" ${(isLoaded || fullDataLoaded) ? 'disabled' : ''}>${buttonText}</button>
        `;
        container.appendChild(div);
    });
}
