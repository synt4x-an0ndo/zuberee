import { createHash } from "node:crypto";

const DEFAULT_MODELS = {
    gemini: [
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
    ],
    groq: [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        // Kept last for enterprise accounts that still have access;
        // Groq retired these IDs for free/developer usage in Aug 2026.
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
    ],
    openai: [
        "gpt-6-luna",
        "gpt-5.6-luna",
        "gpt-5.4-nano",
        "gpt-5-mini",
        "gpt-4o-mini",
    ],
    xai: ["grok-4.3", "grok-4.7", "grok-4.6", "grok-3-mini"],
    openrouter: ["openrouter/auto"],
    anthropic: ["claude-haiku-5-5", "claude-haiku-4-5", "claude-sonnet-5-5"],
    deepseek: ["deepseek-flash", "deepseek-v4-pro"],
    custom: [],
    unknown: [],
};

const DEFAULT_BASE_URLS = {
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    groq: "https://api.groq.com/openai/v1",
    openai: "https://api.openai.com/v1",
    xai: "https://api.x.ai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    anthropic: "https://api.anthropic.com/v1",
};

const MODEL_DISCOVERY_SUCCESS_TTL_MS = 10 * 60 * 1000;
const MODEL_DISCOVERY_FAILURE_TTL_MS = 30 * 1000;
const modelDiscoveryCache = new Map();

function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizeAiBaseUrl(value) {
    const raw = cleanString(value);
    if (!raw) return "";

    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("Enter a valid API URL, including https://.");
    }

    const localhost = ["localhost", "127.0.0.1", "::1"].includes(
        url.hostname.toLowerCase()
    );
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
        throw new Error("The API URL must use HTTPS.");
    }

    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
}

export function normalizeAiModel(value) {
    const model = cleanString(value);
    if (!model) return "";
    if (model.length > 180 || /[\s\u0000-\u001f\u007f]/.test(model)) {
        throw new Error("Enter a valid model name without spaces.");
    }
    return model;
}

function parseBaseUrl(baseUrl) {
    if (!baseUrl) return null;
    try {
        return new URL(baseUrl);
    } catch {
        return null;
    }
}

function detectProviderFromKey(apiKey) {
    if (apiKey.startsWith("gsk_")) return "groq";
    if (apiKey.startsWith("xai-")) return "xai";
    if (apiKey.startsWith("sk-or-v1-")) return "openrouter";
    if (apiKey.startsWith("sk-ant-")) return "anthropic";
    if (
        apiKey.startsWith("sk-proj-") ||
        apiKey.startsWith("sk-svcacct-") ||
        apiKey.startsWith("sk-")
    ) {
        return "openai";
    }
    if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) return "gemini";
    return "unknown";
}

function endpointFromBase(baseUrl, suffix, rootSuffix = suffix) {
    const parsed = parseBaseUrl(baseUrl);
    if (!parsed) return baseUrl;
    const path = parsed.pathname.replace(/\/+$/, "");
    if (path.endsWith(suffix)) return baseUrl;
    if (!path || path === "/") return `${baseUrl}${rootSuffix}`;
    return `${baseUrl}${suffix}`;
}

