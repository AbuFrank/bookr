import { TransactionActions, type FirestoreTransaction } from "../types/transactionTypes";

interface TransactionState {
  transactions: FirestoreTransaction[];
}

export const transactionReducer = (state: TransactionState, action: any): TransactionState => {
  switch (action.type) {
    case TransactionActions.ADD_TRANSACTION:
      return { ...state, transactions: [...state.transactions, action.payload] };
    case TransactionActions.UPDATE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.map((transaction) =>
          transaction.id === action.payload.id ? action.payload : transaction
        ),
      };
    case TransactionActions.DELETE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.filter((transaction) => transaction.id !== action.payload),
      };
    case TransactionActions.SET_TRANSACTIONS:
      return { ...state, transactions: action.payload };
    default:
      return state;
  }
};