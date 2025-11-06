const { ipcRenderer } = require('electron');
const jsforce = require('jsforce');
const Papa = require('papaparse');

// Global state
let sourceType = 'csv'; // 'csv' or 'salesforce'
let sourceConnection = null;
let destConnection = null;
let sourceObjects = [];
let destObjects = [];
let sourceFields = [];
let destFields = [];
let csvData = null;
let csvFields = [];
let fieldMappings = [];

// Salesforce Connection Management
class SFConnectionManager {
    constructor(prefix) {
        this.prefix = prefix;
        this.connection = null;
        this.objects = [];
        this.fields = [];

        // Get DOM elements
        this.elements = {
            connectBtn: document.getElementById(`${prefix}-connect-btn`),
            disconnectBtn: document.getElementById(`${prefix}-disconnect-btn`),
            loginForm: document.getElementById(`${prefix}-login-form`),
            connectedSection: document.getElementById(`${prefix}-connected-section`),
            status: document.getElementById(`${prefix}-status`),
            userInfo: document.getElementById(`${prefix}-user-info`),
            url: document.getElementById(`${prefix}-url`),
            username: document.getElementById(`${prefix}-username`),
            password: document.getElementById(`${prefix}-password`),
            token: document.getElementById(`${prefix}-token`),
            objectSelect: document.getElementById(`${prefix}-object-select`),
            objectSearch: document.getElementById(`${prefix}-object-search`),
            fieldsSection: document.getElementById(`${prefix}-fields-section`),
            fieldsList: document.getElementById(`${prefix}-fields-list`)
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.elements.connectBtn.addEventListener('click', () => this.connect());
        this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.elements.objectSearch.addEventListener('input', (e) => this.filterObjects(e.target.value));
        this.elements.objectSelect.addEventListener('change', (e) => this.loadFields(e.target.value));
    }

    async connect() {
        const url = this.elements.url.value;
        const username = this.elements.username.value;
        const password = this.elements.password.value;
        const token = this.elements.token.value;

        if (!username || !password) {
            this.showStatus('Please enter username and password', 'error');
            return;
        }

        this.elements.connectBtn.disabled = true;
        this.elements.connectBtn.textContent = 'Connecting...';

        try {
            this.connection = new jsforce.Connection({ loginUrl: url });
            await this.connection.login(username, password + token);

            this.showStatus('Successfully connected!', 'success');
            this.elements.userInfo.textContent = `Connected as ${username}`;

            this.elements.loginForm.classList.add('hidden');
            this.elements.connectedSection.classList.remove('hidden');

            // Update global state
            if (this.prefix === 'source') {
                sourceConnection = this.connection;
            } else {
                destConnection = this.connection;
            }

            await this.loadObjects();
            updateMappingSection();
        } catch (error) {
            this.showStatus(`Connection failed: ${error.message}`, 'error');
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.textContent = `Connect to ${this.prefix === 'source' ? 'Source' : 'Destination'}`;
        }
    }

    disconnect() {
        this.connection = null;
        this.objects = [];
        this.fields = [];

        this.elements.loginForm.classList.remove('hidden');
        this.elements.connectedSection.classList.add('hidden');
        this.elements.fieldsSection.classList.add('hidden');

        this.elements.username.value = '';
        this.elements.password.value = '';
        this.elements.token.value = '';

        this.elements.connectBtn.disabled = false;
        this.elements.connectBtn.textContent = `Connect to ${this.prefix === 'source' ? 'Source' : 'Destination'}`;
        this.showStatus('', '');

        // Update global state
        if (this.prefix === 'source') {
            sourceConnection = null;
            sourceObjects = [];
            sourceFields = [];
        } else {
            destConnection = null;
            destObjects = [];
            destFields = [];
        }

        updateMappingSection();
    }

    async loadObjects() {
        try {
            const describe = await this.connection.describeGlobal();
            this.objects = describe.sobjects
                .filter(obj => obj.createable || obj.updateable)
                .sort((a, b) => a.label.localeCompare(b.label));

            // Update global state
            if (this.prefix === 'source') {
                sourceObjects = this.objects;
            } else {
                destObjects = this.objects;
            }

            this.displayObjects(this.objects);
        } catch (error) {
            this.showStatus(`Failed to load objects: ${error.message}`, 'error');
        }
    }

    displayObjects(objects) {
        this.elements.objectSelect.innerHTML = objects.map(obj =>
            `<option value="${obj.name}">${obj.label} (${obj.name})${obj.custom ? ' [Custom]' : ''}</option>`
        ).join('');
    }

    filterObjects(searchTerm) {
        const filtered = this.objects.filter(obj =>
            obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            obj.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.displayObjects(filtered);
    }

    async loadFields(objectName) {
        if (!objectName) return;

        try {
            // Show loading message
            this.elements.fieldsList.innerHTML = '<div class="loading-message">Loading fields and sample data...</div>';
            this.elements.fieldsSection.classList.remove('hidden');

            const describe = await this.connection.sobject(objectName).describe();
            this.fields = describe.fields.sort((a, b) => a.label.localeCompare(b.label));

            // Query sample records to show field values
            const fieldNames = this.fields
                .filter(f => f.type !== 'base64' && f.type !== 'address' && f.type !== 'location')
                .map(f => f.name)
                .slice(0, 50); // Limit to first 50 fields to avoid query limits

            let sampleRecords = [];
            try {
                const query = `SELECT ${fieldNames.join(', ')} FROM ${objectName} LIMIT 5`;
                const result = await this.connection.query(query);
                sampleRecords = result.records || [];
            } catch (queryError) {
                console.warn('Could not fetch sample records:', queryError.message);
            }

            // Enhance fields with sample values
            this.fields = this.fields.map(field => {
                const sampleValues = sampleRecords
                    .map(record => record[field.name])
                    .filter(val => val != null && val !== '');

                return {
                    ...field,
                    sampleValues: sampleValues.slice(0, 5)
                };
            });

            // Update global state
            if (this.prefix === 'source') {
                sourceFields = this.fields;
            } else {
                destFields = this.fields;
            }

            this.displayFields(this.fields);

            updateMappingSection();
        } catch (error) {
            this.showStatus(`Failed to load fields: ${error.message}`, 'error');
        }
    }

    displayFields(fields) {
        this.elements.fieldsList.innerHTML = fields.map(field => {
            const hasSampleValues = field.sampleValues && field.sampleValues.length > 0;

            return `
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
                ${hasSampleValues ? `
                    <div class="field-sample">
                        <strong>Sample values:</strong><br>
                        ${field.sampleValues.map(val => {
                            const displayVal = typeof val === 'object' ? JSON.stringify(val) : val;
                            const truncated = String(displayVal).length > 100
                                ? String(displayVal).substring(0, 100) + '...'
                                : displayVal;
                            return `• ${truncated}`;
                        }).join('<br>')}
                    </div>
                ` : '<div class="field-sample"><em>No sample data available</em></div>'}
            </div>
            `;
        }).join('');
    }

    showStatus(message, type) {
        this.elements.status.textContent = message;
        this.elements.status.className = `status-message ${type}`;

        if (type === 'success') {
            setTimeout(() => {
                this.elements.status.className = 'status-message';
            }, 5000);
        }
    }
}

// Initialize connection managers
const sourceManager = new SFConnectionManager('source');
const destManager = new SFConnectionManager('dest');

// Source Type Switching
const sourceTypeSelect = document.getElementById('source-type');
const sourceCsvSection = document.getElementById('source-csv-section');
const sourceSalesforceSection = document.getElementById('source-salesforce-section');

sourceTypeSelect.addEventListener('change', (e) => {
    sourceType = e.target.value;

    if (sourceType === 'csv') {
        sourceCsvSection.classList.remove('hidden');
        sourceSalesforceSection.classList.add('hidden');
        // Clear Salesforce source data
        sourceFields = [];
        sourceConnection = null;
    } else {
        sourceCsvSection.classList.add('hidden');
        sourceSalesforceSection.classList.remove('hidden');
        // Clear CSV data
        csvFields = [];
        csvData = null;
    }

    // Reset mappings when switching source type
    fieldMappings = [];
    updateMappingSection();
});

// Mapping Section
const mappingSection = document.getElementById('mapping-section');
const mappingTableBody = document.getElementById('mapping-table-body');
const sourceFieldSelect = document.getElementById('source-field-select');
const destFieldSelect = document.getElementById('dest-field-select');
const addMappingBtn = document.getElementById('add-mapping-btn');
const saveMappingBtn = document.getElementById('save-mapping-btn');
const loadMappingBtn = document.getElementById('load-mapping-btn');
const clearMappingBtn = document.getElementById('clear-mapping-btn');

function updateMappingSection() {
    // Determine which source fields to use
    let activeSourceFields = [];

    if (sourceType === 'csv' && csvFields.length > 0) {
        activeSourceFields = csvFields;
    } else if (sourceType === 'salesforce' && sourceFields.length > 0) {
        activeSourceFields = sourceFields;
    }

    // Show mapping section only when both source and destination have fields
    if (activeSourceFields.length > 0 && destFields.length > 0) {
        mappingSection.classList.remove('hidden');

        // Populate source field dropdown
        populateSourceFieldDropdown(activeSourceFields);

        // Populate destination field dropdown
        populateDestFieldDropdown();

        // Render existing mappings
        renderMappings();
    } else {
        mappingSection.classList.add('hidden');
    }
}

function populateSourceFieldDropdown(fields) {
    sourceFieldSelect.innerHTML = '<option value="">-- Select Source Field --</option>';

    if (!fields || fields.length === 0) {
        return;
    }

    fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.name;
        option.textContent = field.name;
        option.dataset.label = sourceType === 'csv' ? field.name : (field.label || field.name);
        option.dataset.type = field.type || 'unknown';
        option.dataset.sampleValues = JSON.stringify(field.sampleValues || []);
        sourceFieldSelect.appendChild(option);
    });
}

