import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../directory/prisma/prisma.js";

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || !email || !password) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
}

if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long");
}

const passwordHash = await bcrypt.hash(password, 10);
const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN" },
    create: { name, email, passwordHash, role: "ADMIN" },
    select: { id: true, name: true, email: true, role: true },
});

console.log(`Admin account ready: ${admin.email} (${admin.role})`);
await prisma.$disconnect();