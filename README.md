# RK Migration - Sync Comparison Tool

A desktop application for comparing and mapping Salesforce objects between source and destination orgs. This tool provides a visual interface to connect to two Salesforce environments, browse objects and fields, and create field mappings for data migration.

## Features

- **Dual Salesforce Connections**
  - Connect to both Source and Destination Salesforce orgs simultaneously
  - Support for Production and Sandbox environments
  - Independent authentication for each org
  - View connection status and user information

- **Object and Field Browsing**
  - Browse all standard and custom objects in both orgs
  - Search and filter available objects
  - View detailed field information including:
    - Field labels and API names
    - Field types
    - Required and unique fields
    - Field lengths
    - Picklist values

- **Field Mapping Interface**
  - Side-by-side comparison of Source and Destination Salesforce fields
  - Dropdown selection for mapping source fields to destination fields
  - Display both field labels and API names
  - Visual display of field types for validation
  - Add or remove individual mappings
  - Save and load mapping configurations as JSON

- **CSV Data Support (Optional)**
  - Load CSV files with an intuitive file picker
  - Automatic field type detection (String, Integer, Double, Boolean, Date)
  - Display sample values for each field
  - Show data quality metrics (unique count, null count)

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

### Step 1: Connect to Source Salesforce
1. In the **Source Salesforce** panel:
   - Select your instance type (Production or Sandbox)
   - Enter your Salesforce credentials:
     - Username
     - Password
     - Security Token
   - Click "Connect to Source"

### Step 2: Connect to Destination Salesforce
1. In the **Destination Salesforce** panel:
   - Select your instance type (Production or Sandbox)
   - Enter your Salesforce credentials:
     - Username
     - Password
     - Security Token
   - Click "Connect to Destination"

### Step 3: Select Objects
1. In the **Source** panel:
   - Use the search box to find your source object
   - Select the object from the dropdown
   - Review the available source fields
2. In the **Destination** panel:
   - Use the search box to find your destination object
   - Select the object from the dropdown
   - Review the available destination fields

### Step 4: Create Field Mappings
1. The mapping section will appear automatically when both objects are selected
2. For each source field, select the corresponding destination field from the dropdown
3. The interface displays:
   - Field labels and API names
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

```json
{
  "sourceOrg": "user@source-org.com",
  "destOrg": "user@dest-org.com",
  "sourceObject": "Account",
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
