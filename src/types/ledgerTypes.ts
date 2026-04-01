export interface FirestoreLedger {
    id: string;
    userId: string;
    name: string;
    description: string;
    dateCreated: Date;
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
    SET_CURRENT_LEDGER: 'SET_CURRENT_LEDGER'
}