function populateDestFieldDropdown() {
    destFieldSelect.innerHTML = '<option value="">-- Select Salesforce Field --</option>';

    destFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.name;
        option.textContent = `${field.label} (${field.name}) - ${field.type}`;
        option.dataset.label = field.label;
        option.dataset.type = field.type;
        destFieldSelect.appendChild(option);
    });
}

// Add mapping button handler
addMappingBtn.addEventListener('click', () => {
    const sourceFieldValue = sourceFieldSelect.value;
    const destFieldValue = destFieldSelect.value;

    if (!sourceFieldValue) {
        alert('Please select a source field');
        return;
    }

    if (!destFieldValue) {
        alert('Please select a Salesforce field');
        return;
    }

    // Check if mapping already exists
    const exists = fieldMappings.some(m => m.sourceField === sourceFieldValue);
    if (exists) {
        alert('A mapping for this source field already exists');
        return;
    }

    const selectedSourceOption = sourceFieldSelect.options[sourceFieldSelect.selectedIndex];
    const selectedDestOption = destFieldSelect.options[destFieldSelect.selectedIndex];
    const sampleValues = JSON.parse(selectedSourceOption.dataset.sampleValues || '[]');

    fieldMappings.push({
        sourceField: sourceFieldValue,
        sourceLabel: selectedSourceOption.dataset.label,
        sourceType: selectedSourceOption.dataset.type,
        sampleValues: sampleValues,
        destField: destFieldValue,
        destLabel: selectedDestOption.dataset.label,
        destType: selectedDestOption.dataset.type
    });

    // Clear the form
    sourceFieldSelect.value = '';
    destFieldSelect.value = '';

    renderMappings();
});

