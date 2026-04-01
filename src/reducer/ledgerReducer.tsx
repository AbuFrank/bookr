import { LedgerActions, type FirestoreLedger } from "../types/ledgerTypes";

type LedgerState = {
    ledgers: FirestoreLedger[];
    currentLedger: FirestoreLedger | null;
};

const initialState: LedgerState = {
    ledgers: [],
    currentLedger: null,
};

const ledgerReducer = (state: LedgerState = initialState, action: any): LedgerState => {
    switch (action.type) {
        case LedgerActions.ADD_LEDGER:
            return {
                ...state,
                ledgers: [...state.ledgers, action.payload],
            };

        case LedgerActions.UPDATE_LEDGER:
            return {
                ...state,
                ledgers: state.ledgers.map((ledger) =>
                    ledger.id === action.payload.id ? action.payload : ledger
                ),
                currentLedger:
                    state.currentLedger?.id === action.payload.id
                        ? action.payload
                        : state.currentLedger,
            };

        case LedgerActions.DELETE_LEDGER:
            return {
                ...state,
                ledgers: state.ledgers.filter((ledger) => ledger.id !== action.payload),
                currentLedger:
                    state.currentLedger?.id === action.payload ? null : state.currentLedger,
            };

        case LedgerActions.SET_LEDGERS:
            return {
                ...state,
                ledgers: action.payload,
            };

        case LedgerActions.SET_CURRENT_LEDGER:
            return {
                ...state,
                currentLedger: action.payload,
            };

        default:
            return state;
    }
};

export default ledgerReducer;