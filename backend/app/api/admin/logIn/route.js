import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import prisma from "../../../../directory/prisma/prisma.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request) {
    try {
        const { email, password } = await request.json();
        const user = await prisma.user.findUnique({ where: { email: String(email || "").trim().toLowerCase() } });

        if (!user || user.role !== "ADMIN" || !(await bcrypt.compare(password || "", user.passwordHash))) {
            return Response.json({ status: false, message: "Invalid admin credentials." }, { status: 401 });
        }

        const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        return Response.json({
            status: true,
            token,
            token_type: "Bearer",
            user: { id: user.id, name: user.name, roles: ["super-admin"], permissions: [] },
            message: "Logged in",
        });
    } catch (error) {
        console.error("Admin login API error:", error);
        return Response.json({ status: false, message: "Unable to log in." }, { status: 500 });
    }
}