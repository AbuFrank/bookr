import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let serviceAccountClient = null;

// Get absolute path to service account key
// const keyPath = path.join(process.cwd(), 'server/cfcc-service-account-key.json');

// Service account that has access to the template file
export const getServiceAccountDrive = () => {
  if (!serviceAccountClient) {

    console.log('Creating service account client...');
    let keyFile;

    // Check if we're in Vercel (production) environment
    if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') {
      // Use base64 environment variable in production
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
        console.error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not found in environment variables');
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 environment variable is required in production');
      }
      try {
        keyFile = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'));
        console.log('Successfully parsed service account key from base64');
      } catch (error) {
        console.error('Failed to parse service account key:', error);
        throw new Error('Failed to parse service account key: ' + error.message);
      }
    } else {
      // Use local file in development
      const keyPath = path.join(process.cwd(), 'server/cfcc-service-account-key.json');
      try {
        keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log('Successfully loaded service account key from local file');
      } catch (error) {
        console.error('Failed to load local service account key:', error);
        throw new Error('Failed to load local service account key: ' + error.message);
      }
    }

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

export const copyTemplateFile = async (templateId, fileName, userEmail, parentFolderId, description) => {
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
    await updateSpreadsheetMetaData(newFileId, fileName, description)

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

// add ledger back and create entries
// TODO use value - 1 to adjust for 0-indexed for convenience here
const cellLocations = {
  "E": { row: 4, accountName: 9, value: 11, previousTotal: 13 }, // Row 5. Columns J, L, N
  "D": { row: 5, accountName: 1, value: 6 }, // Row 6, Columns B, G
  "ND": { row: 29, accountName: 1, value: 6 }, // Row 30, Colmns B, G
  "NE": { row: 46, accountName: 0, value: 2, previousTotal: 4 }, // Row 47. Columns A, C, E
  "lastDTotal": { row: 23, col: 6 }, // Row 24, Column G
  "lastNDTotal": { row: 38, col: 6 }, // Row 39, Column G
  "lastTotal": { row: 4, col: 11 },
  "title": { row: 0, col: 0 },
  "description": { row: 0, col: 8 }
}

const MaxE = 52;
const MaxNE = 7;
const MaxD = 16;
const MaxND = 7;

const ledgerStartRow = 5;

// Function to format the date as mm/dd/yy
function formatDate(date) {
  console.log('DATE!!! >>>>> ', date)
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2); // Get last two digits of year
  return `${month}/${day}/${year}`;
}
// Function to convert Firestore timestamp to JS Date
function convertFirestoreTimestamp(firestoreTimestamp) {
  const { seconds } = firestoreTimestamp;
  console.log('seconds ==> ', seconds)
  console.log('date ==> ', new Date(seconds * 1000))
  return new Date(seconds * 1000);
}

