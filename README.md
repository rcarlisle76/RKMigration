# RK Migration - Sync Comparison Tool

A desktop application for comparing and mapping data from CSV files or Salesforce to a destination Salesforce org. This tool provides a flexible visual interface to work with multiple data sources and create field mappings for data migration.

## Features

- **Flexible Source Selection**
  - Choose between CSV file or Salesforce API as your data source
  - Easy switching between source types with dropdown selector
  - Maintains separate configurations for each source type

- **CSV Source Support**
  - Load CSV files with an intuitive file picker
  - Automatic field type detection (String, Integer, Double, Boolean, Date)
  - Display sample values for each field
  - Show data quality metrics (unique count, null count, row count)
  - Works with any CSV file structure

- **Salesforce Source Support**
  - Connect to Source Salesforce org (Production or Sandbox)
  - Browse all standard and custom objects
  - Search and filter available objects
  - View detailed field information including:
    - Field labels and API names
    - Field types
    - Required and unique fields
    - Field lengths
    - Picklist values

- **Destination Salesforce Connection**
  - Always connects to Salesforce as destination
  - Support for Production and Sandbox environments
  - Independent authentication from source
  - View connection status and user information

- **Field Mapping Interface**
  - Side-by-side comparison of Source and Destination fields
  - Dropdown selection for mapping source fields to destination fields
  - Display both field labels and API names (for Salesforce sources)
  - Visual display of field types for validation
  - Add or remove individual mappings
  - Save and load mapping configurations as JSON

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Start the application:
```bash
npm start
```

2. For development mode with DevTools:
```bash
npm run dev
```

## How to Use

### Step 1: Select Source Type
1. In the **Source Data** panel:
   - Use the dropdown to select source type:
     - **CSV File** - Load data from a CSV file
     - **Salesforce API** - Connect to a Salesforce org

### Step 2: Configure Your Source

**Option A: CSV Source**
1. Click "Load CSV File"
2. Select your CSV file from the file picker
3. Review the analyzed fields, types, and sample data

**Option B: Salesforce Source**
1. Select your instance type (Production or Sandbox)
2. Enter your Salesforce credentials:
   - Username
   - Password
   - Security Token
3. Click "Connect to Source"
4. Use the search box to find your source object
5. Select the object from the dropdown
6. Review the available source fields

### Step 3: Connect to Destination Salesforce
1. In the **Destination Salesforce** panel:
   - Select your instance type (Production or Sandbox)
   - Enter your Salesforce credentials:
     - Username
     - Password
     - Security Token
   - Click "Connect to Destination"
2. Use the search box to find your destination object
3. Select the object from the dropdown
4. Review the available destination fields

### Step 4: Create Field Mappings
1. The mapping section will appear automatically when both source and destination are loaded
2. For each source field, select the corresponding destination field from the dropdown
3. The interface displays:
   - Field labels and API names (for Salesforce sources)
   - Field types for validation
   - Source → Destination arrow indicator
4. Remove any mappings that aren't needed using the "Remove" button

### Step 5: Save Your Mapping
1. Click "Save Mapping" to export the configuration
2. Choose a location and filename (JSON format)
3. Load saved mappings anytime with "Load Mapping"
4. Use "Clear Mapping" to reset all mappings

## Salesforce Authentication

This application uses username/password/token authentication. To get your security token:
1. Log into Salesforce
2. Go to Settings → My Personal Information → Reset My Security Token
3. Check your email for the token

## Technology Stack

- **Electron** - Desktop application framework
- **JSForce** - Salesforce API integration
- **PapaParse** - CSV parsing and analysis
- **Node.js** - Runtime environment

## File Structure

```
RKMigration/
├── main.js           # Electron main process
├── renderer.js       # Application logic and UI handlers
├── index.html        # Application interface
├── styles.css        # Styling
├── package.json      # Dependencies and scripts
└── README.md         # Documentation
```

## Mapping Configuration Format

Saved mappings are stored as JSON files with the following structure:

**For Salesforce-to-Salesforce mappings:**
```json
{
  "sourceType": "salesforce",
  "sourceOrg": "user@source-org.com",
  "sourceObject": "Account",
  "destOrg": "user@dest-org.com",
  "destObject": "Account",
  "mappings": [
    {
      "sourceField": "Name",
      "sourceLabel": "Account Name",
      "sourceType": "string",
      "destField": "Name",
      "destLabel": "Account Name",
      "destType": "string"
    }
  ],
  "savedAt": "2025-11-05T12:00:00.000Z"
}
```

**For CSV-to-Salesforce mappings:**
```json
{
  "sourceType": "csv",
  "sourceCsvFile": "accounts.csv",
  "destOrg": "user@dest-org.com",
  "destObject": "Account",
  "mappings": [
    {
      "sourceField": "company_name",
      "sourceLabel": "company_name",
      "sourceType": "Text",
      "destField": "Name",
      "destLabel": "Account Name",
      "destType": "string"
    }
  ],
  "savedAt": "2025-11-05T12:00:00.000Z"
}
```

## Troubleshooting

### Connection Issues
- Verify your credentials are correct
- Ensure your IP is allowed in Salesforce security settings
- Check that your security token is current

### CSV Loading Issues
- Ensure your CSV file has headers in the first row
- Check that the file is properly formatted
- Try opening the CSV in a text editor to verify format

## Future Enhancements

- Data validation preview
- Bulk data import functionality
- Transformation rules (e.g., date format conversion)
- Duplicate detection
- Error handling and rollback

## License

MIT
