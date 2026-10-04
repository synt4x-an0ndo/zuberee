import { authenticateRequest } from "@/directory/auth/auth.js";

export async function GET(request) {
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
            message: "Authenticated user.",
            data: auth.user,
        },
        { status: 200 }
    );
}