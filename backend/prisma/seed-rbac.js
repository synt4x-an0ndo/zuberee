import prisma from "../directory/prisma/prisma.js";
import 'dotenv/config';

const PERMISSIONS = [
    "view products", "create products", "edit products", "delete products",
    "view orders", "create orders", "edit orders", "delete orders", "download orders", "order show", "incomplete_order",
    "view categories", "create categories", "edit categories", "delete categories",
    "view banners", "create banners", "edit banners", "delete banners",
    "view leaderboard", "view statistics", "view customer details",
    "view users", "create users", "edit users", "delete users",
    "view roles", "create roles", "edit roles", "delete roles", "assign roles",
    "view settings", "edit settings",
    "view dashboard", "view dashboard summary", "update orders", "reOrderImage",
    "view sizes", "create sizes", "edit sizes", "delete sizes",
    "view customers", "edit customers", "manage inventory",
    "view product variants", "create product variants", "edit product variants", "delete product variants",
    "order_status"
];

const ROLES = [
    {
        name: "super-admin",
        permissions: PERMISSIONS,
    },
    {
        name: "admin",
        permissions: [
            "view products", "create products", "edit products", "delete products",
            "view orders", "create orders", "edit orders", "delete orders",
            "view categories", "create categories", "edit categories", "delete categories",
            "view banners", "create banners", "edit banners", "delete banners",
            "view leaderboard", "view statistics", "view customer details",
            "view settings", "edit settings", "view dashboard", "view dashboard summary",
            "view customers", "edit customers", "manage inventory", "order_status"
        ],
    },
    {
        name: "user",
        permissions: [],
    },
    {
        name: "order manager",
        permissions: [
            "view orders", "create orders", "edit orders", "incomplete_order",
            "view dashboard", "view dashboard summary"
        ],
    },
];

async function seed() {
    for (const permName of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { name: permName },
            update: {},
            create: { name: permName, guardName: "sanctum" },
        });
    }
    console.log(`✅ Seeded ${PERMISSIONS.length} permissions`);

    for (const role of ROLES) {
        const created = await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: { name: role.name, guardName: "sanctum" },
        });

        for (const permName of role.permissions) {
            const perm = await prisma.permission.findUnique({
                where: { name: permName },
            });
            if (perm) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: created.id,
                            permissionId: perm.id,
                        },
                    },
                    update: {},
                    create: {
                        roleId: created.id,
                        permissionId: perm.id,
                    },
                });
            }
        }
    }
    console.log(`✅ Seeded ${ROLES.length} roles`);
    await prisma.$disconnect();
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
});