import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatProfile(profile) {
    return {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        user_id: profile.userId,
        has_user_account: profile.userId !== null,
        assigned_badge: profile.assignedBadge,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const hasAccount = searchParams.get("has_account")?.trim();

        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 20))
        );

        const skip = (page - 1) * perPage;

        const orders = await prisma.order.findMany({
            select: {
                id: true,
                userId: true,
                guestName: true,
                guestPhone: true,
                assignedBadge: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        badge: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const profileMap = new Map();

        for (const o of orders) {
            let key;
            let userId = null;
            let name = "";
            let phone = "";
            let email = null;
            let assignedBadge = null;
            let createdAt = o.createdAt;
            let updatedAt = o.updatedAt;

            if (o.userId && o.user) {
                key = `user:${o.userId}`;
                userId = o.user.id;
                name = o.user.name ?? "";
                phone = o.user.phone ?? "";
                email = o.user.email ?? null;
                assignedBadge = o.user.badge ?? null;
                createdAt = o.user.createdAt;
                updatedAt = o.user.updatedAt;
            } else {
                key = `guest:${o.guestPhone ?? "unknown"}`;
                name = o.guestName ?? "";
                phone = o.guestPhone ?? "";
                assignedBadge = o.assignedBadge ?? null;
            }

            if (!profileMap.has(key)) {
                profileMap.set(key, {
                    key,
                    userId,
                    name,
                    phone,
                    email,
                    assignedBadge,
                    createdAt,
                    updatedAt,
                });
            } else {
                const entry = profileMap.get(key);

                if (!entry.assignedBadge && assignedBadge) {
                    entry.assignedBadge = assignedBadge;
                }

                if (o.createdAt < entry.createdAt) {
                    entry.createdAt = o.createdAt;
                }

                if (o.updatedAt > entry.updatedAt) {
                    entry.updatedAt = o.updatedAt;
                }
            }
        }

        let profiles = Array.from(profileMap.values()).map((p, index) => ({
            id: index + 1,
            key: p.key,
            userId: p.userId,
            name: p.name,
            phone: p.phone,
            email: p.email,
            assignedBadge: p.assignedBadge,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        }));

        if (search) {
            const searchLower = search.toLowerCase();

            profiles = profiles.filter((p) => {
                return (
                    p.name?.toLowerCase().includes(searchLower) ||
                    p.phone?.toLowerCase().includes(searchLower) ||
                    p.email?.toLowerCase().includes(searchLower)
                );
            });
        }

        if (hasAccount === "true") {
            profiles = profiles.filter((p) => p.userId !== null);
        } else if (hasAccount === "false") {
            profiles = profiles.filter((p) => p.userId === null);
        }

        profiles.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        const total = profiles.length;
        const lastPage = Math.ceil(total / perPage);
        const paginated = profiles.slice(skip, skip + perPage);

        return Response.json({
            current_page: page,
            data: paginated.map(formatProfile),
            first_page_url: `?page=1`,
            from: total > 0 ? skip + 1 : 0,
            last_page: lastPage,
            last_page_url: `?page=${lastPage}`,
            next_page_url: page < lastPage ? `?page=${page + 1}` : null,
            path: "/api/admin/customer-profiles",
            per_page: perPage,
            prev_page_url: page > 1 ? `?page=${page - 1}` : null,
            to: Math.min(skip + perPage, total),
            total,
        });
    } catch (error) {
        console.error("Customer profiles API error:", error);

        return Response.json(
            { success: false, message: "Failed to load customer profiles." },
            { status: 500 }
        );
    }
}