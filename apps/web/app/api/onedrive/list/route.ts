import { listOneDriveFolder } from "@/lib/msgraph";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const recursive = searchParams.get("recursive") === "true";
    const folderId = searchParams.get("folderId") || null;

    const items = await listOneDriveFolder(folderId, recursive);

    return NextResponse.json(
      {
        ok: true,
        count: items.length,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          webUrl: item.webUrl,
          isFolder: !!item.folder,
          isFile: !!item.file,
          mimeType: item.file?.mimeType,
          size: item.size,
          lastModified: item.lastModifiedDateTime,
          childCount: item.folder?.childCount,
        })),
      },
      { status: 200 }
    );
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

