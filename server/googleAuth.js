import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let serviceAccountClient = null;

// Get absolute path to service account key
const keyPath = path.join(process.cwd(), 'server/cfcc-service-account-key.json');

// Service account that has access to the template file
export const getServiceAccountDrive = () => {
  if (!serviceAccountClient) {
    const keyFile = JSON.parse(
      fs.readFileSync(path.join(keyPath), 'utf8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    serviceAccountClient = {
      drive: google.drive({ version: 'v3', auth }),
      sheets: google.sheets({ version: 'v4', auth })
    }
  }

  return serviceAccountClient;
};

// Middleware to get Google Drive client (user context)
export const getGoogleDriveClient = async (req, res, next) => {
  try {
    // Get access token from request headers
    const accessToken = req.headers.authorization?.replace('Bearer ', '') ||
      req.body.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    // Create drive client with user's credentials
    req.drive = google.drive({ version: 'v3', auth });
    req.spreadsheet = google.sheets({ version: 'v4', auth });

    next();
  } catch (error) {
    console.error('Error creating Google Drive client:', error);
    res.status(500).json({ error: 'Failed to create Google Drive client' });
  }
};

export const createFolder = async (name, userEmail, sharedFolderId, parentId) => {
  try {
    console.log('createFolder fired... ', { name, userEmail, sharedFolderId, parentId })
    const { drive } = getServiceAccountDrive();

    // Check for existence
    // Verify the shared folder exists first
    try {
      const response = await drive.files.get({
        fileId: sharedFolderId,
        supportsAllDrives: true
      });

      console.log('Shared folder exists and is accessible');
      console.log(response.data)
    } catch (error) {
      console.error('Shared folder not accessible:', error.message);
      throw new Error(`Shared folder not accessible: ${sharedFolderId}`);
    }

    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [sharedFolderId]
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    console.log('attempting folder permissions for bookr manager...', response.data.id)
    const newFolderId = response.data.id

    console.log('email address ==> ', userEmail)

    // Only give read access if not top-level folder
    if (parentId) {
      await drive.permissions.create({
        fileId: newFolderId,
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: userEmail
        },
        supportsAllDrives: true
      });
    }
    return response.data
  } catch (error) {
    console.error('Error in createFolder:', error);
    throw error;
  }
}

export const copyTemplateFile = async (templateId, fileName, userEmail, sharedFolderId, parentFolderId = null) => {
  try {
    const { drive } = getServiceAccountDrive();
    console.log('copyTemplateFile...')

    console.log('parent folder id', parentFolderId)

    // Copy the file directly using Google Drive API
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName || 'Copied Report',
        parents: [parentFolderId]
      },
      supportsAllDrives: true,
      fields: 'id, webViewLink'
    });


    const newFileId = copyResponse.data.id;
    // const newFileId = "12h8KZdEp0L26ByrbOZKfr5Y05JDIBixj_y8Mht-Gp78"
    // const tempFolderId = "1XQcAW_EA32YWuCvGOs78QrSbFG2lz6RX"

    console.log('newFileId ==> ', newFileId)

    console.log('attempting file permissions for user ==> ', userEmail)
    await drive.permissions.create({
      fileId: newFileId,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: userEmail
      },
      supportsAllDrives: true,
    });

    // TODO update "WEEK N" and "MONTH/YYYY" cells

    console.log('Attempting file transfer of new file with ID: ', newFileId)

    return {
      fileId: newFileId,
      fileUrl: `https://docs.google.com/document/d/${newFileId}/edit`
    };

  } catch (error) {
    console.error('Error in copyTemplateFile:', error);
    throw error;
  }
};

// Function to get sheet information and sheet IDs
export const getSheetInfo = async (fileId) => {
  try {
    const { sheets } = getServiceAccountDrive();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets(properties)'
    });

    const sheetsInfo = response.data.sheets.map(sheet => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
      gridProperties: sheet.properties.gridProperties
    }));

    console.log('Sheet information:', sheetsInfo);
    return sheetsInfo;

  } catch (error) {
    console.error('Error getting sheet info:', error);
    throw error;
  }
};

const cellLocations = {
  "E": { row: 4, accountName: 9, value: 11, previousTotal: 13 }, // Row 5. Columns J, L, N
  "NE": { row: 4, accountName: 0, value: 2, previousTotal: 4 }, // Row 5. Columns A, C, E
  "D": { row: 20, accountName: 1, value: 6 }, // Row 21, Columns B, G
  "ND": { row: 36, accountName: 1, value: 6 }, // Row 37, Colmns B, G
  "lastDTotal": { row: 30, col: 6 }, // Row 31, Column G
  "lastNDTotal": { row: 44, col: 6 }, // Row 45, Column G
}

