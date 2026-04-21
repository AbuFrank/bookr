import { AccountActions, type FirestoreAccount } from "../types/accountTypes";

type AccountState = {
  accounts: FirestoreAccount[];
  currentAccounts: FirestoreAccount[];
};

const initialState: AccountState = {
  accounts: [],
  currentAccounts: [],
};

const accountReducer = (state: AccountState = initialState, action: any) => {
  switch (action.type) {
    case AccountActions.ADD_ACCOUNT:
      return { ...state, accounts: [...state.accounts, action.payload] };
    case AccountActions.UPDATE_ACCOUNT:
      return {
        ...state,
        accounts: state.accounts.map((account) =>
          account.id === action.payload.id ? action.payload : account
        ),
      };
    case AccountActions.DELETE_ACCOUNT:
      return {
        ...state,
        accounts: state.accounts.filter((account) => account.id !== action.payload),
      };
    case AccountActions.SET_ACCOUNTS:
      return { ...state, accounts: action.payload };
    case AccountActions.SET_CURRENT_ACCOUNTS:
      return {
        ...state,
        currentAccounts: action.payload,
      };
    case AccountActions.RESET:
      return {
        accounts: [],
        currentAccounts: []
      };
    default:
      return state;
  }
};

export default accountReducer;