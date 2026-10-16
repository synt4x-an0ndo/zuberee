import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

/**
 * POST /api/chat/ai   (signed-in customers)
 *
 * AI shopping assistant powered by Google Gemini. Stateless by design
 * (no chat log): the widget sends the last few messages as `history`
 * with every request and nothing is stored server-side.
 *
 * Body: { message, history?: [{ role: "user" | "assistant", text }] }
 *   -> { success, data: { reply, products: [{ id, name, price, salePrice,
 *        image, sizes, colors, url }] } }
 *
 * The Gemini API key is set by the admin in Settings (site-settings
 * `geminiApiKey` column). It is read here, on the server only, and is
 * never returned by any public endpoint. Without a key this route
 * answers 503 so the widget can say the assistant is not configured.
 *
 * "Knowing the store": every request searches the live catalogue with
 * the customer's words (product names, descriptions, categories, colour
 * names and size values, plus an optional price ceiling like "under
 * 1000"), and the best matches — with prices, sizes and per-size stock —
 * are given to Gemini as the only source of product facts.
 */

// Cost policy (store owner's choice): run on the CHEAPEST Gemini model
// that works. The Flash-Lite tier is Google's cheapest; gemini-3.5-flash-lite
// is the cheapest model this API key can actually call (verified live —
// Google's own 404 for the retired gemini-2.5-flash-lite recommends it).
// Google also retires/overloads models without notice, so if the Lite
// models are unavailable the chain falls back to the full Flash models
// for that request rather than failing the chat. The chain is walked in
// order on every request, so the assistant always prefers the cheapest.
const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
];

async function callGemini(apiKey, payload) {
    const order = GEMINI_MODELS;
    let lastStatus = 0;
    let lastDetail = "";
    // Google's lite tier throws short bursts of 429/503 under demand; one
    // full retry pass after a brief pause recovers most of those without
    // slowing down the happy path.
    for (let pass = 0; pass < 2; pass++) {
        if (pass > 0) await new Promise((r) => setTimeout(r, 1600));
        const result = await callGeminiPass(apiKey, payload, order);
        if (result.ok) return result;
        lastStatus = result.status;
        lastDetail = result.detail;
        if (![0, 429, 500, 502, 503].includes(result.status)) break;
    }
    return { ok: false, status: lastStatus, detail: lastDetail };
}

async function callGeminiPass(apiKey, payload, order) {
    let lastStatus = 0;
    let lastDetail = "";
    for (const model of order) {
        let res;
        try {
            res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey,
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(30000),
                }
            );
        } catch (err) {
            console.error(`Gemini fetch failed for ${model}:`, err.message);
            lastStatus = 0;
            lastDetail = err.message;
            continue;
        }
        if (res.ok) {
            return { ok: true, data: await res.json() };
        }
        lastStatus = res.status;
        lastDetail = await res.text().catch(() => "");
        console.error(`Gemini API error (${model}):`, res.status, lastDetail.slice(0, 300));
        // Only model-availability / transient failures move to the next
        // candidate; a bad key etc. would fail on every model anyway.
        if (![404, 429, 500, 502, 503].includes(res.status)) break;
    }
    return { ok: false, status: lastStatus, detail: lastDetail };
}
const MAX_HISTORY = 8;

const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "for", "me", "i", "want", "need", "show",
    "find", "get", "please", "plz", "do", "you", "have", "any", "some", "in",
    "on", "of", "to", "is", "are", "there", "what", "which", "can", "could",
    "would", "looking", "look", "search", "give", "tell", "about", "with",
    "without", "that", "this", "it", "my", "your", "price", "cost", "much",
    "how", "when", "will", "available", "availability", "stock", "buy", "here",
    "order", "product", "products", "item", "items", "something", "anything",
]);