function resolveAiConfig(apiKey, options = {}) {
    const key = cleanString(apiKey);
    const rawBaseUrl = cleanString(options.baseUrl);
    const modelOverride = cleanString(options.model);
    let baseUrl = "";

    try {
        baseUrl = normalizeAiBaseUrl(rawBaseUrl);
        normalizeAiModel(modelOverride);
    } catch (error) {
        return {
            provider: "unknown",
            protocol: "unknown",
            apiKey: key,
            models: [],
            status: 422,
            detail: error.message,
        };
    }

    const parsed = parseBaseUrl(baseUrl);
    const host = parsed?.hostname?.toLowerCase() || "";
    const path = (parsed?.pathname || "").replace(/\/+$/, "").toLowerCase();
    let provider = detectProviderFromKey(key);
    let protocol = "";

    if (host.includes("api.groq.com")) provider = "groq";
    else if (host.includes("api.openai.com")) provider = "openai";
    else if (host.includes("api.x.ai")) provider = "xai";
    else if (host.includes("openrouter.ai")) provider = "openrouter";
    else if (host.includes("api.anthropic.com")) provider = "anthropic";
    else if (host.includes("generativelanguage.googleapis.com")) provider = "gemini";
    else if (host.includes("api.deepseek.com")) provider = "deepseek";
    else if (baseUrl) provider = "custom";

    if (path.endsWith("/chat/completions")) protocol = "chat";
    else if (path.endsWith("/responses")) protocol = "responses";
    else if (path.endsWith("/messages")) protocol = "anthropic";
    else if (provider === "gemini") {
        protocol = path.includes("/openai") ? "chat" : "gemini";
    } else if (provider === "anthropic") protocol = "anthropic";
    else if (provider === "openai" || provider === "xai") protocol = "responses";
    else if (["groq", "openrouter", "deepseek", "custom"].includes(provider)) {
        protocol = path.includes("/anthropic") ? "anthropic" : "chat";
    }

    const effectiveBaseUrl = baseUrl || DEFAULT_BASE_URLS[provider] || "";
    const modelDefaults =
        provider === "deepseek"
            ? DEFAULT_MODELS.deepseek
            : DEFAULT_MODELS[provider] || [];
    const models = modelOverride ? [modelOverride] : [...modelDefaults];

    let endpoint = "";
    let geminiBaseUrl = "";
    if (protocol === "chat") {
        endpoint = endpointFromBase(effectiveBaseUrl, "/chat/completions");
    } else if (protocol === "responses") {
        endpoint = endpointFromBase(
            effectiveBaseUrl,
            "/responses",
            "/v1/responses"
        );
    } else if (protocol === "anthropic") {
        endpoint = endpointFromBase(
            effectiveBaseUrl,
            "/messages",
            "/v1/messages"
        );
        if (
            endpoint.endsWith("/anthropic/messages") &&
            !endpoint.endsWith("/v1/messages")
        ) {
            endpoint = endpoint.replace(
                "/anthropic/messages",
                "/anthropic/v1/messages"
            );
        }
    } else if (protocol === "gemini") {
        geminiBaseUrl = effectiveBaseUrl.includes("generativelanguage.googleapis.com")
            ? effectiveBaseUrl
            : DEFAULT_BASE_URLS.gemini;
        if (!geminiBaseUrl.endsWith("/v1beta")) {
            geminiBaseUrl = `${geminiBaseUrl.replace(/\/v1$/, "")}/v1beta`;
        }
    }

    const discoverModels =
        !modelOverride &&
        protocol === "chat" &&
        ["groq", "deepseek", "custom"].includes(provider);

    let status = 0;
    let detail = "";
    if (!key) {
        status = 422;
        detail = "No API key is configured.";
    } else if (provider === "unknown") {
        status = 422;
        detail = "Add an API URL and model for this API key.";
    } else if (!models.length && !discoverModels) {
        status = 422;
        detail = "Add a model for this API URL.";
    } else if (!protocol || (!endpoint && protocol !== "gemini")) {
        status = 422;
        detail = "The API configuration is incomplete.";
    }

    return {
        provider,
        protocol,
        apiKey: key,
        baseUrl: effectiveBaseUrl,
        endpoint,
        geminiBaseUrl,
        models,
        modelOverride: Boolean(modelOverride),
        discoverModels,
        status,
        detail,
    };
}

export function detectAiProvider(apiKey, options = {}) {
    return resolveAiConfig(apiKey, options).provider;
}

function contentToText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content.map(contentToText).filter(Boolean).join("\n");
    }
    if (content && typeof content === "object") {
        return cleanString(
            content.text || content.output_text || content.content || ""
        );
    }
    return "";
}

function normalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
        .map((message) => {
            const rawRole = cleanString(message?.role).toLowerCase();
            const role =
                rawRole === "model"
                    ? "assistant"
                    : ["system", "user", "assistant"].includes(rawRole)
                      ? rawRole
                      : "user";
            const content = contentToText(
                message?.content ?? message?.text ?? ""
            ).trim();
            return { role, content };
        })
        .filter((message) => message.content);
}

function splitMessages(messages) {
    const normalized = normalizeMessages(messages);
    const system = normalized
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n")
        .trim();
    const conversation = normalized.filter(
        (message) => message.role !== "system"
    );
    return {
        system,
        conversation:
            conversation.length > 0
                ? conversation
                : [{ role: "user", content: "Hello" }],
        chatMessages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...conversation,
        ],
    };
}

function providerErrorDetail(data, rawText) {
    const detail =
        data?.error?.message ||
        data?.error?.error?.message ||
        data?.message ||
        data?.detail ||
        rawText ||
        "";
    return String(detail).slice(0, 500);
}

async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            cache: "no-store",
        });
        const rawText = await response.text();
        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            data = null;
        }
        return {
            ok: response.ok,
            status: response.status,
            data,
            detail: providerErrorDetail(data, rawText),
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: null,
            detail: error?.name === "AbortError" ? "timeout" : "network",
        };
    } finally {
        clearTimeout(timer);
    }
}

function modelsEndpointFromChatEndpoint(endpoint) {
    return endpoint.endsWith("/chat/completions")
        ? `${endpoint.slice(0, -"/chat/completions".length)}/models`
        : "";
}

function isLikelyChatModel(modelId) {
    const id = cleanString(modelId).toLowerCase();
    if (!id) return false;
    return ![
        "whisper",
        "orpheus",
        "prompt-guard",
        "safeguard",
        "guard",
        "embedding",
        "embed",
        "rerank",
        "audio",
        "speech",
        "transcri",
        "tts",
        "stt",
        "image",
        "vision-only",
        "moderation",
    ].some((term) => id.includes(term));
}

function extractDiscoveredModelIds(data) {
    const entries = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
          ? data.models
          : [];
    const ids = [];
    for (const entry of entries) {
        if (entry?.active === false) continue;
        const id = cleanString(entry?.id || entry?.model || entry?.name).replace(
            /^models\//,
            ""
        );
        if (isLikelyChatModel(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
}

function sortDiscoveredModels(ids, preferredModels) {
    const preferredRank = new Map(
        preferredModels.map((model, index) => [model, index])
    );
    const economyRank = (model) => {
        const id = model.toLowerCase();
        if (/(flash|mini|nano|haiku|small|lite|instant)/.test(id)) return 0;
        if (/(^|[-/])(7b|8b|20b|27b|32b)([-/]|$)/.test(id)) return 1;
        return 2;
    };
    return [...ids]
        .sort((a, b) => {
            const aPreferred = preferredRank.has(a)
                ? preferredRank.get(a)
                : Number.MAX_SAFE_INTEGER;
            const bPreferred = preferredRank.has(b)
                ? preferredRank.get(b)
                : Number.MAX_SAFE_INTEGER;
            if (aPreferred !== bPreferred) return aPreferred - bPreferred;
            return economyRank(a) - economyRank(b);
        })
        .slice(0, 5);
}

async function discoverChatModels(config, args) {
    const url = modelsEndpointFromChatEndpoint(config.endpoint);
    if (!url) return { models: [], status: 422, detail: "No models endpoint." };

    const keyFingerprint = createHash("sha256")
        .update(config.apiKey)
        .digest("hex")
        .slice(0, 16);
    const cacheKey = `${config.provider}:${url}:${keyFingerprint}`;
    const cached = modelDiscoveryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const result = await fetchJson(
        url,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
        },
        Math.min(args.timeoutMs, 15000)
    );

    const value = result.ok
        ? {
              models: sortDiscoveredModels(
                  extractDiscoveredModelIds(result.data),
                  config.models
              ),
              status: result.status,
              detail: "",
          }
        : { models: [], status: result.status, detail: result.detail };

    modelDiscoveryCache.set(cacheKey, {
        value,
        expiresAt:
            Date.now() +
            (value.models.length
                ? MODEL_DISCOVERY_SUCCESS_TTL_MS
                : MODEL_DISCOVERY_FAILURE_TTL_MS),
    });
    return value;
}

function extractChatText(data) {
    return contentToText(data?.choices?.[0]?.message?.content).trim();
}

function extractResponsesText(data) {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
        return data.output_text.trim();
    }
    const parts = [];
    for (const item of Array.isArray(data?.output) ? data.output : []) {
        for (const content of Array.isArray(item?.content) ? item.content : []) {
            if (
                content?.type === "output_text" ||
                content?.type === "text" ||
                typeof content?.text === "string"
            ) {
                const text = contentToText(content).trim();
                if (text) parts.push(text);
            }
        }
        if (typeof item?.text === "string" && item.text.trim()) {
            parts.push(item.text.trim());
        }
    }
    return parts.join("\n").trim();
}

function extractAnthropicText(data) {
    return (Array.isArray(data?.content) ? data.content : [])
        .filter((part) => part?.type === "text" || typeof part?.text === "string")
        .map((part) => contentToText(part))
        .filter(Boolean)
        .join("\n")
        .trim();
}

function extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return "";
    return parts
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
}

