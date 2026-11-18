import { ApiError } from "@/backend/lib/api/errors";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getProviderConfig() {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_API_BASE_URL?.trim();
  const model = process.env.AI_API_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "AI is not configured. Set AI_API_BASE_URL, AI_API_KEY, and AI_API_MODEL in the server environment.",
    );
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new ApiError(500, "AI_CONFIGURATION_ERROR", "AI_API_BASE_URL must be a valid URL.");
  }

  const isLocalHttp = parsedBaseUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname);
  if (parsedBaseUrl.protocol !== "https:" && !isLocalHttp) {
    throw new ApiError(500, "AI_CONFIGURATION_ERROR", "AI_API_BASE_URL must use HTTPS.");
  }

  if (parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.search || parsedBaseUrl.hash) {
    throw new ApiError(500, "AI_CONFIGURATION_ERROR", "AI_API_BASE_URL must not contain credentials, query parameters, or a fragment.");
  }

  return {
    apiKey,
    model,
    endpoint: `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
  };
}

export async function generateAiText(messages: ChatMessage[]) {
  const { apiKey, model, endpoint } = getProviderConfig();
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.4 }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "AI_TIMEOUT", "The AI provider took too long to respond. Please try again.");
    }
    console.error("AI provider request could not be completed", error);
    throw new ApiError(502, "AI_UNAVAILABLE", "Could not reach the AI provider. Check the API URL and try again.");
  }

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "The AI provider rejected the API key or model access."
      : response.status === 429
        ? "The AI provider rate limit was reached. Please try again shortly."
        : "The AI provider returned an error. Check the API URL and model configuration.";
    console.error("AI provider returned an error", { status: response.status });
    throw new ApiError(502, "AI_PROVIDER_ERROR", message);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "The AI provider returned an invalid response.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices) ||
    typeof payload.choices[0]?.message?.content !== "string"
  ) {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "The AI provider returned an invalid response.");
  }

  const answer = payload.choices[0].message.content.trim();
  if (!answer) {
    throw new ApiError(502, "AI_EMPTY_RESPONSE", "The AI provider returned an empty response.");
  }

  return answer;
}
