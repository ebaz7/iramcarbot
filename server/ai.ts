import { GoogleGenAI } from '@google/genai';
import { loadSettings } from './settings';
import axios from 'axios';

export async function generatePriceList() {
  const settings = loadSettings();
  const source = settings.aiSource || 'GEMINI';

  const prompt = `
    Generate a JSON object representing the current market prices for popular Iranian cars (e.g., Saipa, Iran Khodro) and imported cars (e.g., Hyundai, Kia) for February 2026.
    The output MUST be a valid JSON array of objects with the following structure:
    [
      { "brand": "Brand Name", "model": "Model Name", "year": 2026, "price": 123456789, "currency": "Toman" }
    ]
    Do not include any markdown formatting or explanations. Just the raw JSON.
  `;

  let jsonString = '[]';

  if (source === 'GEMINI') {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API Key is missing.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    jsonString = response.text || '[]';
  } else if (source === 'DEEPSEEK') {
    const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DeepSeek API Key is missing.');
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt + " (Return ONLY raw JSON)" }],
      stream: false
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    jsonString = response.data.choices[0].message.content;
  } else if (source === 'OPENAI') {
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API Key is missing.');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt + " (Return ONLY raw JSON)" }]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    jsonString = response.data.choices[0].message.content;
  }

  try {
    // Clean up potential markdown code blocks
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error('Failed to parse AI response:', jsonString);
    throw new Error('Invalid JSON response from AI');
  }
}
