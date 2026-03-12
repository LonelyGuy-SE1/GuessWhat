import { getModelName } from "./model-router";
import { generateImage } from "./api-client";

/**
 * Generate image for a single entity.
 * Skip validation for speed - image generation models are good enough now.
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
