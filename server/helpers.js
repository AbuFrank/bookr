

// Folder creation methods
// export const createSharedFolder = async (folderName, parentFolderId = null) => {
//   try {
//     const { drive } = getServiceAccountDrive();

//     const requestBody = {
//       name: folderName,
//       mimeType: 'application/vnd.google-apps.folder'
//     };

//     if (parentFolderId) {
//       requestBody.parents = [parentFolderId];
//     }

//     console.log('createSharedFolder ... attempting folder creation')

//     const folder = await drive.files.create({
//       requestBody: requestBody,
//       fields: 'id, name, parents'
//     });

//     console.log('created folder ==> ', folder.data)


//     return {
//       id: folder.data.id,
//       name: folder.data.name,
//       parentId: folder.data.parents ? folder.data.parents[0] : null
//     };

//   } catch (error) {
//     console.error('Error creating folder:', error);
//     throw error;
//   }
// };

export const getOrCreateFolder = async (folderName, parentFolderId = null) => {
  try {
    const { drive } = getServiceAccountDrive();

    console.log('getOrCreateFolder...')

    // Try to find existing folder
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)'
    });

    if (response.data.files.length > 0) {
      console.log('Found existing folder:', response.data.files[0].name);
      return response.data.files[0].id;
    } else {
      // Create new folder
      const newFolder = await createSharedFolder(folderName, parentFolderId);
      console.log('Created new folder:', newFolder.name);
      return newFolder.id;
    }
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
};