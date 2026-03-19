export interface Folder {
  id: string;
  name: string;
  userId: string;
  dateCreated: Date;
  parentId: string | null;
}

export interface FolderNode {
  id: string;
  name: string;
  dateCreated: Date;
  userId: string;
  parentId: string | null;
  children?: FolderNode[];
}

export const FolderActions = {
  ADD_FOLDER: 'ADD_FOLDER',
  UPDATE_FOLDER: 'UPDATE_FOLDER',
  DELETE_FOLDER: 'DELETE_FOLDER',
  SET_FOLDERS: 'SET_FOLDERS',
  SET_CURRENT_PARENT: 'SET_CURRENT_PARENT'
}