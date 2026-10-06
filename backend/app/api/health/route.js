import prisma from "@/directory/prisma/prisma.js";

const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    "http://localhost:3000";

async function checkDatabase() {
    const startedAt = Date.now();

    try {
        await prisma.$queryRaw`SELECT 1`;
        return {
            status: "up",
            responseTimeMs: Date.now() - startedAt,
        };
    } catch (error) {
        console.error("Health check database error:", error);
        return {
            status: "down",
            responseTimeMs: Date.now() - startedAt,
            message: "Database connection failed.",
        };
    }
}

async function checkFrontend() {
    const startedAt = Date.now();

    try {
        const response = await fetch(frontendUrl, {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
        });

        return {
            status: response.ok ? "up" : "down",
            responseTimeMs: Date.now() - startedAt,
            httpStatus: response.status,
            url: frontendUrl,
        };
    } catch (error) {
        console.error("Health check frontend error:", error);
        return {
            status: "down",
            responseTimeMs: Date.now() - startedAt,
            message: "Frontend is not reachable.",
            url: frontendUrl,
        };
    }
}

export async function GET() {
    const checkedAt = new Date().toISOString();
    const [database, frontend] = await Promise.all([
        checkDatabase(),
        checkFrontend(),
    ]);
    const healthy = database.status === "up" && frontend.status === "up";

    return Response.json(
        {
            success: healthy,
            message: healthy ? "Site is healthy." : "Site health is degraded.",
            data: {
                status: healthy ? "healthy" : "degraded",
                checkedAt,
                backend: {
                    status: "up",
                    service: "backend",
                },
                database,
                frontend,
            },
        },
        {
            status: healthy ? 200 : 503,
            headers: {
                "Cache-Control": "no-store, max-age=0",
            },
        }
    );
}