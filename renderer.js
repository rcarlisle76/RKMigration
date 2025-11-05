const { ipcRenderer } = require('electron');
const jsforce = require('jsforce');
const Papa = require('papaparse');

// Global state
let sfConnection = null;
let sfObjects = [];
let csvData = null;
let csvFields = [];
let sfFields = [];
let fieldMappings = [];

// DOM Elements
const sfConnectBtn = document.getElementById('sf-connect-btn');
const sfDisconnectBtn = document.getElementById('sf-disconnect-btn');
const sfLoginForm = document.getElementById('sf-login-form');
const sfConnectedSection = document.getElementById('sf-connected-section');
const sfStatus = document.getElementById('sf-status');
const sfUserInfo = document.getElementById('sf-user-info');
const sfObjectSelect = document.getElementById('sf-object-select');
const sfObjectSearch = document.getElementById('sf-object-search');
const sfFieldsSection = document.getElementById('sf-fields-section');
const sfFieldsList = document.getElementById('sf-fields-list');

const loadCsvBtn = document.getElementById('load-csv-btn');
const csvFileName = document.getElementById('csv-file-name');
const csvDataSection = document.getElementById('csv-data-section');
const csvRowCount = document.getElementById('csv-row-count');
const csvFieldsList = document.getElementById('csv-fields-list');

const mappingSection = document.getElementById('mapping-section');
const mappingList = document.getElementById('mapping-list');
const saveMappingBtn = document.getElementById('save-mapping-btn');
const loadMappingBtn = document.getElementById('load-mapping-btn');
const clearMappingBtn = document.getElementById('clear-mapping-btn');

// Salesforce Connection
sfConnectBtn.addEventListener('click', async () => {
    const url = document.getElementById('sf-url').value;
    const username = document.getElementById('sf-username').value;
    const password = document.getElementById('sf-password').value;
    const token = document.getElementById('sf-token').value;

    if (!username || !password) {
        showStatus('Please enter username and password', 'error');
        return;
    }

    sfConnectBtn.disabled = true;
    sfConnectBtn.textContent = 'Connecting...';

    try {
        sfConnection = new jsforce.Connection({
            loginUrl: url
        });

        await sfConnection.login(username, password + token);

        showStatus('Successfully connected to Salesforce!', 'success');
        sfUserInfo.textContent = `Connected as ${username}`;

        sfLoginForm.classList.add('hidden');
        sfConnectedSection.classList.remove('hidden');

        // Load Salesforce objects
        await loadSalesforceObjects();
    } catch (error) {
        showStatus(`Connection failed: ${error.message}`, 'error');
        sfConnectBtn.disabled = false;
        sfConnectBtn.textContent = 'Connect to Salesforce';
    }
});

sfDisconnectBtn.addEventListener('click', () => {
    sfConnection = null;
    sfObjects = [];
    sfFields = [];

    sfLoginForm.classList.remove('hidden');
    sfConnectedSection.classList.add('hidden');
    sfFieldsSection.classList.add('hidden');

    document.getElementById('sf-username').value = '';
    document.getElementById('sf-password').value = '';
    document.getElementById('sf-token').value = '';

    sfConnectBtn.disabled = false;
    sfConnectBtn.textContent = 'Connect to Salesforce';
    showStatus('', '');
});

async function loadSalesforceObjects() {
    try {
        const describe = await sfConnection.describeGlobal();
        sfObjects = describe.sobjects
            .filter(obj => obj.createable || obj.updateable)
            .sort((a, b) => a.label.localeCompare(b.label));

        displaySalesforceObjects(sfObjects);
    } catch (error) {
        showStatus(`Failed to load objects: ${error.message}`, 'error');
    }
}

function displaySalesforceObjects(objects) {
    sfObjectSelect.innerHTML = objects.map(obj =>
        `<option value="${obj.name}">${obj.label} (${obj.name})${obj.custom ? ' [Custom]' : ''}</option>`
    ).join('');
}

