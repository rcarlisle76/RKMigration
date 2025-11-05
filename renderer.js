const { ipcRenderer } = require('electron');
const jsforce = require('jsforce');
const Papa = require('papaparse');

// Global state
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
            const describe = await this.connection.sobject(objectName).describe();
            this.fields = describe.fields.sort((a, b) => a.label.localeCompare(b.label));

            // Update global state
            if (this.prefix === 'source') {
                sourceFields = this.fields;
            } else {
                destFields = this.fields;
            }

            this.displayFields(this.fields);
            this.elements.fieldsSection.classList.remove('hidden');

            updateMappingSection();
        } catch (error) {
            this.showStatus(`Failed to load fields: ${error.message}`, 'error');
        }
    }

    displayFields(fields) {
        this.elements.fieldsList.innerHTML = fields.map(field => `
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

// Mapping Section
const mappingSection = document.getElementById('mapping-section');
const mappingList = document.getElementById('mapping-list');
const saveMappingBtn = document.getElementById('save-mapping-btn');
const loadMappingBtn = document.getElementById('load-mapping-btn');
const clearMappingBtn = document.getElementById('clear-mapping-btn');

function updateMappingSection() {
    // Show mapping section only when both source and destination have fields
    if (sourceFields.length > 0 && destFields.length > 0) {
        mappingSection.classList.remove('hidden');

        // Initialize mappings if not already done
        if (fieldMappings.length === 0) {
            fieldMappings = sourceFields.map(sourceField => ({
                sourceField: sourceField.name,
                sourceLabel: sourceField.label,
                sourceType: sourceField.type,
                destField: '',
                destLabel: '',
                destType: ''
            }));
        }

        renderMappings();
    } else {
        mappingSection.classList.add('hidden');
    }
}

function renderMappings() {
    if (fieldMappings.length === 0) {
        mappingList.innerHTML = '<div class="empty-state">Connect to both Source and Destination Salesforce orgs and select objects to create mappings</div>';
        return;
    }

    mappingList.innerHTML = fieldMappings.map((mapping, index) => {
        const selectedDestField = destFields.find(f => f.name === mapping.destField);

        return `
        <div class="mapping-item">
            <div class="mapping-source">
                <div class="field-name">${mapping.sourceLabel}</div>
                <div class="field-api-name">API: ${mapping.sourceField}</div>
                <span class="field-type">${mapping.sourceType}</span>
            </div>
            <div class="mapping-arrow">→</div>
            <div class="mapping-target">
                <select class="mapping-select" data-index="${index}">
                    <option value="">-- Select Destination Field --</option>
                    ${destFields.map(destField => `
                        <option value="${destField.name}"
                                data-type="${destField.type}"
                                data-label="${destField.label}"
                                ${mapping.destField === destField.name ? 'selected' : ''}>
                            ${destField.label} (${destField.name}) - ${destField.type}
                        </option>
                    `).join('')}
                </select>
                ${mapping.destField ? `
                    <div class="field-name">${mapping.destLabel}</div>
                    <div class="field-api-name">API: ${mapping.destField}</div>
                    <span class="field-type">${mapping.destType}</span>
                ` : ''}
            </div>
            <button class="mapping-remove" data-index="${index}">Remove</button>
        </div>
        `;
    }).join('');

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

    fieldMappings[index].destField = e.target.value;
    fieldMappings[index].destType = selectedOption.dataset.type || '';
    fieldMappings[index].destLabel = selectedOption.dataset.label || '';

    renderMappings();
}

function handleMappingRemove(e) {
    const index = parseInt(e.target.dataset.index);
    fieldMappings.splice(index, 1);
    renderMappings();
}

// Save/Load Mapping
saveMappingBtn.addEventListener('click', async () => {
    const sourceObject = sourceManager.elements.objectSelect.value;
    const destObject = destManager.elements.objectSelect.value;

    const mappingData = {
        sourceOrg: sourceManager.elements.username.value,
        destOrg: destManager.elements.username.value,
        sourceObject: sourceObject,
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
        fieldMappings = sourceFields.map(sourceField => ({
            sourceField: sourceField.name,
            sourceLabel: sourceField.label,
            sourceType: sourceField.type,
            destField: '',
            destLabel: '',
            destType: ''
        }));
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
