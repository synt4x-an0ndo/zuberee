import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function authenticateRequest(request) {
    try {
        const authorization = request.headers.get("authorization");

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return {
                authenticated: false,
                message: "Authorization token is required.",
            };
        }

        const token = authorization.substring(7);

        const { payload } = await jwtVerify(token, secret);

        return {
            authenticated: true,
            user: {
                userId: payload.userId,
                email: payload.email,
                role: payload.role,
            },
        };
    } catch (error) {
        return {
            authenticated: false,
            message: "Invalid or expired token.",
        };
    }
}