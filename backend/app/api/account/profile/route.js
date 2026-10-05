import bcrypt from "bcryptjs";
import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        addresses: user.addresses || [],
    };
}

export async function GET(request) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
        return Response.json({ success: false, message: auth.message, data: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(auth.user.userId) },
        include: { addresses: { orderBy: { createdAt: "desc" } } },
    });

    if (!user) {
        return Response.json({ success: false, message: "User not found.", data: null }, { status: 404 });
    }

    return Response.json({ success: true, message: "Profile loaded.", data: publicUser(user) });
}

export async function PATCH(request) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
        return Response.json({ success: false, message: auth.message, data: null }, { status: 401 });
    }

    try {
        const body = await request.json();
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const phone = String(body.phone || "").trim() || null;

        if (!name || !email) {
            return Response.json({ success: false, message: "Name and email are required.", data: null }, { status: 400 });
        }

        const duplicate = await prisma.user.findFirst({
            where: { email, NOT: { id: Number(auth.user.userId) } },
        });
        if (duplicate) {
            return Response.json({ success: false, message: "Email is already registered.", data: null }, { status: 409 });
        }

        const data = { name, email, phone };
        if (body.password) {
            if (String(body.password).length < 8) {
                return Response.json({ success: false, message: "Password must be at least 8 characters long.", data: null }, { status: 400 });
            }
            if (body.password !== body.confirmPassword) {
                return Response.json({ success: false, message: "Password and confirm password do not match.", data: null }, { status: 400 });
            }
            data.passwordHash = await bcrypt.hash(body.password, 10);
        }

        const user = await prisma.user.update({
            where: { id: Number(auth.user.userId) },
            data,
            include: { addresses: { orderBy: { createdAt: "desc" } } },
        });

        return Response.json({ success: true, message: "Profile updated.", data: publicUser(user) });
    } catch (error) {
        console.error("Profile API error:", error);
        return Response.json({ success: false, message: "Unable to update profile.", data: null }, { status: 500 });
    }
}