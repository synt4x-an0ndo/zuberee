import { POST as saveSocialLinks } from "../route.js";

export async function PUT(request) {
    return saveSocialLinks(request);
}
