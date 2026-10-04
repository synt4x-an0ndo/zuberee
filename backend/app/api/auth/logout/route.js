import { authenticateRequest } from "@/directory/auth/auth.js";

export async function POST(request) {
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

    return Response.json(
        {
            success: true,
            message: "Logout successful.",
            data: null,
        },
        { status: 200 }
    );
}