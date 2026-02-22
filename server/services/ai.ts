import { GoogleGenAI } from "@google/genai";
import { updatePrices, loadDB } from '../db';
import fs from 'fs';
import path from 'path';

const AI_MODEL = "gemini-3-flash-preview";

export const updatePricesFromAI = async () => {
  const db = loadDB();
  const apiKey = db.config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No Gemini API Key found.");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const prompt = `Generate a JSON object of current Iranian car prices (in Millions of Tomans) for Feb 2026.
    Structure: { "cars": { "Brand": { "models": [ { "name": "Model Name", "variants": [ { "name": "Variant Name", "marketPrice": 1234, "factoryPrice": 1000 } ] } ] } } }
    Include popular brands: Iran Khodro, Saipa, Pars Khodro, Bahman Motor, Kerman Motor.
    Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    const data = JSON.parse(jsonText);
    
    // Update DB
    updatePrices({
      cars: data.cars || {},
      source: 'AI',
    });
    console.log("Prices updated from AI successfully.");
    return data;
  } catch (error) {
    console.error("Error updating prices from AI:", error);
    throw error;
  }
};
