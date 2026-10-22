import { unlink } from "fs/promises";
import path from "path";
import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

const DEFAULT_AVATAR = "/images/default-avatar.png";

/** Reset a customer avatar to the store-managed default and clean up an uploaded file. */
export async function DELETE(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return Response.json({ success: false, message: auth.message, data: null }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: auth.user.userId },
      select: { image: true },
    });

    await prisma.user.update({
      where: { id: auth.user.userId },
      data: { image: DEFAULT_AVATAR },
    });

    if (currentUser?.image?.startsWith("/uploads/avatars/")) {
      try {
        await unlink(path.join(process.cwd(), "public", currentUser.image));
      } catch (error) {
        if (error?.code !== "ENOENT") console.error("Failed to delete removed avatar:", error);
      }
    }

    return Response.json({
      success: true,
      message: "Profile photo removed.",
      data: { image: DEFAULT_AVATAR },
    });
  } catch (error) {
    console.error("Remove avatar API error:", error);
    return Response.json({ success: false, message: "Failed to remove profile photo.", data: null }, { status: 500 });
  }
}