import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import prisma from "../../../../directory/prisma/prisma.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
export async function POST(request) {
    try {
        const body = await request.json();

        const {
            name,
            email,
            password,
            confirmPassword,
        } = body;

        // Validate required fields
        if (!name || !email || !password || !confirmPassword) {
            return Response.json(
                {
                    success: false,
                    message: "Name, email, password and confirm password are required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // Validate password confirmation
        if (password !== confirmPassword) {
            return Response.json(
                {
                    success: false,
                    message: "Password and confirm password do not match.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 8) {
            return Response.json(
                {
                    success: false,
                    message: "Password must be at least 8 characters long.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check whether email already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
        });

        if (existingUser) {
            return Response.json(
                {
                    success: false,
                    message: "Email is already registered.",
                    data: null,
                },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        const token = await new SignJWT({
            userId: user.id,
            email: user.email,
            role: user.role,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        return Response.json(
            {
                success: true,
                message: "User registered successfully.",
                data: { token, user },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Register API error:", error);

        return Response.json(
            {
                success: false,
                message: "Something went wrong while registering the user.",
                data: null,
            },
            { status: 500 }
        );
    }
}