import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

export async function readSetting(name, fallback) {
    try {
        const value = JSON.parse(await readFile(path.join(dataDirectory, `${name}.json`), "utf8"));
        return { ...fallback, ...value };
    } catch (error) {
        if (error?.code !== "ENOENT") console.error(`Failed to read ${name}:`, error);
        return { ...fallback };
    }
}

export async function writeSetting(name, value) {
    await mkdir(dataDirectory, { recursive: true });
    const target = path.join(dataDirectory, `${name}.json`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, target);
    return value;
}

export function isAdmin(request) {
    const authorization = request.headers.get("authorization") || "";
    return authorization.startsWith("Bearer ");
}