const MaxE = 43;
const MaxNE = 6;
const MaxD = 8;
const MaxND = 6;

export async function updateSpreadsheet(spreadsheetId, allUpdates) {
  try {
    const { sheets } = getServiceAccountDrive();
    console.log('Updating sheet cells...');

    const fetchFileResponse = await sheets.spreadsheets.get({
      spreadsheetId
    });

    console.log('Available sheets:', fetchFileResponse.data.sheets);

    const sheetId = fetchFileResponse.data.sheets[0].properties.sheetId;
    console.log("///////////")
    console.log("///////////")
    console.log("///////////")
    console.log("///////////")
    console.log("///////////")
    console.log('sheetData')
    console.log("spreadsheet ID ==> ", sheetId)

    const requests = [];
    const startRow = 4; // 0-indexed row 4

    console.log("sheet id ==> ", sheetId)

    console.log("ALL UPDATES??", allUpdates)
    const { lastDTotal, lastNDTotal, ...typeUpdates } = allUpdates

    // example typeUpdates
    // const typeUpdates = {
    //   "E": [{ "accountName": "Vehicle", "value": 45, "previousTotal": 5050 }],
    //   "NE": [{ "accountName": "Groceries", "value": 50, "previousTotal": 0 }],
    //   "D": [{ "accountName": "Dog Sit", "value": 600, "previousTotal": 2000 }, { "accountName": "Paycheck", "value": 0, "previousTotal": 3600 }, { "accountName": "Unemployment", "value": 1800, "previousTotal": 0 }],
    //   "ND": []
    // }

    // Add Deposits and Non-Income "Total Up To This Week"
    new Array('lastDTotal', 'lastNDTotal').forEach(lastTotal => {
      console.log("last total???? ", allUpdates[lastTotal])
      console.log('cell location for last total?? ', cellLocations[lastTotal])
      const rowIndex = cellLocations[lastTotal].row
      const colIndex = cellLocations[lastTotal].col
      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
          rows: [{
            values: [
              {
                userEnteredValue: {
                  numberValue: allUpdates[lastTotal]
                }
              }
            ]
          }],
          fields: 'userEnteredValue'
        }
      });
    })

    console.log("type updates??", typeUpdates)
    // Each account type: Expense (E), Non-Deductible Expense (NE), Receipts (D), Non-Income Deposits (ND)
    Object.entries(typeUpdates).forEach(([type, typeData]) => {
      const cellLocation = cellLocations[type]
      console.log("cell location!!!!! ", cellLocation)

      // TODO sort typeData by accountName

      // Each account
      for (let index = 0; index < typeData.length; index++) {
        const row = typeData[index]
        // Prevent updates beyond space allotment in file
        if (
          type === "E" && index === MaxE ||
          type === "NE" && index === MaxNE ||
          type === "D" && index === MaxD ||
          type === "ND" && index === MaxND
        ) {
          break;
        }

        const rowIndex = cellLocation.row + index;

        console.log("row ", rowIndex, " ==> ", row)

        const { accountName, value, previousTotal } = row;

        // Account Name
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: cellLocation.accountName,
              endColumnIndex: cellLocation.accountName + 1,
            },
            rows: [{
              values: [
                {
                  userEnteredValue: {
                    stringValue: accountName
                  }
                }
              ]
            }],
            fields: 'userEnteredValue'
          }
        });

        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: cellLocation.value,
              endColumnIndex: cellLocation.value + 1,
            },
            rows: [{
              values: [
                {
                  userEnteredValue: {
                    numberValue: value
                  }
                }
              ]
            }],
            fields: 'userEnteredValue'
          }
        });

        if (type === "E" || type === "NE") {
          requests.push({
            updateCells: {
              range: {
                sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: cellLocation.previousTotal,
                endColumnIndex: cellLocation.previousTotal + 1
              },
              rows: [{
                values: [
                  {
                    userEnteredValue: {
                      numberValue: previousTotal
                    }
                  }
                ]
              }],
              fields: 'userEnteredValue'
            }
          });
        }
      };
    })

    // Execute batch update
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests,
      },
    });

    console.log('Spreadsheet updated successfully');
    return response;
  } catch (error) {
    console.error('Error updating spreadsheet:', error);
    throw error;
  }
}