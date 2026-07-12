import { describe, it, expect } from 'vitest';
import { sortFoldersIntoTree } from './folders';
import type { Folder } from '../types/folderTypes';

const makeFolder = (overrides: Partial<Folder>): Folder => ({
  id: 'folder-id',
  name: 'Folder',
  userId: 'user-1',
  dateCreated: new Date('2024-01-01'),
  parentId: null,
  ...overrides,
});

describe('sortFoldersIntoTree', () => {
  it('returns an empty array when there are no folders', () => {
    expect(sortFoldersIntoTree([])).toEqual([]);
    expect(sortFoldersIntoTree(null)).toEqual([]);
  });

  it('returns an empty array when there is no "Bookr App" root folder', () => {
    const folders = [makeFolder({ id: 'a', name: 'Not The Root', parentId: null })];
    expect(sortFoldersIntoTree(folders)).toEqual([]);
  });

  it('nests books under the Bookr App root and fiscal years under their book', () => {
    const root = makeFolder({ id: 'root', name: 'Bookr App', parentId: null });
    const bookA = makeFolder({ id: 'book-a', name: 'Household', parentId: 'root' });
    const bookB = makeFolder({ id: 'book-b', name: 'Business', parentId: 'root' });
    const yearUnderA = makeFolder({ id: 'year-a', name: '2024', parentId: 'book-a' });

    const tree = sortFoldersIntoTree([root, bookA, bookB, yearUnderA]);

    expect(tree).toHaveLength(2);
    const householdNode = tree.find((node) => node.id === 'book-a');
    expect(householdNode.children).toHaveLength(1);
    expect(householdNode.children[0].id).toBe('year-a');

    const businessNode = tree.find((node) => node.id === 'book-b');
    expect(businessNode.children).toHaveLength(0);
  });

  it('sorts numeric child folder names (fiscal years) in descending order', () => {
    const root = makeFolder({ id: 'root', name: 'Bookr App', parentId: null });
    const book = makeFolder({ id: 'book-a', name: 'Household', parentId: 'root' });
    const year2023 = makeFolder({ id: 'year-2023', name: '2023', parentId: 'book-a' });
    const year2025 = makeFolder({ id: 'year-2025', name: '2025', parentId: 'book-a' });
    const year2024 = makeFolder({ id: 'year-2024', name: '2024', parentId: 'book-a' });

    const tree = sortFoldersIntoTree([root, book, year2023, year2025, year2024]);
    const householdNode = tree.find((node) => node.id === 'book-a');

    expect(householdNode.children.map((child: Folder) => child.name)).toEqual(['2025', '2024', '2023']);
  });

  it('sorts non-numeric child folder names alphabetically', () => {
    const root = makeFolder({ id: 'root', name: 'Bookr App', parentId: null });
    const book = makeFolder({ id: 'book-a', name: 'Household', parentId: 'root' });
    const zebra = makeFolder({ id: 'z', name: 'Zebra', parentId: 'book-a' });
    const apple = makeFolder({ id: 'a', name: 'Apple', parentId: 'book-a' });

    const tree = sortFoldersIntoTree([root, book, zebra, apple]);
    const householdNode = tree.find((node) => node.id === 'book-a');

    expect(householdNode.children.map((child: Folder) => child.name)).toEqual(['Apple', 'Zebra']);
  });
});
