import { readSetting } from "@/lib/settings-store.js";

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