async function callChatCompletions(config, model, args) {
    const { chatMessages } = splitMessages(args.messages);
    const tokenField =
        config.provider === "groq"
            ? "max_completion_tokens"
            : "max_tokens";
    const body = {
        model,
        messages: chatMessages,
        temperature: args.temperature,
        [tokenField]: args.maxOutputTokens,
    };
    if (
        config.provider === "groq" &&
        (model.startsWith("openai/gpt-oss") || model === "qwen/qwen3.8-27b")
    ) {
        // Shopping/size answers do not need long reasoning; low effort also
        // leaves enough completion tokens for the visible answer.
        body.reasoning_effort = "low";
    }
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.provider === "openrouter") {
        headers["X-OpenRouter-Title"] = "Zuberee";
        headers["X-Title"] = "Zuberee";
    }
    const result = await fetchJson(
        config.endpoint,
        { method: "POST", headers, body: JSON.stringify(body) },
        args.timeoutMs
    );
    return { ...result, text: result.ok ? extractChatText(result.data) : "" };
}

async function callResponses(config, model, args) {
    const { system, conversation } = splitMessages(args.messages);
    const body = {
        model,
        instructions: system || undefined,
        input: conversation,
        max_output_tokens: args.maxOutputTokens,
        store: false,
    };
    if (config.provider === "xai") {
        body.reasoning = { effort: "low" };
    }
    const result = await fetchJson(
        config.endpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
        },
        args.timeoutMs
    );
    return {
        ...result,
        text: result.ok ? extractResponsesText(result.data) : "",
    };
}

async function callAnthropic(config, model, args) {
    const { system, conversation } = splitMessages(args.messages);
    const messages = [...conversation];
    while (messages.length > 1 && messages[0].role === "assistant") {
        messages.shift();
    }
    if (messages[0]?.role === "assistant") {
        messages[0] = { role: "user", content: messages[0].content };
    }
    const headers = {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
    };
    if (config.provider === "custom" || config.provider === "deepseek") {
        headers.Authorization = `Bearer ${config.apiKey}`;
    }
    const result = await fetchJson(
        config.endpoint,
        {
            method: "POST",
            headers,
            body: JSON.stringify({
                model,
                system: system || undefined,
                messages,
                temperature: args.temperature,
                max_tokens: args.maxOutputTokens,
            }),
        },
        args.timeoutMs
    );
    return {
        ...result,
        text: result.ok ? extractAnthropicText(result.data) : "",
    };
}

