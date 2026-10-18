import prisma from "../directory/prisma/prisma.js";

const DEFAULT_SIZES = [
    { size: "xl", position: 1 },
    { size: "sm", position: 2 },
    { size: "lg", position: 3 },
    { size: "xxl", position: 4 },
    { size: "large", position: 5 },
    { size: "35", position: 6 },
    { size: "36", position: 7 },
    { size: "37", position: 8 },
    { size: "38", position: 9 },
    { size: "39", position: 10 },
    { size: "40", position: 11 },
    { size: "41", position: 12 },
    { size: "42", position: 13 },
    { size: "43", position: 14 },
    { size: "44", position: 15 },
    { size: "45", position: 16 },
    { size: "36-37", position: 17 },
    { size: "38-39", position: 18 },
    { size: "40-41", position: 19 },
    { size: "35-36", position: 20 },
    { size: "37-38", position: 21 },
    { size: "39-40", position: 22 },
    { size: "34", position: 23 },
    { size: "41-42", position: 24 },
    { size: "42-43", position: 25 },
    { size: "44-45", position: 26 },
    { size: "34-35", position: 27 },
    { size: "S", position: 28 },
    { size: "M", position: 29 },
    { size: "L", position: 30 },
    { size: "XL", position: 31 },
    { size: "2XL", position: 32 },
    { size: "One size", position: 33 },
];

async function seedSizes() {
    let count = 0;
    for (const s of DEFAULT_SIZES) {
        await prisma.size.upsert({
            where: { size: s.size },
            update: {},
            create: {
                size: s.size,
                position: s.position,
            },
        });
        count++;
    }
    console.log(`✅ Seeded ${count} sizes successfully!`);
    await prisma.$disconnect();
}

seedSizes().catch((e) => {
    console.error(e);
    process.exit(1);
});