import type { CommonStackMessage, CommonStackResponse } from "@/lib/types";

const COMMONSTACK_API_URL = "https://api.commonstack.ai/v1/chat/completions";

export async function chatCompletion(
  apiKey: string,
  model: string,
  messages: CommonStackMessage[],
  temperature = 0.7,
  maxTokens = 4096
): Promise<string> {
  const res = await fetch(COMMONSTACK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Commonstack API error (${res.status}): ${errText}`);
  }

  const data: CommonStackResponse = await res.json();
  return data.choices[0].message.content;
}

/**
 * Generate image using a Gemini image generation model via chat completions.
 * Logs the raw response structure on first call to help debug format issues.
 */
export async function generateImage(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch(COMMONSTACK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Commonstack Image API error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No choices in image response");
  }

  const msg = choice.message;

  // Gemini image model puts the image in message.images[0].url (not in content)
  if (Array.isArray(msg?.images) && msg.images.length > 0) {
    const url = msg.images[0]?.url;
    if (url) return url;
  }

  // Fallback: content array with image parts
  const content = msg?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "image_url" && part.image_url?.url) return part.image_url.url;
      if (part.inlineData?.data) return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
    }
  }

  // Fallback: content string
  if (typeof content === "string" && content.length > 0) {
    if (content.startsWith("http") || content.startsWith("data:image")) return content;
    const mdUrl = content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
    if (mdUrl) return mdUrl[1];
  }

  throw new Error("Could not extract image from response. message keys: " + Object.keys(msg ?? {}).join(","));
}