async function callGemini(config, model, args) {
    const { system, conversation } = splitMessages(args.messages);
    const url = `${config.geminiBaseUrl}/models/${encodeURIComponent(
        model
    )}:generateContent`;
    const body = {
        contents: conversation.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        })),
        generationConfig: {
            temperature: args.temperature,
            maxOutputTokens: args.maxOutputTokens,
            topP: 0.9,
        },
        safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
        ].map((category) => ({
            category,
            threshold: "BLOCK_ONLY_HIGH",
        })),
    };
    if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
    }
    const result = await fetchJson(
        url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": config.apiKey,
            },
            body: JSON.stringify(body),
        },
        args.timeoutMs
    );
    let text = result.ok ? extractGeminiText(result.data) : "";
    if (result.ok && !text) {
        const blockReason = result.data?.promptFeedback?.blockReason;
        const finishReason = result.data?.candidates?.[0]?.finishReason;
        return {
            ...result,
            ok: false,
            status: blockReason ? 422 : 502,
            detail: blockReason || finishReason || "empty",
            text: "",
        };
    }
    return { ...result, text };
}

async function callModel(config, model, args) {
    if (config.protocol === "gemini") return callGemini(config, model, args);
    if (config.protocol === "responses") {
        return callResponses(config, model, args);
    }
    if (config.protocol === "anthropic") {
        return callAnthropic(config, model, args);
    }
    return callChatCompletions(config, model, args);
}

async function runModelPass(config, args) {
    let last = {
        ok: false,
        status: config.status || 502,
        detail: config.detail || "empty",
        text: "",
        model: "",
    };

    for (const model of config.models) {
        const result = await callModel(config, model, args);
        const text = cleanString(result.text);
        if (result.ok && text) {
            return {
                ok: true,
                status: result.status,
                detail: "",
                text,
                model,
            };
        }

        last = {
            ok: false,
            status: result.ok ? 502 : result.status,
            detail: result.detail || "empty",
            text: "",
            model,
        };

        if ([401, 402].includes(result.status)) break;
    }

    return last;
}

function isTransientStatus(status) {
    return status === 0 || status === 429 || status >= 500;
}

export async function generateAiText({
    apiKey,
    baseUrl = "",
    model = "",
    messages = [],
    temperature = 0.4,
    maxOutputTokens = 800,
    timeoutMs = 60000,
    retryTransient = true,
} = {}) {
    const config = resolveAiConfig(apiKey, { baseUrl, model });
    if (config.status) {
        return {
            ok: false,
            provider: config.provider,
            model: cleanString(model),
            status: config.status,
            detail: config.detail,
            text: "",
        };
    }

    const args = {
        messages,
        temperature: Number.isFinite(Number(temperature))
            ? Number(temperature)
            : 0.4,
        maxOutputTokens: Math.max(
            16,
            Math.min(4000, Number(maxOutputTokens) || 800)
        ),
        timeoutMs: Math.max(
            5000,
            Math.min(90000, Number(timeoutMs) || 60000)
        ),
    };

    let effectiveConfig = config;
    if (config.discoverModels) {
        const discovery = await discoverChatModels(config, args);
        if (discovery.models.length) {
            effectiveConfig = { ...config, models: discovery.models };
        } else if (!config.models.length) {
            return {
                ok: false,
                provider: config.provider,
                model: "",
                status: discovery.status || 422,
                detail:
                    discovery.detail ||
                    "Add a model for this API URL.",
                text: "",
            };
        }
    }

    const first = await runModelPass(effectiveConfig, args);
    if (first.ok || !retryTransient || !isTransientStatus(first.status)) {
        return { ...first, provider: config.provider };
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const second = await runModelPass(effectiveConfig, args);
    return { ...second, provider: config.provider };
}

export async function testAiApiKey(apiKey, options = {}) {
    return generateAiText({
        apiKey,
        baseUrl: options.baseUrl || "",
        model: options.model || "",
        messages: [
            {
                role: "system",
                content: "You are checking an API connection. Reply concisely.",
            },
            { role: "user", content: "Reply with OK." },
        ],
        temperature: 0,
        maxOutputTokens: 512,
        timeoutMs: 60000,
        retryTransient: false,
    });
}
