import type { Folder, FolderNode } from "../types/folderTypes";

// Helper function to sort folders into nested structure using reduce
export const sortFoldersIntoTree = (folders: Folder[] | null): any[] => {
  // Create a map of all folders by ID for quick lookup

  if (!folders?.length) {
    return []
  }

  const appFolder = folders.find(folder => !folder.parentId)

  if (!appFolder?.id) {
    return []
  }

  const folderMap = new Map<string, FolderNode>();

  // First pass: Create all folder nodes
  folders.forEach(folder => {
    if (folder?.parentId === appFolder.id)
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
  });

  // Create a map of all folders except the Bookr App folder
  const childFolders = folders.filter(folder => folder.parentId && folder.parentId !== appFolder.id)


  childFolders.sort((a, b) => sortFoldersByName(a.name, b.name)).forEach(folder => {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      // Add to parent's children array
      const parentNode = folderMap.get(folder.parentId);
      if (parentNode && Array.isArray(parentNode.children)) {
        parentNode.children.push(folder);
      }
    }
  });

  const folderTree: FolderNode[] = Array.from<FolderNode>(folderMap.values());


  return folderTree;
};

// Function to sort folders by name
const sortFoldersByName = (a: string, b: string) => {
  // Handle case where names might be numbers (as strings)
  const isNumA = /^\d+$/.test(a);
  const isNumB = /^\d+$/.test(b);

  // If both are numbers, sort numerically
  if (isNumA && isNumB) {
    return parseInt(a, 10) - parseInt(b, 10);
  }

  // If only A is a number, A comes first
  if (isNumA && !isNumB) {
    return -1;
  }

  // If only B is a number, B comes first
  if (!isNumA && isNumB) {
    return 1;
  }

  // Both are text or both are not numbers, sort alphabetically
  return a.localeCompare(b);
}