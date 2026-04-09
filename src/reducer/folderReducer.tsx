import { FolderActions, type Folder } from "../types/folderTypes";

type FolderState = {
  folders: Folder[];
  currentBook: Folder | null;
  currentYear: Folder | null;
  currentChildren: Folder[];
};

const initialState: FolderState = {
  folders: [],
  currentBook: null,
  currentYear: null,
  currentChildren: [],
};

const folderReducer = (state: FolderState = initialState, action: any): FolderState => {
  switch (action.type) {
    case FolderActions.ADD_FOLDER:
      return {
        ...state,
        folders: [...state.folders, action.payload],
      };

    case FolderActions.UPDATE_FOLDER: {
      const updatedFolders = state.folders.map((folder) =>
        folder.id === action.payload.id ? action.payload : folder
      );

      const updatedFiscalYear =
        state.currentYear?.id === action.payload.id
          ? action.payload
          : state.currentYear;

      const updatedChildren = updatedFiscalYear
        ? updatedFolders.filter((folder) => folder.parentId === updatedFiscalYear.id)
        : state.currentChildren.map((child) =>
          child.id === action.payload.id ? action.payload : child
        );

      return {
        ...state,
        folders: updatedFolders,
        currentYear: updatedFiscalYear,
        currentChildren: updatedChildren,
      };
    }

    case FolderActions.DELETE_FOLDER: {
      const filteredFolders = state.folders.filter(
        (folder) => folder.id !== action.payload
      );

      const nextCurrentParent =
        state.currentYear?.id === action.payload ? null : state.currentYear;

      const nextChildren = nextCurrentParent
        ? filteredFolders.filter((folder) => folder.parentId === nextCurrentParent.id)
        : [];

      return {
        ...state,
        folders: filteredFolders,
        currentYear: nextCurrentParent,
        currentChildren: nextChildren,
      };
    }

    case FolderActions.SET_FOLDERS: {
      const nextChildren = state.currentYear
        ? action.payload.filter(
          (folder: Folder) => folder.parentId === state.currentYear?.id
        )
        : [];

      return {
        ...state,
        folders: action.payload,
        currentChildren: nextChildren,
      };
    }

    case FolderActions.SET_CURRENT_YEAR: {
      const selectedParent: Folder | null = action.payload;
      const children = selectedParent
        ? state.folders.filter((folder) => folder.parentId === selectedParent.id)
        : [];

      return {
        ...state,
        currentYear: selectedParent,
        currentChildren: children,
      };
    }

    case FolderActions.SET_CURRENT_BOOK: {
      const selectedBook: Folder | null = action.payload;

      return {
        ...state,
        currentBook: selectedBook,
      };
    }

    default:
      return state;
  }
};

export default folderReducer;