function searchTokens(texts) {
    const tokens = [];
    for (const text of texts) {
        for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9\u0980-\u09FF]+/i)) {
            const token = raw.trim();
            if (token.length < 2 || STOPWORDS.has(token)) continue;
            if (!tokens.includes(token)) tokens.push(token);
            // Naive singular ("bags" -> "bag") so plurals still match
            // product names/descriptions written in the singular.
            if (token.length > 3 && token.endsWith("s")) {
                const singular = token.slice(0, -1);
                if (!tokens.includes(singular)) tokens.push(singular);
            }
            if (tokens.length >= 8) return tokens;
        }
    }
    return tokens;
}

function priceCeiling(text) {
    const match = String(text || "").match(
        /(?:under|below|less than|max|within|budget(?:\s*of)?)\s*(?:৳|tk\.?|bdt)?\s*(\d{2,7})/i
    );
    return match ? Number(match[1]) : null;
}

function saleOf(product) {
    const price = Number(product.price);
    const discount = product.discount === null ? null : Number(product.discount);
    return discount !== null && discount > 0 && discount < price ? discount : price;
}

// --- Catalogue matching -------------------------------------------------
// Customers type "backpack"; this catalogue's category is spelled
// "BagPack". Plain substring search can never bridge that, so matching
// is done in memory: exact substrings score highest, then word-level
// fuzzy matches (small edit distance, camelCase-split words like
// BagPack -> bag + pack), plus a small synonym table for the spellings
// shoppers actually use. The pool is the newest 300 active products,
// which suits this catalogue; scoring keeps the best few.

const SYNONYMS = {
    backpack: ["bagpack", "bag"],
    bagpack: ["backpack", "bag"],
    panjabi: ["punjabi"],
    punjabi: ["panjabi"],
    tshirt: ["t-shirt", "tee", "shirt"],
    "t-shirt": ["tshirt", "tee", "shirt"],
    tee: ["tshirt", "t-shirt", "shirt"],
    sneakers: ["shoes", "shoe", "sneaker"],
    sneaker: ["shoes", "shoe", "sneakers"],
    shoes: ["sneakers", "sneaker", "shoe"],
    kurta: ["kurti"],
    kurti: ["kurta"],
    wallet: ["purse"],
    purse: ["wallet", "bag"],
    sunglasses: ["sunglass", "glasses"],
    sunglass: ["sunglasses", "glasses"],
};

function wordsOf(text) {
    return String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9\u0980-\u09FF]+/i)
        .filter(Boolean);
}

function camelWords(text) {
    const spaced = String(text || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    return [...new Set([String(text || "").toLowerCase(), ...wordsOf(spaced)])];
}

function levenshtein(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cur = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = cur;
        }
    }
    return row[b.length];
}

// 1 = identical, ~0.8 = one contains the other, ~0.65 = small typo
// distance, 0 = unrelated.
function fuzzyScore(term, word) {
    if (!term || !word) return 0;
    if (term === word) return 1;
    if (term.length >= 3 && word.length >= 3 && (term.includes(word) || word.includes(term))) return 0.8;
    const limit = Math.max(term.length, word.length) >= 6 ? 2 : 1;
    return levenshtein(term, word) <= limit ? 0.65 : 0;
}