// Object search filter
sfObjectSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = sfObjects.filter(obj =>
        obj.name.toLowerCase().includes(searchTerm) ||
        obj.label.toLowerCase().includes(searchTerm)
    );
    displaySalesforceObjects(filtered);
});

// Load Salesforce fields when object is selected
sfObjectSelect.addEventListener('change', async (e) => {
    const objectName = e.target.value;
    if (!objectName) return;

    try {
        const describe = await sfConnection.sobject(objectName).describe();
        sfFields = describe.fields.sort((a, b) => a.label.localeCompare(b.label));

        displaySalesforceFields(sfFields);
        sfFieldsSection.classList.remove('hidden');

        // Show mapping section if CSV is loaded
        if (csvData) {
            updateMappingSection();
        }
    } catch (error) {
        showStatus(`Failed to load fields: ${error.message}`, 'error');
    }
});

function displaySalesforceFields(fields) {
    sfFieldsList.innerHTML = fields.map(field => `
        <div class="field-item" data-field-name="${field.name}">
            <div class="field-name">${field.label}</div>
            <span class="field-type">${field.type}</span>
            <div class="field-details">
                API Name: ${field.name}
                ${field.required ? ' • <strong>Required</strong>' : ''}
                ${field.unique ? ' • Unique' : ''}
                ${field.length ? ` • Max Length: ${field.length}` : ''}
                ${field.picklistValues && field.picklistValues.length > 0 ? ` • Picklist (${field.picklistValues.length} values)` : ''}
            </div>
        </div>
    `).join('');
}

// CSV Loading
loadCsvBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-csv-file');

    if (result) {
        csvFileName.textContent = result.filePath.split(/[\\/]/).pop();
        parseCSV(result.content);
    }
});

function parseCSV(content) {
    Papa.parse(content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            csvData = results.data;
            csvFields = analyzeCsvFields(results);

            csvRowCount.textContent = `${csvData.length} rows found`;
            displayCsvFields(csvFields);
            csvDataSection.classList.remove('hidden');

            // Show mapping section if Salesforce object is selected
            if (sfFields.length > 0) {
                updateMappingSection();
            }
        },
        error: (error) => {
            showStatus(`CSV parsing failed: ${error.message}`, 'error');
        }
    });
}

function analyzeCsvFields(results) {
    const fields = [];
    const headers = results.meta.fields;

    headers.forEach(header => {
        const values = results.data.map(row => row[header]).filter(v => v != null && v !== '');
        const detectedType = detectFieldType(values);
        const sampleValues = values.slice(0, 5);

        fields.push({
            name: header,
            type: detectedType,
            sampleValues: sampleValues,
            nullCount: results.data.length - values.length,
            uniqueCount: new Set(values).size
        });
    });

    return fields;
}

function detectFieldType(values) {
    if (values.length === 0) return 'Unknown';

    const sample = values.filter(v => v !== null && v !== '');
    if (sample.length === 0) return 'Unknown';

    // Check for numbers
    const allNumbers = sample.every(v => typeof v === 'number' || !isNaN(v));
    if (allNumbers) {
        const hasDecimals = sample.some(v => String(v).includes('.'));
        return hasDecimals ? 'Double' : 'Integer';
    }

    // Check for booleans
    const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0', true, false, 1, 0]);
    const allBools = sample.every(v => boolValues.has(String(v).toLowerCase()) || boolValues.has(v));
    if (allBools) return 'Boolean';

    // Check for dates
    const possibleDate = sample.some(v => {
        const dateVal = new Date(v);
        return dateVal instanceof Date && !isNaN(dateVal);
    });
    if (possibleDate) return 'Date/DateTime';

    // Default to string
    const maxLength = Math.max(...sample.map(v => String(v).length));
    return maxLength > 255 ? 'Text (Long)' : 'Text';
}

