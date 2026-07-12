import { describe, it, expect } from 'vitest';
import folderReducer from './folderReducer';
import { FolderActions, type Folder } from '../types/folderTypes';

const makeFolder = (overrides: Partial<Folder>): Folder => ({
  id: 'folder-id',
  name: 'Folder',
  userId: 'user-1',
  dateCreated: new Date('2024-01-01'),
  parentId: null,
  ...overrides,
});

const initialState = { folders: [], currentBook: null, currentYear: null, currentChildren: [] };

describe('folderReducer', () => {
  it('adds a folder', () => {
    const folder = makeFolder({ id: 'f1' });
    const state = folderReducer(initialState, { type: FolderActions.ADD_FOLDER, payload: folder });
    expect(state.folders).toEqual([folder]);
  });

  it('updates a folder and refreshes currentChildren when the current fiscal year is updated', () => {
    const year = makeFolder({ id: 'year-1', name: '2024', parentId: 'book-1' });
    const child = makeFolder({ id: 'ledger-child', parentId: 'year-1' });
    const updatedYear = makeFolder({ id: 'year-1', name: '2024 renamed', parentId: 'book-1' });

    const state = folderReducer(
      { folders: [year, child], currentBook: null, currentYear: year, currentChildren: [child] },
      { type: FolderActions.UPDATE_FOLDER, payload: updatedYear }
    );

    expect(state.currentYear).toEqual(updatedYear);
    expect(state.folders).toContainEqual(updatedYear);
    expect(state.currentChildren).toEqual([child]);
  });

  it('deletes a folder and clears currentYear/currentChildren if the current year was deleted', () => {
    const year = makeFolder({ id: 'year-1', parentId: 'book-1' });
    const child = makeFolder({ id: 'ledger-child', parentId: 'year-1' });

    const state = folderReducer(
      { folders: [year, child], currentBook: null, currentYear: year, currentChildren: [child] },
      { type: FolderActions.DELETE_FOLDER, payload: 'year-1' }
    );

    expect(state.folders).toEqual([child]);
    expect(state.currentYear).toBeNull();
    expect(state.currentChildren).toEqual([]);
  });

  it('recomputes currentChildren on SET_FOLDERS based on the existing currentYear', () => {
    const year = makeFolder({ id: 'year-1', parentId: 'book-1' });
    const child = makeFolder({ id: 'ledger-child', parentId: 'year-1' });
    const unrelated = makeFolder({ id: 'other', parentId: 'other-year' });

    const state = folderReducer(
      { folders: [], currentBook: null, currentYear: year, currentChildren: [] },
      { type: FolderActions.SET_FOLDERS, payload: [year, child, unrelated] }
    );

    expect(state.folders).toEqual([year, child, unrelated]);
    expect(state.currentChildren).toEqual([child]);
  });

  it('sets currentYear and derives currentChildren from folders', () => {
    const year = makeFolder({ id: 'year-1', parentId: 'book-1' });
    const child = makeFolder({ id: 'ledger-child', parentId: 'year-1' });

    const state = folderReducer(
      { folders: [year, child], currentBook: null, currentYear: null, currentChildren: [] },
      { type: FolderActions.SET_CURRENT_YEAR, payload: year }
    );

    expect(state.currentYear).toEqual(year);
    expect(state.currentChildren).toEqual([child]);
  });

  it('sets currentBook', () => {
    const book = makeFolder({ id: 'book-1' });
    const state = folderReducer(initialState, { type: FolderActions.SET_CURRENT_BOOK, payload: book });
    expect(state.currentBook).toEqual(book);
  });

  it('resets to empty state', () => {
    const year = makeFolder({ id: 'year-1' });
    const state = folderReducer(
      { folders: [year], currentBook: year, currentYear: year, currentChildren: [year] },
      { type: FolderActions.RESET }
    );
    expect(state).toEqual(initialState);
  });

  it('returns the same state for an unknown action', () => {
    const state = folderReducer(initialState, { type: 'UNKNOWN' });
    expect(state).toBe(initialState);
  });
});
