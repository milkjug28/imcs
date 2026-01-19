# Sync Google Sheets to Supabase

This guide helps you migrate your existing Google Sheets submissions to Supabase.

## Option 1: Manual Export (Easiest)

### Step 1: Export from Google Sheets

1. Open your Google Sheet with submissions
2. Click **File** > **Download** > **Comma Separated Values (.csv)**
3. Save the file

### Step 2: Convert CSV to JSON

Open the CSV in a text editor and convert to JSON format:

**CSV format:**
```
name,info,wallet-address,ip,timestamp
Alice,my cool submission,0x1234...,192.168.1.1,2026-01-01
Bob,another one,0x5678...,192.168.1.2,2026-01-02
```

**JSON format:**
```json
[
  {
    "name": "Alice",
    "info": "my cool submission",
    "wallet_address": "0x1234...",
    "ip": "192.168.1.1",
    "timestamp": "2026-01-01"
  },
  {
    "name": "Bob",
    "info": "another one",
    "wallet_address": "0x5678...",
    "ip": "192.168.1.2",
    "timestamp": "2026-01-02"
  }
]
```

Or use an online CSV to JSON converter: https://csvjson.com/csv2json

### Step 3: Sync to Supabase

Use curl or Postman:

```bash
curl -X POST http://localhost:3000/api/admin/sync-sheets \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "YOUR_ADMIN_SECRET_KEY",
    "data": [
      {
        "name": "Alice",
        "info": "my cool submission",
        "wallet_address": "0x1234...",
        "ip": "192.168.1.1",
        "timestamp": "2026-01-01"
      }
    ]
  }'
```

Or use this simple HTML form:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Sync Google Sheets</title>
</head>
<body>
  <h1>Sync Google Sheets to Supabase</h1>
  <form id="syncForm">
    <label>Admin Secret Key:</label><br>
    <input type="password" id="secretKey" required style="width: 400px"><br><br>

    <label>JSON Data (paste from CSV converter):</label><br>
    <textarea id="jsonData" rows="20" cols="80" required></textarea><br><br>

    <button type="submit">Sync to Supabase</button>
  </form>

  <div id="result"></div>

  <script>
    document.getElementById('syncForm').addEventListener('submit', async (e) => {
      e.preventDefault()

      const secretKey = document.getElementById('secretKey').value
      const jsonData = JSON.parse(document.getElementById('jsonData').value)

      const response = await fetch('http://localhost:3000/api/admin/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey,
          data: jsonData
        })
      })

      const result = await response.json()
      document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>'
    })
  </script>
</body>
</html>
```

Save this as `sync.html` and open in browser.

---

## Option 2: Google Apps Script (Advanced)

If you want to fetch directly from Google Sheets, add this function to your Google Apps Script:

```javascript
// Add this to your existing google-apps-script.js

function doGet(e) {
  const action = e.parameter.action

  if (action === 'export') {
    return exportAllData()
  }

  return createResponse(false, 'Invalid action')
}

function exportAllData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
    const data = sheet.getDataRange().getValues()

    // Skip header row
    const submissions = []
    for (let i = 1; i < data.length; i++) {
      submissions.push({
        name: data[i][0],
        info: data[i][1],
        wallet_address: data[i][2],
        ip: data[i][3],
        timestamp: data[i][4]
      })
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: submissions }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
```

Then fetch from your app:

```bash
# 1. Get data from Google Sheets
curl "YOUR_GOOGLE_SCRIPT_URL?action=export" > sheets-data.json

# 2. Extract the data field and sync
# (manually copy the "data" array from sheets-data.json)

curl -X POST http://localhost:3000/api/admin/sync-sheets \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "YOUR_SECRET",
    "data": [...]
  }'
```

---

## Checking Sync Status

```bash
curl "http://localhost:3000/api/admin/sync-sheets?secretKey=YOUR_SECRET"
```

---

## After Syncing

1. Check your Supabase **submissions** table
2. Verify all data migrated correctly
3. Run the whitelist auto-update function:

```sql
-- In Supabase SQL Editor
SELECT update_whitelist_auto();
```

This will automatically whitelist anyone with score >= 3.

---

## Troubleshooting

**"Unauthorized" error:**
- Make sure `ADMIN_SECRET_KEY` is set in your `.env.local`
- Make sure you're using the correct secret key in the request

**"Already exists" for all records:**
- Data is already in Supabase! Check the submissions table.

**"Invalid wallet address format":**
- Make sure wallet addresses start with `0x` and are 42 characters long
- Check for extra spaces or formatting issues in your CSV

**Submissions not appearing:**
- Check the API response for errors
- Look at Supabase > Table Editor > submissions
- Check server console logs

---

## Important Notes

- The sync route will **skip** any wallets already in Supabase
- It will **not** update existing records (insert only)
- Each submission gets a unique referral code generated
- Timestamps from Google Sheets are preserved
- IP addresses are optional
