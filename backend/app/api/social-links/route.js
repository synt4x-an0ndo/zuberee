import { authenticateRequest } from "@/directory/auth/auth.js";
import { readSetting, writeSetting } from "@/lib/settings-store.js";

const defaults = {
    id: 1,
    facebook: "",
    youtube: "",
    instagram: "",
    tweeter: "",
    twitter: "",
    pinterest: "",
    facebook_id: "",
    whatsapp_number: "+880",
};

export async function GET() {
    return Response.json({ data: await readSetting("social-links", defaults) });
}

export async function POST(request) {
    return save(request);
}

async function save(request) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || auth.user.role !== "ADMIN") {
        return Response.json({ message: "Admin authorization required." }, { status: 403 });
    }
    const body = await request.json();
    const current = await readSetting("social-links", defaults);
    const next = { ...current };
    for (const key of Object.keys(defaults)) {
        if (key !== "id" && typeof body[key] === "string") next[key] = body[key].trim();
    }
    await writeSetting("social-links", next);
    return Response.json({ message: "Social links saved.", data: next });
}
