export interface LedgerInput {
    id: string,
    userId: string;
    name: string;
    description: string;
    dateCreated: Date;
    parentFolderId: string;
    runningTotals: {
        [accountId: string]: number;
    } | null;
}

export interface Ledger extends LedgerInput {
    fileId: string
}

export interface FormLedgerData {
    name: string;
    description: string;
    dateCreated: Date;
}

export const LedgerActions = {
    SET_LEDGERS: 'SET_LEDGERS',
    ADD_LEDGER: 'ADD_LEDGER',
    UPDATE_LEDGER: 'UPDATE_LEDGER',
    DELETE_LEDGER: 'DELETE_LEDGER',
    SET_CURRENT_LEDGER: 'SET_CURRENT_LEDGER',
    SET_CURRENT_LEDGERS: 'SET_CURRENT_LEDGERS'
}