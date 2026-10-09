import { authenticateRequest } from "@/directory/auth/auth.js";
import { readSetting, writeSetting } from "@/lib/settings-store.js";

const defaults = {
    id: 1,
    site_name: "",
    primary_color: "#ff641f",
    inventory_enforcement_enabled: false,
};

async function requireAdmin(request) {
    const auth = await authenticateRequest(request);
    return auth.authenticated && auth.user.role === "ADMIN";
}

export async function GET() {
    return Response.json({ data: await readSetting("site-settings", defaults) });
}

export async function PUT(request) {
    if (!(await requireAdmin(request))) {
        return Response.json({ message: "Admin authorization required." }, { status: 403 });
    }

    const body = await request.json();
    const current = await readSetting("site-settings", defaults);
    const next = {
        ...current,
        ...(typeof body.site_name === "string" ? { site_name: body.site_name.trim() } : {}),
        ...(typeof body.primary_color === "string" ? { primary_color: body.primary_color.trim() } : {}),
        ...(typeof body.inventory_enforcement_enabled === "boolean"
            ? { inventory_enforcement_enabled: body.inventory_enforcement_enabled }
            : {}),
    };
    await writeSetting("site-settings", next);
    return Response.json({ message: "Site settings updated.", data: next });
}
