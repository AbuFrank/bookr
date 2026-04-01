import { FolderActions, type Folder } from "../types/folderTypes";

type FolderState = {
  folders: Folder[];
  currentChildren: Folder[];
  currentParent: Folder | null;
};

const initialState: FolderState = {
  folders: [],
  currentChildren: [],
  currentParent: null,
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

      const updatedCurrentParent =
        state.currentParent?.id === action.payload.id
          ? action.payload
          : state.currentParent;

      const updatedChildren = updatedCurrentParent
        ? updatedFolders.filter((folder) => folder.parentId === updatedCurrentParent.id)
        : state.currentChildren.map((child) =>
          child.id === action.payload.id ? action.payload : child
        );

      return {
        ...state,
        folders: updatedFolders,
        currentParent: updatedCurrentParent,
        currentChildren: updatedChildren,
      };
    }

    case FolderActions.DELETE_FOLDER: {
      const filteredFolders = state.folders.filter(
        (folder) => folder.id !== action.payload
      );

      const nextCurrentParent =
        state.currentParent?.id === action.payload ? null : state.currentParent;

      const nextChildren = nextCurrentParent
        ? filteredFolders.filter((folder) => folder.parentId === nextCurrentParent.id)
        : [];

      return {
        ...state,
        folders: filteredFolders,
        currentParent: nextCurrentParent,
        currentChildren: nextChildren,
      };
    }

    case FolderActions.SET_FOLDERS: {
      const nextChildren = state.currentParent
        ? action.payload.filter(
          (folder: Folder) => folder.parentId === state.currentParent?.id
        )
        : [];

      return {
        ...state,
        folders: action.payload,
        currentChildren: nextChildren,
      };
    }

    case FolderActions.SET_CURRENT_PARENT: {
      const selectedParent: Folder | null = action.payload;
      const children = selectedParent
        ? state.folders.filter((folder) => folder.parentId === selectedParent.id)
        : [];

      return {
        ...state,
        currentParent: selectedParent,
        currentChildren: children,
      };
    }

    default:
      return state;
  }
};

export default folderReducer;