async function searchProducts(tokens, ceiling) {
    const terms = [...new Set(tokens.flatMap((t) => [t, ...(SYNONYMS[t] || [])]))];

    const found = await prisma.product.findMany({
        where: { isActive: true },
        include: {
            category: { select: { name: true, slug: true } },
            images: { take: 1, orderBy: { id: "asc" }, select: { imageUrl: true } },
            colors: { select: { id: true, name: true } },
            variants: {
                where: { isActive: true },
                select: { value: true, price: true, stock: true, colorId: true },
                orderBy: { position: "asc" },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
    });

    const scored = found
        .map((product) => {
            const colorName = new Map(product.colors.map((c) => [c.id, c.name]));
            const sizes = product.variants.map((v) => ({
                size: v.value,
                price: v.price === null ? Number(product.price) : Number(v.price),
                stock: v.stock,
                color: v.colorId ? colorName.get(v.colorId) || null : null,
            }));
            const entry = {
                id: product.id,
                name: product.name,
                price: Number(product.price),
                salePrice: saleOf(product),
                status: product.status.toLowerCase().replace("_", "-"),
                category: product.category?.name || null,
                description: (product.shortDescription || product.description || "").slice(0, 240),
                image: product.images[0]?.imageUrl || null,
                colors: product.colors.map((c) => c.name),
                sizes,
                totalStock: sizes.reduce((sum, s) => sum + (s.stock || 0), 0),
            };

            const nameText = product.name.toLowerCase();
            const catText = (product.category?.name || "").toLowerCase();
            const descText = `${product.shortDescription || ""} ${product.description || ""}`.toLowerCase();
            const nameWords = camelWords(product.name);
            const catWords = camelWords(product.category?.name || "");
            const colorWords = entry.colors.flatMap((c) => camelWords(c));
            const sizeWords = entry.sizes.map((s) => s.size.toLowerCase());

            let score = 0;
            let best = 0;
            for (const term of terms) {
                let s = 0;
                if (nameText.includes(term)) s += 3;
                else s += 2.5 * Math.max(0, ...nameWords.map((w) => fuzzyScore(term, w)));
                if (catText.includes(term)) s += 2;
                else s += 2 * Math.max(0, ...catWords.map((w) => fuzzyScore(term, w)));
                if (entry.colors.some((c) => c.toLowerCase().includes(term))) s += 3;
                else s += 2.5 * Math.max(0, ...colorWords.map((w) => fuzzyScore(term, w)));
                if (sizeWords.some((v) => v === term)) s += 3;
                else s += 1.5 * Math.max(0, ...sizeWords.map((w) => fuzzyScore(term, w)));
                if (descText.includes(term)) s += 1;
                score += s;
                if (s > best) best = s;
            }
            return { entry, score, best };
        })
        // A product needs at least one real (exact or fuzzy) hit — this
        // keeps unrelated items out when the customer asked for something
        // specific. With no keywords at all (greetings), everything
        // passes and the newest items are offered.
        .filter(({ best }) => terms.length === 0 || best >= 1.3)
        .filter(({ entry }) => ceiling === null || entry.salePrice <= ceiling)
        .sort((a, b) => b.score - a.score);

    return scored.map(({ entry }) => entry);
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json(
                { success: false, message: "Please sign in to chat." },
                { status: 401 }
            );
        }

        let body = {};
        try {
            body = await request.json();
        } catch {
            /* validated below */
        }
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) {
            return Response.json(
                { success: false, message: "Message cannot be empty." },
                { status: 400 }
            );
        }
        if (message.length > 1000) {
            return Response.json(
                { success: false, message: "Message is too long (max 1000 characters)." },
                { status: 400 }
            );
        }
        const history = Array.isArray(body.history)
            ? body.history
                  .filter((h) => h && typeof h.text === "string" && (h.role === "user" || h.role === "assistant"))
                  .slice(-MAX_HISTORY)
                  .map((h) => ({ role: h.role, text: h.text.slice(0, 1000) }))
            : [];

        const settings = await prisma.siteSettings.findFirst({
            orderBy: { createdAt: "asc" },
            select: { siteName: true, geminiApiKey: true },
        });
        const apiKey = (settings?.geminiApiKey || "").trim();
        if (!apiKey) {
            return Response.json(
                {
                    success: false,
                    code: "AI_NOT_CONFIGURED",
                    message: "The AI assistant is not configured yet. Please chat with the admin instead.",
                },
                { status: 503 }
            );
        }
        const storeName = (settings?.siteName || "").trim() || "our store";

        const [categories, footer] = await Promise.all([
            prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
            prisma.footerSettings.findFirst({
                orderBy: { createdAt: "asc" },
                select: { companyEmail: true, companyPhone: true, companyAddress: true },
            }),
        ]);

        const recentUserTexts = [
            message,
            ...history.filter((h) => h.role === "user").slice(-2).map((h) => h.text),
        ];
        const tokens = searchTokens(recentUserTexts);
        const ceiling = priceCeiling(message);
        let products = await searchProducts(tokens, ceiling);
        if (products.length === 0 && tokens.length === 0) {
            // Greetings / "show me products": offer the newest items.
            products = await searchProducts([], null);
        }
        const contextProducts = products.slice(0, 6);
        const cardProducts = products.slice(0, 4).map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            salePrice: p.salePrice,
            image: p.image,
            colors: p.colors,
            sizes: p.sizes.map((s) => s.size),
            url: `/product-page/${p.id}`,
        }));

        const systemInstruction = [
            `You are the friendly shopping assistant for ${storeName}, an online store in Bangladesh. Currency is Bangladeshi taka (৳).`,
            "Reply in the same language the customer writes in (English, Bangla, or a mix). Keep answers short, warm and helpful — a few sentences, or a short list when comparing products.",
            "For anything about products, prices, sizes, colours or stock, use ONLY the catalogue data given in the customer's message. Never invent a product, price, size, colour or stock level. If the catalogue data is empty or does not match, say you could not find a match and suggest browsing the categories instead.",
            "When you recommend a product, mention its name, its price (the sale price when one is given), and the sizes/colours actually available. Sizes listed with stock 0 are unavailable — do not offer them. Format with simple markdown only: **bold** for product names and prices, and short bullet lists. Never use tables.",
            "For orders, delivery, returns or account problems you cannot solve, invite the customer to use the \"Chat with Admin\" option in this same chat window.",
            `Store categories: ${categories.map((c) => c.name).join(", ") || "—"}.`,
            footer?.companyPhone || footer?.companyEmail
                ? `Store contact: ${[footer.companyPhone, footer.companyEmail, footer.companyAddress].filter(Boolean).join(" · ")}.`
                : "",
        ]
            .filter(Boolean)
            .join("\n");

        const contents = [
            ...history.map((h) => ({
                role: h.role === "assistant" ? "model" : "user",
                parts: [{ text: h.text }],
            })),
            {
                role: "user",
                parts: [
                    {
                        text:
                            `[Catalogue search results for this question — the only product facts you may use]\n` +
                            (contextProducts.length
                                ? JSON.stringify(contextProducts, null, 1)
                                : "(no matching products found)") +
                            `\n\nCustomer question: ${message}`,
                    },
                ],
            },
        ];

        const geminiResult = await callGemini(apiKey, {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        });

        if (!geminiResult.ok) {
            return Response.json(
                {
                    success: false,
                    message:
                        geminiResult.status === 400 || geminiResult.status === 403
                            ? "The AI assistant could not accept the configured Gemini API key. Please ask the admin to check it in Settings."
                            : geminiResult.status === 429 || geminiResult.status === 503
                              ? "The AI assistant is busy right now (high demand at Google). Please wait a minute and try again, or chat with the admin."
                              : "The AI assistant is unavailable right now. Please try again or chat with the admin.",
                },
                { status: 502 }
            );
        }

        const geminiData = geminiResult.data;
        const reply = (geminiData?.candidates?.[0]?.content?.parts || [])
            .map((part) => part?.text || "")
            .join("")
            .trim();

        // If the assistant says nothing matched, don't contradict it by
        // attaching unrelated product cards underneath.
        const saidNoMatch = /couldn'?t find|could not find|no matching|no products|not find any/i.test(reply);
        const mentioned = cardProducts.filter((p) =>
            reply.toLowerCase().includes(p.name.toLowerCase())
        );
        return Response.json({
            success: true,
            data: {
                reply:
                    reply ||
                    "Sorry, I could not come up with an answer just now. Please try rephrasing, or chat with the admin.",
                products: saidNoMatch ? mentioned : cardProducts,
            },
        });
    } catch (error) {
        console.error("POST /api/chat/ai error:", error);
        return Response.json(
            { success: false, message: "The AI assistant is unavailable right now. Please try again or chat with the admin." },
            { status: 500 }
        );
    }
}
