import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import prisma from "../../../../directory/prisma/prisma.js";
import { cookies } from "next/headers";
import {
    mergeGuestCart,
    CART_COOKIE_NAME,
} from "@/lib/cart.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request) {
    try {
        const body = await request.json();

        const { email, password } = body;

        if (!email || !password) {
            return Response.json(
                {
                    success: false,
                    message: "Email and password are required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
        });

        if (!user) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid email or password.",
                    data: null,
                },
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isPasswordValid) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid email or password.",
                    data: null,
                },
                { status: 401 }
            );
        }

        const token = await new SignJWT({
            userId: user.id,
            email: user.email,
            role: user.role,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        const cookieStore = await cookies();
        const sessionId = cookieStore.get(CART_COOKIE_NAME)?.value;

        if (sessionId) {
            await mergeGuestCart(sessionId, user.id);
            cookieStore.delete(CART_COOKIE_NAME);
        }

        return Response.json(
            {
                success: true,
                message: "Login successful.",
                data: {
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    },
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Login API error:", error);

        return Response.json(
            {
                success: false,
                message: "Something went wrong while logging in.",
                data: null,
            },
            { status: 500 }
        );
    }
}