function displayCsvFields(fields) {
    csvFieldsList.innerHTML = fields.map(field => `
        <div class="field-item" data-field-name="${field.name}">
            <div class="field-name">${field.name}</div>
            <span class="field-type">${field.type}</span>
            <div class="field-details">
                Unique Values: ${field.uniqueCount} • Null Count: ${field.nullCount}
            </div>
            <div class="field-sample">
                <strong>Sample values:</strong><br>
                ${field.sampleValues.map(v => `• ${v}`).join('<br>')}
            </div>
        </div>
    `).join('');
}

// Mapping Section
function updateMappingSection() {
    mappingSection.classList.remove('hidden');

    // Initialize mappings if not already done
    if (fieldMappings.length === 0) {
        fieldMappings = csvFields.map(csvField => ({
            csvField: csvField.name,
            csvType: csvField.type,
            sfField: '',
            sfType: ''
        }));
    }

    renderMappings();
}

function renderMappings() {
    if (fieldMappings.length === 0) {
        mappingList.innerHTML = '<div class="empty-state">Load CSV and select Salesforce object to create mappings</div>';
        return;
    }

    mappingList.innerHTML = fieldMappings.map((mapping, index) => `
        <div class="mapping-item">
            <div class="mapping-source">
                <strong>${mapping.csvField}</strong>
                <div class="field-type">${mapping.csvType}</div>
            </div>
            <div class="mapping-arrow">→</div>
            <div class="mapping-target">
                <select class="mapping-select" data-index="${index}">
                    <option value="">-- Select Salesforce Field --</option>
                    ${sfFields.map(sf => `
                        <option value="${sf.name}"
                                data-type="${sf.type}"
                                ${mapping.sfField === sf.name ? 'selected' : ''}>
                            ${sf.label} (${sf.name}) - ${sf.type}
                        </option>
                    `).join('')}
                </select>
                ${mapping.sfField ? `<div class="field-type">${mapping.sfType}</div>` : ''}
            </div>
            <button class="mapping-remove" data-index="${index}">Remove</button>
        </div>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.mapping-select').forEach(select => {
        select.addEventListener('change', handleMappingChange);
    });

    document.querySelectorAll('.mapping-remove').forEach(btn => {
        btn.addEventListener('click', handleMappingRemove);
    });
}

function handleMappingChange(e) {
    const index = parseInt(e.target.dataset.index);
    const selectedOption = e.target.options[e.target.selectedIndex];

    fieldMappings[index].sfField = e.target.value;
    fieldMappings[index].sfType = selectedOption.dataset.type || '';

    renderMappings();
}

function handleMappingRemove(e) {
    const index = parseInt(e.target.dataset.index);
    fieldMappings.splice(index, 1);
    renderMappings();
}

// Save/Load Mapping
saveMappingBtn.addEventListener('click', async () => {
    const mappingData = {
        csvFile: csvFileName.textContent,
        salesforceObject: sfObjectSelect.value,
        mappings: fieldMappings,
        savedAt: new Date().toISOString()
    };

    const result = await ipcRenderer.invoke('save-mapping', mappingData);
    if (result.success) {
        showStatus(`Mapping saved to ${result.filePath}`, 'success');
    }
});

loadMappingBtn.addEventListener('click', async () => {
    const mappingData = await ipcRenderer.invoke('load-mapping');
    if (mappingData) {
        fieldMappings = mappingData.mappings;
        renderMappings();
        showStatus('Mapping loaded successfully', 'success');
    }
});

clearMappingBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all mappings?')) {
        fieldMappings = csvFields.map(csvField => ({
            csvField: csvField.name,
            csvType: csvField.type,
            sfField: '',
            sfType: ''
        }));
        renderMappings();
    }
});

// Utility Functions
function showStatus(message, type) {
    sfStatus.textContent = message;
    sfStatus.className = `status-message ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            sfStatus.className = 'status-message';
        }, 5000);
    }
}
