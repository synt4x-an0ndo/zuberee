import { unlink } from "fs/promises";
import path from "path";
import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";
import { deleteMediaFileByUrl, isMediaUrl, saveMediaFile } from "@/lib/media-store.js";

const MAX_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];


export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("image");

        if (!file || typeof file === "string") {
            return Response.json(
                {
                    success: false,
                    message: "Image file is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return Response.json(
                {
                    success: false,
                    message: "Image size must not exceed 2MB.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return Response.json(
                {
                    success: false,
                    message: "Only JPEG, PNG and WebP images are allowed.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: auth.user.userId },
            select: { image: true },
        });

        // Stored in Postgres so the running server serves it immediately.
        const stored = await saveMediaFile(file, "avatars");
        const imageUrl = stored.url;

        await prisma.user.update({
            where: { id: auth.user.userId },
            data: { image: imageUrl },
        });

        if (currentUser?.image) {
            if (isMediaUrl(currentUser.image)) {
                await deleteMediaFileByUrl(currentUser.image);
            } else if (currentUser.image.startsWith("/uploads/avatars/")) {
                try {
                    await unlink(path.join(process.cwd(), "public", currentUser.image));
                } catch (err) {
                    console.error("Failed to delete old avatar:", err);
                }
            }
        }

        return Response.json(
            {
                success: true,
                message: "Avatar uploaded successfully.",
                data: {
                    image: imageUrl,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Upload avatar API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to upload avatar.",
                data: null,
            },
            { status: 500 }
        );
    }
}