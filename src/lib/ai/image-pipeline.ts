import { getModelName } from "./model-router";
import { generateImage } from "./api-client";

/**
 * Search Wikipedia for a high-quality image of the entity.
 * Uses the Wikipedia API (free, no auth required) to find the main page image.
 * Returns a direct Wikimedia image URL or null if not found.
 */
export async function searchWikipediaImage(entityName: string): Promise<string | null> {
  try {
    // Step 1: Search for the Wikipedia page
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entityName)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "GuessWhat-Game/1.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();

    // The REST API returns an "originalimage" field with the page's main image
    const imageUrl: string | undefined =
      data.originalimage?.source || data.thumbnail?.source;

    if (!imageUrl) return null;

    // Prefer a reasonably sized image (not the tiny thumbnail, not the huge original)
    // If we got the original, try to get a mid-size version via Wikimedia thumb URL
    if (data.originalimage?.source && data.thumbnail?.source) {
      // Thumbnail is usually ~320px; try to get ~800px version from the original URL
      const original: string = data.originalimage.source;
      // Wikimedia URLs like: upload.wikimedia.org/wikipedia/commons/X/XX/File.jpg
      // Can be converted to thumbs: upload.wikimedia.org/wikipedia/commons/thumb/X/XX/File.jpg/800px-File.jpg
      if (original.includes("upload.wikimedia.org") && !original.includes("/thumb/")) {
        const thumbUrl = original
          .replace("/commons/", "/commons/thumb/")
          .replace("/en/", "/en/thumb/");
        const filename = original.split("/").pop();
        if (filename) {
          return `${thumbUrl}/800px-${filename}`;
        }
      }
      // If we can't build a thumb URL, use the original
      return original;
    }

    return imageUrl;
  } catch {
    return null;
  }
}

/**
 * Generate image for a single entity using AI image generation.
 * This is the fallback when no real image is found.
 */
export async function generateEntityImage(
  apiKey: string,
  entityName: string,
  entityDescription: string,
  category: string
): Promise<string> {
  const model = getModelName("generate_image");

  // Build an image prompt that depicts the entity without revealing its name
  const imagePrompt = `A high-quality, detailed photograph-style image of: ${entityDescription}. Category: ${category}. 
The image should clearly depict the subject in a visually interesting way.
IMPORTANT: Do NOT include any text, labels, signs, watermarks, or written words in the image.
No names, no titles, no captions. Pure visual content only.`;

  const imageUrl = await generateImage(apiKey, model, imagePrompt);
  return imageUrl;
}
