import prisma from "../../../../directory/prisma/prisma.js";

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

async function getBanner(id) {
    return prisma.banner.findUnique({
        where: { id },
        select: {
            id: true,
            link: true,
            displayPriority: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

// GET /api/banners/:id
export async function GET(request, { params }) {
    try {
        const { id: bannerId } = await params;
        const id = Number(bannerId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    message: "Invalid banner ID.",
                },
                { status: 400 }
            );
        }

        const banner = await getBanner(id);

        if (!banner) {
            return Response.json(
                {
                    message: "Banner not found.",
                },
                { status: 404 }
            );
        }

        return Response.json({
            data: formatBanner(banner),
        });
    } catch (error) {
        console.error("GET /api/banners/:id error:", error);

        return Response.json(
            {
                message: "Failed to fetch banner.",
            },
            { status: 500 }
        );
    }
}

// PUT /api/banners/:id
export async function PUT(request, { params }) {
    try {
        const { id: bannerId } = await params;
        const id = Number(bannerId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    message: "Invalid banner ID.",
                },
                { status: 400 }
            );
        }

        const existingBanner = await prisma.banner.findUnique({
            where: { id },
        });

        if (!existingBanner) {
            return Response.json(
                {
                    message: "Banner not found.",
                },
                { status: 404 }
            );
        }

        const formData = await request.formData();

        const image = formData.get("image");
        const link = formData.get("link");
        const displayPriority = formData.get("display_priority");
        const isActive = formData.get("is_active");

        const updateData = {};

        // Image is optional during update.
        // If provided, replace the existing image.
        if (image !== null) {
            if (typeof image === "string") {
                return Response.json(
                    {
                        message: "Invalid image file.",
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

            updateData.image = imageBuffer;
            updateData.imageType = image.type;
        }

        // Update link only if field was sent
        if (link !== null) {
            updateData.link =
                typeof link === "string" && link.trim() !== ""
                    ? link.trim()
                    : null;
        }

        // Update display priority only if field was sent
        if (displayPriority !== null && displayPriority !== "") {
            const priority = Number(displayPriority);

            if (!Number.isInteger(priority) || priority < 0) {
                return Response.json(
                    {
                        message: "display_priority must be a non-negative integer.",
                    },
                    { status: 400 }
                );
            }

            updateData.displayPriority = priority;
        }

        // Update active status only if field was sent
        if (isActive !== null && isActive !== "") {
            updateData.isActive = isActive === "true";
        }

        const banner = await prisma.banner.update({
            where: { id },
            data: updateData,
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
            message: "Banner updated successfully.",
            data: formatBanner(banner),
        });
    } catch (error) {
        console.error("PUT /api/banners/:id error:", error);

        return Response.json(
            {
                message: "Failed to update banner.",
            },
            { status: 500 }
        );
    }
}

// DELETE /api/banners/:id
export async function DELETE(request, { params }) {
    try {
        const { id: bannerId } = await params;
        const id = Number(bannerId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    message: "Invalid banner ID.",
                },
                { status: 400 }
            );
        }

        const existingBanner = await prisma.banner.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingBanner) {
            return Response.json(
                {
                    message: "Banner not found.",
                },
                { status: 404 }
            );
        }

        await prisma.banner.delete({
            where: { id },
        });

        return Response.json({
            message: "Banner deleted successfully.",
        });
    } catch (error) {
        console.error("DELETE /api/banners/:id error:", error);

        return Response.json(
            {
                message: "Failed to delete banner.",
            },
            { status: 500 }
        );
    }
}
