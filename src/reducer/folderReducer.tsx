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

const folderReducer = (state: FolderState = initialState, action: any) => {
  switch (action.type) {
    case FolderActions.ADD_FOLDER:
      return { ...state, folders: [...state.folders, action.payload] };
    case FolderActions.UPDATE_FOLDER:
      return {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === action.payload.id ? action.payload : folder
        ),
      };
    case FolderActions.DELETE_FOLDER:
      return {
        ...state,
        folders: state.folders.filter((folder) => folder.id !== action.payload),
      };
    case FolderActions.SET_FOLDERS:
      return { ...state, folders: action.payload };
    case FolderActions.SET_CURRENT_PARENT:
      const children = state.folders.filter(folder => folder.parentId === action.payload);
      return {
        ...state,
        currentParent: action.payload,
        currentChildren: children
      };
    default:
      return state;
  }
};

export default folderReducer;