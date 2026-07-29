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
  // accountNumber 1-50 maps directly to rows E.row..E.row+MaxE-1. Column I (index 8) is a
  // static pre-printed 1-50 index baked into the template - never write to it.
  "E": { row: 4, accountNumberStart: 1, accountName: 9, value: 11, previousTotal: 13 }, // Row 5. Columns J, L, N
  // Deposits/Non-Income Deposits list transactions chronologically, not grouped by account.
  "D": { row: 5, date: 0, description: 1, amount: 6 }, // Row 6, Columns A, B (merged B-F), G
  "ND": { row: 29, date: 0, description: 1, amount: 6 }, // Row 30, Columns A, B (merged B-F), G
  // accountNumber 51-57 maps to rows NE.row..NE.row+MaxNE-1.
  "NE": { row: 46, accountNumberStart: 51, accountName: 0, value: 2, previousTotal: 4 }, // Row 47. Columns A, C, E
  "lastDTotal": { row: 23, col: 6 }, // Row 24, Column G
  "lastNDTotal": { row: 38, col: 6 }, // Row 39, Column G
  "lastTotal": { row: 4, col: 11 },
  "title": { row: 0, col: 0 },
  "description": { row: 0, col: 8 }
}

const MaxE = 50;
const MaxNE = 7;
const MaxD = 16;
const MaxND = 7;
// Ledger sheet's transaction register runs rows 5-50 (1-indexed) in the template.
const MaxLedgerRows = 46;

const ledgerStartRow = 5;

// Function to format the date as mm/dd. Uses UTC components rather than the
// server process's local timezone, since transaction dates are stored as
// UTC-midnight-anchored (see toUTCDateOnly in src/helpers/date.ts) - reading
// them back with local getters would shift the day depending on whatever
// timezone this server process happens to run in.
function formatDate(date) {
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${month}/${day}`;
}
// Function to convert a Firestore Timestamp (or Timestamp-shaped JSON, e.g.
// {seconds, nanoseconds} as produced by Timestamp#toJSON over the wire) to a
// JS Date. Falls back to parsing directly for values that arrive as a plain
// Date/ISO string instead - e.g. a transaction added earlier in the same
// client session that hasn't round-tripped through Firestore yet still holds
// a raw JS Date, which serializes to an ISO string (no .seconds) over HTTP.
function convertFirestoreTimestamp(firestoreTimestamp) {
  if (firestoreTimestamp && typeof firestoreTimestamp.seconds === 'number') {
    return new Date(firestoreTimestamp.seconds * 1000);
  }
  return new Date(firestoreTimestamp);
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

    // Loop through transactions and add each to requests for ledgerSheetId. Always rewrite
    // the whole row budget (ledgerStartRow through ledgerStartRow + MaxLedgerRows - 1), not
    // just as many rows as there are current transactions - otherwise a deleted transaction
    // leaves its old row's data sitting on the sheet with nothing to overwrite it. Rows past
    // the current transaction count get blanked (transaction is undefined for them).
    for (let idx = 0; idx < MaxLedgerRows; idx++) {
      const transaction = transactions[idx]
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
                    stringValue: transaction?.date ? formatDate(convertFirestoreTimestamp(transaction.date)) : ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction?.checkNumber ? transaction.checkNumber.toString() : ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction?.paidTo ? transaction.paidTo : '' // Columns C-E (merged): "Payment to/deposit from"
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: '' // Leave other cells in the "Payment to/deposit from" merge (D-E) blank.
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: ''
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: transaction?.memo ? transaction.memo : '' // Columns F-I (merged): "Memo"
                  }
                },
                {
                  userEnteredValue: {
                    stringValue: '' // Leave other cells in the "Memo" merge (G-I) blank.
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
                  userEnteredValue: transaction?.accountNumber
                    ? { numberValue: Number(transaction.accountNumber) }
                    : { stringValue: '' }
                },
                {
                  userEnteredValue: {
                    numberValue: transaction?.value ? transaction.value : 0 //Provide a default number
                  }
                }
              ]
            }
          ],
          fields: 'userEnteredValue'
        }
      });
    }

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

    console.log("type updates??", typeUpdates);

    // Deposits (D) / Non-Income Deposits (ND): one row per transaction, chronological.
    // typeUpdates[type] is already sorted ascending by date (see calculateAccountTotals).
    ['D', 'ND'].forEach(type => {
      const cellLocation = cellLocations[type]
      const items = typeUpdates[type] || []
      const max = type === 'D' ? MaxD : MaxND

      // Always rewrite the full row budget, not just the rows with current items - deposits
      // are listed chronologically with no fixed per-account row, so a deleted transaction
      // must blank out whatever row it used to occupy instead of leaving stale data behind.
      for (let index = 0; index < max; index++) {
        const { date, description, amount } = items[index] || {}
        const rowIndex = cellLocation.row + index

        requests.push({
          updateCells: {
            range: {
              sheetId: summarySheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: cellLocation.date,
              endColumnIndex: cellLocation.date + 1,
            },
            rows: [{
              values: [
                {
                  userEnteredValue: {
                    stringValue: date ? formatDate(convertFirestoreTimestamp(date)) : ''
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
              startColumnIndex: cellLocation.description,
              endColumnIndex: cellLocation.description + 1,
            },
            rows: [{
              values: [
                {
                  userEnteredValue: {
                    stringValue: description || ''
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
              startColumnIndex: cellLocation.amount,
              endColumnIndex: cellLocation.amount + 1,
            },
            rows: [{
              values: [
                {
                  userEnteredValue: {
                    numberValue: amount || 0
                  }
                }
              ]
            }],
            fields: 'userEnteredValue'
          }
        });
      }
    });

    // Expenses (E) / Non-Deductible Expenses (NE): each account lands on a fixed row
    // determined by its own accountNumber, so accounts with no activity this ledger
    // simply produce no write (their row stays blank/unchanged). An account that IS
    // tracked but whose combined total (this ledger's value + carried-forward
    // previousTotal) has dropped to $0 gets its name blanked below, effectively
    // deleting the line.
    ['E', 'NE'].forEach(type => {
      const cellLocation = cellLocations[type]
      const items = typeUpdates[type] || []
      const maxRows = type === 'E' ? MaxE : MaxNE
      const maxAccountNumber = cellLocation.accountNumberStart + maxRows - 1

      items.forEach(({ accountName, accountNumber: rawAccountNumber, value, previousTotal }) => {
        const accountNumber = Number(rawAccountNumber)
        if (
          Number.isNaN(accountNumber) ||
          accountNumber < cellLocation.accountNumberStart ||
          accountNumber > maxAccountNumber
        ) {
          console.log(`[updateSpreadsheet] skipping ${type} account "${accountName}" - accountNumber ${rawAccountNumber} is out of range`)
          return
        }

        const rowIndex = cellLocation.row + (accountNumber - cellLocation.accountNumberStart)
        // A zero combined total (this ledger's value plus everything carried forward from
        // previous ledgers) means the account has no remaining activity at all - e.g. its
        // last transaction was deleted - so blank the row instead of leaving a stale name
        // sitting next to $0 values.
        const isEmptyAccount = value + previousTotal === 0
        const displayName = isEmptyAccount ? '' : (type === 'NE' ? `${accountNumber} - ${accountName}` : accountName)

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
                    stringValue: displayName
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
      })
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