export async function updateSpreadsheet(spreadsheetId, transactions, allUpdates) {
  try {
    const { sheets } = getServiceAccountDrive();
    console.log('Updating sheet cells...');

    const fetchFileResponse = await sheets.spreadsheets.get({
      spreadsheetId
    });

    console.log('Available sheets:', fetchFileResponse.data.sheets);

    const ledgerSheetId = fetchFileResponse.data.sheets[0].properties.sheetId;
    const summarySheetId = fetchFileResponse.data.sheets[1].properties.sheetId;

    // TODO: verify user email matches email on file metadata

    const requests = [];
    const startRow = 4; // 0-indexed row 4

    console.log("sheet id ==> ", summarySheetId)

    console.log("ALL UPDATES??", allUpdates)
    const { lastDTotal, lastNDTotal, lastTotal, ...typeUpdates } = allUpdates

    // example typeUpdates
    // const typeUpdates = {
    //   "E": [{ "accountName": "Vehicle", "value": 45, "previousTotal": 5050 }],
    //   "NE": [{ "accountName": "Groceries", "value": 50, "previousTotal": 0 }],
    //   "D": [{ "accountName": "Dog Sit", "value": 600, "previousTotal": 2000 }, { "accountName": "Paycheck", "value": 0, "previousTotal": 3600 }, { "accountName": "Unemployment", "value": 1800, "previousTotal": 0 }],
    //   "ND": []
    // }
    requests.push({
      updateCells: {
        range: {
          sheetId: ledgerSheetId,
          startRowIndex: cellLocations.lastTotal.row - 1,
          endRowIndex: cellLocations.lastTotal.row,
          startColumnIndex: cellLocations.lastTotal.col - 1,
          endColumnIndex: cellLocations.lastTotal.col
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: {
                  numberValue: lastTotal
                }
              }
            ]
          }
        ],
        fields: 'userEnteredValue'
      }
    })

    // Loop through transactions and add each to requests for ledgerSheetId
    transactions.forEach((transaction, idx) => {
      console.log('transaction ==> ', transaction)

      requests.push({
        updateCells: {
          range: {
            sheetId: ledgerSheetId,
            startRowIndex: ledgerStartRow - 1 + idx,
            endRowIndex: ledgerStartRow + idx,
            startColumnIndex: 0,
            endColumnIndex: 11 // A-K
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: {
                    stringValue: transaction.date ? formatDate(convertFirestoreTimestamp(transaction.date)) : ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction.checkNo ? transaction.checkNo.toString() : ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction.paidTo ? transaction.paidTo : ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: '' // Leave other cells in the merged range blank.
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction.accountNumber ? transaction.accountNumber.toString() : ''
                  }
                },
                {
                  userEnteredValue: {
                    numberValue: transaction.value ? transaction.value : 0 //Provide a default number
                  }
                }
              ]
            }
          ],
          fields: 'userEnteredValue'
        }
      });
    })

    // Add Deposits and Non-Income "Total Up To This Week"
    new Array('lastDTotal', 'lastNDTotal').forEach(lastTotal => {
      console.log("last total???? ", allUpdates[lastTotal])
      console.log('cell location for last total?? ', cellLocations[lastTotal])
      const rowIndex = cellLocations[lastTotal].row
      const colIndex = cellLocations[lastTotal].col
      requests.push({
        updateCells: {
          range: {
            sheetId: summarySheetId,
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
              sheetId: summarySheetId,
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
              sheetId: summarySheetId,
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
                sheetId: summarySheetId,
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
    // throw error;
  }
}

export async function updateSpreadsheetMetaData(spreadsheetId, title, description) {
  try {
    const { sheets } = getServiceAccountDrive();
    console.log('Updating sheet metaData...');

    const fetchFileResponse = await sheets.spreadsheets.get({
      spreadsheetId
    });

    const summarySheetId = fetchFileResponse.data.sheets[1].properties.sheetId;

    const requests = [];

    const metaData = { title, description }

    new Array('title', 'description').forEach(meta => {
      requests.push({
        updateCells: {
          range: {
            sheetId: summarySheetId,
            startRowIndex: cellLocations[meta].row,
            endRowIndex: cellLocations[meta].row + 1,
            startColumnIndex: cellLocations[meta].col,
            endColumnIndex: cellLocations[meta].col + 1,
          },
          rows: [{
            values: [
              {
                userEnteredValue: {
                  stringValue: metaData[meta].toUpperCase()
                }
              }
            ]
          }],
          fields: 'userEnteredValue'
        }
      });
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

export async function copySheetToTemplate(templateId, sourceSpreadsheetId) {
  try {
    const { sheets } = getServiceAccountDrive();

    console.log('Copying sheet from source spreadsheet...');

    // Get the source spreadsheet to understand its structure
    const sourceSpreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sourceSpreadsheetId
    });

    console.log('Available sheets:', sourceSpreadsheet.data.sheets);

    const sourceSheetId = sourceSpreadsheet.data.sheets[0].properties.sheetId;
    console.log("copySheetToTemplate")
    console.log('sheetData')
    console.log("spreadsheet tab ID ==> ", sourceSheetId)

    // copy the source sheet to the template
    const copySheetResponse = await sheets.spreadsheets.sheets.copyTo({
      spreadsheetId: sourceSpreadsheetId,
      sheetId: sourceSheetId,
      requestBody: {
        destinationSpreadsheetId: templateId
      }
    });


    return copySheetResponse

  } catch (error) {
    console.error('Error copying sheet to template:', error);
    throw error;
  }
}