function renderMappings() {
    if (fieldMappings.length === 0) {
        mappingTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No mappings created yet. Use the form above to add mappings.</td></tr>`;
        return;
    }

    mappingTableBody.innerHTML = fieldMappings.map((mapping, index) => {
        // Format sample values for display
        const sampleValues = mapping.sampleValues || [];
        const sampleText = sampleValues.length > 0
            ? sampleValues.slice(0, 3).map(v => {
                const str = String(v);
                return str.length > 40 ? str.substring(0, 40) + '...' : str;
              }).join(', ')
            : 'No data';

        const fullSampleText = sampleValues.join(', ');

        return `
        <tr>
            <td class="field-col">${mapping.sourceField}</td>
            <td class="value-col" title="${fullSampleText}">${sampleText}</td>
            <td class="arrow-col">→</td>
            <td class="field-col">${mapping.destField}</td>
            <td class="actions-col">
                <button class="mapping-remove-btn" data-index="${index}" title="Remove mapping">×</button>
            </td>
        </tr>
        `;
    }).join('');

    // Add event listeners
    document.querySelectorAll('.mapping-remove-btn').forEach(btn => {
        btn.addEventListener('click', handleMappingRemove);
    });
}

function handleMappingRemove(e) {
    const index = parseInt(e.target.dataset.index);
    if (confirm('Are you sure you want to remove this mapping?')) {
        fieldMappings.splice(index, 1);
        renderMappings();
    }
}

// Save/Load Mapping
saveMappingBtn.addEventListener('click', async () => {
    const destObject = destManager.elements.objectSelect.value;

    const mappingData = {
        sourceType: sourceType,
        sourceOrg: sourceType === 'salesforce' ? sourceManager.elements.username.value : null,
        sourceCsvFile: sourceType === 'csv' ? csvFileName.textContent : null,
        sourceObject: sourceType === 'salesforce' ? sourceManager.elements.objectSelect.value : null,
        destOrg: destManager.elements.username.value,
        destObject: destObject,
        mappings: fieldMappings,
        savedAt: new Date().toISOString()
    };

    const result = await ipcRenderer.invoke('save-mapping', mappingData);
    if (result.success) {
        alert(`Mapping saved to ${result.filePath}`);
    }
});

loadMappingBtn.addEventListener('click', async () => {
    const mappingData = await ipcRenderer.invoke('load-mapping');
    if (mappingData) {
        fieldMappings = mappingData.mappings;
        renderMappings();
        alert('Mapping loaded successfully');
    }
});

clearMappingBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all mappings?')) {
        fieldMappings = [];
        renderMappings();
    }
});

// CSV Loading (Optional)
const loadCsvBtn = document.getElementById('load-csv-btn');
const csvFileName = document.getElementById('csv-file-name');
const csvDataSection = document.getElementById('csv-data-section');
const csvRowCount = document.getElementById('csv-row-count');
const csvFieldsList = document.getElementById('csv-fields-list');

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

            // Update mapping section with CSV data
            updateMappingSection();
        },
        error: (error) => {
            alert(`CSV parsing failed: ${error.message}`);
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
    csvFieldsList.innerHTML = fields.map(field => {
        const hasSampleValues = field.sampleValues && field.sampleValues.length > 0;

        return `
        <div class="field-item" data-field-name="${field.name}">
            <div class="field-name">${field.name}</div>
            <span class="field-type">${field.type}</span>
            <div class="field-details">
                Unique Values: ${field.uniqueCount} • Null Count: ${field.nullCount}
            </div>
            ${hasSampleValues ? `
                <div class="field-sample">
                    <strong>Sample values:</strong><br>
                    ${field.sampleValues.map(val => {
                        const displayVal = String(val);
                        const truncated = displayVal.length > 100
                            ? displayVal.substring(0, 100) + '...'
                            : displayVal;
                        return `• ${truncated}`;
                    }).join('<br>')}
                </div>
            ` : '<div class="field-sample"><em>No sample data available</em></div>'}
        </div>
        `;
    }).join('');
}
