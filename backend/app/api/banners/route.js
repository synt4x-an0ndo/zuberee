import prisma from "../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];

function formatBanner(banner) {
    return {
        id: banner.id,
        image: `/api/banners/${banner.id}/image`,
        link: banner.link,
        display_priority: banner.displayPriority,
        is_active: banner.isActive,
        created_at: banner.createdAt,
        updated_at: banner.updatedAt,
    };
}

// GET /api/banners (PUBLIC)
export async function GET() {
    try {
        const banners = await prisma.banner.findMany({
            orderBy: [
                { displayPriority: "asc" },
                { id: "desc" },
            ],
            select: {
                id: true,
                link: true,
                displayPriority: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return Response.json({
            data: banners.map(formatBanner),
        });
    } catch (error) {
        console.error("GET /api/banners error:", error);

        return Response.json(
            {
                message: "Failed to fetch banners.",
            },
            { status: 500 }
        );
    }
}

// POST /api/banners (ADMIN ONLY)
export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { message: "Admin access required." },
                { status: 403 }
            );
        }

        const formData = await request.formData();

        const image = formData.get("image");
        const link = formData.get("link");
        const displayPriority = formData.get("display_priority");
        const isActive = formData.get("is_active");

        if (!image || typeof image === "string") {
            return Response.json(
                {
                    message: "Image file is required.",
                },
                { status: 400 }
            );
        }

        if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
            return Response.json(
                {
                    message:
                        "Invalid image type. Only JPEG, PNG, WEBP and GIF are allowed.",
                },
                { status: 400 }
            );
        }

        const arrayBuffer = await image.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        let priority = 0;

        if (displayPriority !== null && displayPriority !== "") {
            priority = Number(displayPriority);

            if (!Number.isInteger(priority) || priority < 0) {
                return Response.json(
                    {
                        message: "display_priority must be a non-negative integer.",
                    },
                    { status: 400 }
                );
            }
        }

        let active = true;

        if (isActive !== null && isActive !== "") {
            active = isActive === "true";
        }

        const banner = await prisma.banner.create({
            data: {
                image: imageBuffer,
                imageType: image.type,
                link:
                    typeof link === "string" && link.trim() !== ""
                        ? link.trim()
                        : null,
                displayPriority: priority,
                isActive: active,
            },
            select: {
                id: true,
                link: true,
                displayPriority: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return Response.json(
            {
                message: "Banner created successfully.",
                data: formatBanner(banner),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/banners error:", error);

        return Response.json(
            {
                message: "Failed to create banner.",
            },
            { status: 500 }
        );
    }
}