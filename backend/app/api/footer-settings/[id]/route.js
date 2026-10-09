import { authenticateRequest } from "@/directory/auth/auth.js";
import { readSetting, writeSetting } from "@/lib/settings-store.js";

const defaults = {
    id: 1,
    company_description: "",
    company_address: "",
    company_email: "",
    company_phone: "",
    company_logo: null,
    logo_path: null,
};

async function requireAdmin(request) {
    const auth = await authenticateRequest(request);
    return auth.authenticated && auth.user.role === "ADMIN";
}

async function update(request) {
    if (!(await requireAdmin(request))) {
        return Response.json({ message: "Admin authorization required." }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    const current = await readSetting("footer-settings", defaults);
    let fields = {};
    let logo = current.company_logo;

    if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        for (const key of Object.keys(defaults)) {
            const value = form.get(key);
            if (typeof value === "string") fields[key] = value.trim();
        }
        const file = form.get("company_logo");
        if (file && typeof file !== "string") {
            const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
            logo = `data:${file.type};base64,${bytes}`;
        }
    } else {
        fields = await request.json();
    }

    const next = {
        ...current,
        ...fields,
        id: current.id,
        company_logo: logo,
        logo_path: logo,
    };
    await writeSetting("footer-settings", next);
    return Response.json({ message: "Footer settings updated.", data: next });
}

export async function PUT(request) {
    return update(request);
}

export async function POST(request) {
    return update(request);
}
