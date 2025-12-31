/**
 * Microsoft Graph API client for OneDrive for Business.
 * Uses application permissions (client_credentials flow).
 */

import { getConfig } from "./config";

export interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
    hashes?: {
      sha1Hash?: string;
    };
  };
  size?: number;
  lastModifiedDateTime: string;
}

export interface OneDriveListResponse {
  value: OneDriveItem[];
  "@odata.nextLink"?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Fetches an access token using client_credentials flow.
 * Caches the token until it expires.
 */
export async function getGraphToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const config = getConfig();
  const tokenUrl = `https://login.microsoftonline.com/${config.msGraph.tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.msGraph.clientId,
    client_secret: config.msGraph.clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Graph token fetch failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: GraphTokenResponse = await response.json();
  if (!data.access_token) {
    throw new Error("Graph token response missing access_token");
  }

  // Cache token (expires_in is in seconds)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5 min buffer
  };

  return data.access_token;
}

/**
 * Gets the OneDrive drive ID and root folder ID for a user.
 */
async function getUserOneDriveInfo(
  accessToken: string,
  userPrincipalName: string
): Promise<{ driveId: string; rootId: string }> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userPrincipalName)}/drive`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get OneDrive drive: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  
  // Fetch root directly to get the root folder ID
  const rootUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userPrincipalName)}/drive/root`;
  const rootResponse = await fetch(rootUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!rootResponse.ok) {
    const errorText = await rootResponse.text();
    throw new Error(
      `Failed to get OneDrive root: ${rootResponse.status} ${rootResponse.statusText} - ${errorText}`
    );
  }
  
  const rootData = await rootResponse.json();
  // rootData.id is just the itemId, not "driveId!itemId"
  const rootId = rootData.id;
  
  return {
    driveId: data.id,
    rootId: rootId,
  };
}

/**
 * Resolves a folder path to its ID.
 * Path format: /folder1/folder2 or /RAG_Wissen
 */
async function resolveFolderPath(
  accessToken: string,
  driveId: string,
  rootId: string,
  folderPath: string
): Promise<string> {
  if (!folderPath || folderPath === "/") {
    return rootId;
  }

  // Remove leading slash and split
  const parts = folderPath.replace(/^\//, "").split("/").filter((p) => p);

  // Extract itemId from rootId if it has driveId prefix
  let currentId = rootId.includes("!") ? rootId.split("!")[1] : rootId;

  for (const part of parts) {
    // List all children and find the folder by name
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${currentId}/children`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to resolve folder path '${part}': ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: OneDriveListResponse = await response.json();
    
    // Find folder by name
    const folder = data.value.find(
      (item) => item.name === part && item.folder !== undefined
    );
    
    if (!folder) {
      throw new Error(`Folder not found: ${part} in path ${folderPath}`);
    }

    // Extract itemId from folder.id (might be "driveId!itemId" or just "itemId")
    currentId = folder.id.includes("!") ? folder.id.split("!")[1] : folder.id;
  }

  return currentId;
}

/**
 * Lists children of a OneDrive folder.
 * @param folderId - The folder ID (use null for root, format: "driveId!itemId" or just "itemId")
 * @param recursive - If true, recursively lists all children (default: false, only 1 level)
 */
export async function listOneDriveFolder(
  folderId?: string | null,
  recursive: boolean = false
): Promise<OneDriveItem[]> {
  const accessToken = await getGraphToken();
  const config = getConfig();

  // Get drive info
  const driveInfo = await getUserOneDriveInfo(accessToken, config.msGraph.onedriveUserPrincipalName);
  const driveId = driveInfo.driveId;
  
  // Determine target folder ID
  let itemId: string;
  
  if (folderId) {
    // If folderId is provided, extract itemId (might be "driveId!itemId" or just "itemId")
    itemId = folderId.includes("!") ? folderId.split("!")[1] : folderId;
  } else {
    // Resolve from config path - list root children and find folder
    const rootChildrenUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${driveInfo.rootId}/children`;
    const rootChildrenResponse = await fetch(rootChildrenUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!rootChildrenResponse.ok) {
      const errorText = await rootChildrenResponse.text();
      throw new Error(
        `Failed to list root children: ${rootChildrenResponse.status} ${rootChildrenResponse.statusText} - ${errorText}`
      );
    }
    
    const rootChildrenData: OneDriveListResponse = await rootChildrenResponse.json();
    const folderName = config.msGraph.onedriveFolderPath.replace(/^\//, "");
    const folder = rootChildrenData.value.find(
      (item) => item.name === folderName && item.folder !== undefined
    );
    
    if (!folder) {
      throw new Error(`Folder not found: ${folderName} in path ${config.msGraph.onedriveFolderPath}`);
    }
    
    // Extract itemId from folder.id (might be "driveId!itemId" or just "itemId")
    itemId = folder.id.includes("!") ? folder.id.split("!")[1] : folder.id;
  }

  // Construct URL - same as in test endpoint that works
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children`;

  const allItems: OneDriveItem[] = [];
  let nextLink: string | undefined = url;

  // Handle pagination
  while (nextLink) {
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to list OneDrive folder: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: OneDriveListResponse = await response.json();
    allItems.push(...data.value);

    // If recursive, also fetch children of folders
    if (recursive) {
      for (const item of data.value) {
        if (item.folder) {
          // Extract itemId from item.id (might be "driveId!itemId" or just "itemId")
          const childItemId = item.id.includes("!") ? item.id.split("!")[1] : item.id;
          // Recursively list children of this folder
          const childItems = await listOneDriveFolder(childItemId, true);
          allItems.push(...childItems);
        }
      }
    }

    nextLink = data["@odata.nextLink"];
  }

  return allItems;
}

