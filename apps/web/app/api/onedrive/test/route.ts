import { getGraphToken } from "@/lib/msgraph";
import { getConfig } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    const accessToken = await getGraphToken();
    const config = getConfig();
    
    // Test: Get drive info
    const driveUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.msGraph.onedriveUserPrincipalName)}/drive`;
    const driveResponse = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      return NextResponse.json(
        { ok: false, error: `Drive fetch failed: ${driveResponse.status} - ${errorText}` },
        { status: 500 }
      );
    }
    
    const driveData = await driveResponse.json();
    
    // Test: Get root
    const rootUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.msGraph.onedriveUserPrincipalName)}/drive/root`;
    const rootResponse = await fetch(rootUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!rootResponse.ok) {
      const errorText = await rootResponse.text();
      return NextResponse.json(
        { ok: false, error: `Root fetch failed: ${rootResponse.status} - ${errorText}` },
        { status: 500 }
      );
    }
    
    const rootData = await rootResponse.json();
    
    // Test: List root children
    const driveId = driveData.id;
    const rootId = rootData.id.includes("!") ? rootData.id.split("!")[1] : rootData.id;
    const childrenUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${rootId}/children`;
    
    const childrenResponse = await fetch(childrenUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!childrenResponse.ok) {
      const errorText = await childrenResponse.text();
      return NextResponse.json(
        { 
          ok: false, 
          error: `Children fetch failed: ${childrenResponse.status} - ${errorText}`,
          debug: {
            driveId,
            rootId,
            rootDataId: rootData.id,
            childrenUrl,
          }
        },
        { status: 500 }
      );
    }
    
    const childrenData = await childrenResponse.json();
    
    // Test: List RAG_Wissen folder directly
    const ragWissenFolder = childrenData.value?.find((item: any) => item.name === "RAG_Wissen" && item.folder);
    let ragWissenChildren = null;
    let ragWissenError = null;
    
    if (ragWissenFolder) {
      const ragWissenItemId = ragWissenFolder.id.includes("!") ? ragWissenFolder.id.split("!")[1] : ragWissenFolder.id;
      const ragWissenChildrenUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${ragWissenItemId}/children`;
      
      try {
        const ragWissenResponse = await fetch(ragWissenChildrenUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        
        if (!ragWissenResponse.ok) {
          const errorText = await ragWissenResponse.text();
          ragWissenError = `RAG_Wissen children fetch failed: ${ragWissenResponse.status} - ${errorText}`;
        } else {
          ragWissenChildren = await ragWissenResponse.json();
        }
      } catch (err) {
        ragWissenError = err instanceof Error ? err.message : "Unknown error";
      }
    }
    
    return NextResponse.json({
      ok: true,
      driveId: driveData.id,
      rootId: rootData.id,
      rootIdExtracted: rootId,
      childrenCount: childrenData.value?.length || 0,
      children: childrenData.value?.slice(0, 5) || [],
      ragWissen: {
        found: !!ragWissenFolder,
        folderId: ragWissenFolder?.id,
        folderIdExtracted: ragWissenFolder?.id?.includes("!") ? ragWissenFolder.id.split("!")[1] : ragWissenFolder?.id,
        error: ragWissenError,
        childrenCount: ragWissenChildren?.value?.length || 0,
        children: ragWissenChildren?.value?.slice(0, 10) || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

