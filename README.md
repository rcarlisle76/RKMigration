# RK Migration - Sync Comparison Tool

A desktop application for comparing and mapping CSV data to Salesforce objects. This tool provides a visual interface to load CSV files, analyze field types and data, connect to Salesforce, and create field mappings for data migration.

## Features

- **CSV Data Analysis**
  - Load CSV files with an intuitive file picker
  - Automatic field type detection (String, Integer, Double, Boolean, Date)
  - Display sample values for each field
  - Show data quality metrics (unique count, null count)

- **Salesforce Integration**
  - Connect to Production or Sandbox environments
  - Browse all standard and custom objects
  - Search and filter available objects
  - View detailed field information including:
    - Field types
    - Required fields
    - Field lengths
    - Picklist values

- **Field Mapping Interface**
  - Side-by-side comparison of CSV and Salesforce fields
  - Dropdown selection for mapping CSV fields to Salesforce fields
  - Visual display of field types for validation
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

### Step 1: Connect to Salesforce
1. Select your instance type (Production or Sandbox)
2. Enter your Salesforce credentials:
   - Username
   - Password
   - Security Token
3. Click "Connect to Salesforce"

### Step 2: Load CSV File
1. Click "Load CSV File"
2. Select your CSV file from the file picker
3. Review the analyzed fields, types, and sample data

### Step 3: Select Salesforce Object
1. Use the search box to find your target object
2. Select the object from the dropdown
3. Review the available Salesforce fields

### Step 4: Create Field Mappings
1. The mapping section will appear automatically
2. For each CSV field, select the corresponding Salesforce field
3. Review type compatibility between source and target fields
4. Remove any mappings that aren't needed

### Step 5: Save Your Mapping
1. Click "Save Mapping" to export the configuration
2. Choose a location and filename (JSON format)
3. Load saved mappings anytime with "Load Mapping"

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

```json
{
  "csvFile": "data.csv",
  "salesforceObject": "Account",
  "mappings": [
    {
      "csvField": "company_name",
      "csvType": "Text",
      "sfField": "Name",
      "sfType": "string"
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
