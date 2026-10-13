import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

const MAX_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const EXT_MAP = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

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

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = EXT_MAP[file.type];
        const filename = `avatar-${auth.user.userId}-${Date.now()}.${ext}`;

        const uploadDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "avatars"
        );

        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);

        await writeFile(filePath, buffer);

        const currentUser = await prisma.user.findUnique({
            where: { id: auth.user.userId },
            select: { image: true },
        });

        const imageUrl = `/uploads/avatars/${filename}`;

        await prisma.user.update({
            where: { id: auth.user.userId },
            data: { image: imageUrl },
        });

        if (
            currentUser?.image &&
            currentUser.image.startsWith("/uploads/avatars/")
        ) {
            const oldPath = path.join(
                process.cwd(),
                "public",
                currentUser.image
            );

            try {
                await unlink(oldPath);
            } catch (err) {
                console.error("Failed to delete old avatar:", err);
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