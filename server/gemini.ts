import { GoogleGenAI } from '@google/genai';
import { loadSettings } from './settings';

export async function generatePriceList() {
  const settings = loadSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please set it in the settings or environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `
        Generate a JSON object representing the current market prices for popular Iranian cars (e.g., Saipa, Iran Khodro) and imported cars (e.g., Hyundai, Kia) for February 2026.
        The output MUST be a valid JSON array of objects with the following structure:
        [
          { "brand": "Brand Name", "model": "Model Name", "year": 2026, "price": 123456789, "currency": "Toman" }
        ]
        Do not include any markdown formatting or explanations. Just the raw JSON.
      `,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    // Clean up potential markdown code blocks if the model adds them despite instructions
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const data = JSON.parse(jsonString);
      return data;
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      throw new Error('Invalid JSON response from Gemini');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
