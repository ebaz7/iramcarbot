import { GoogleGenAI } from '@google/genai';
import { loadSettings } from './settings';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Helper to scrape and strip HTML tags
async function fetchAndClean(url: string): Promise<string> {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    console.log(`Scraping source URL: ${url}`);
    const response = await axios.get(url, { headers, timeout: 20000 });
    let html = response.data;
    if (typeof html !== 'string') {
      html = JSON.stringify(html);
    }
    
    // Strip scripts, styles and HTML tags
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<[^>]+>/g, ' ');
    
    // Normalize spaces
    const cleanText = html.replace(/\s+/g, ' ').trim();
    // Return a safe slice
    return cleanText.slice(0, 30000);
  } catch (err: any) {
    console.error(`Error fetching URL (${url}):`, err.message);
    return "";
  }
}

// Save a JSON database helper
function saveJsonDb(filename: string, data: any) {
  try {
    const fullPath = path.join(process.cwd(), filename);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved JSON DB to ${filename}`);
  } catch (e) {
    console.error(`Error saving database ${filename}:`, e);
  }
}

export async function generatePriceList() {
  const settings = loadSettings();
  const today = new Date().toLocaleDateString('fa-IR');

  const carUrl = "https://www.iranjib.ir/showgroup/45/%D9%82%DB%8C%D9%85%D8%AA-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AA%D9%88%D9%84%DB%8C%D8%AF-%D8%AF%D8%A7%D8%AE%D9%84/";
  const carHtml = await fetchAndClean(carUrl);

  const carPrompt = `
    امروز تاریخ ${today} است. وظیفه شما استخراج دقیق‌ترین قیمت خودروهای صفر در ایران است.
    محتوای سایت استخراج شده:
    ${carHtml}

    خروجی باید یک آرایه JSON معتبر طبق ساختار زیر باشد:
    [
      { "brand": "ایران خودرو", "model": "پژو 207", "year": 1403, "price": 780000000, "currency": "Toman" }
    ]
    فقط JSON را برگردانید و فرمت Markdown اضافه نکنید.
  `;

  let jsonString = '[]';
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is missing.');
  
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: carPrompt,
    config: { responseMimeType: 'application/json' },
  });
  
  jsonString = response.text || '[]';

  let finalCarArray: any[] = [];
  try {
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    finalCarArray = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error('Failed to parse AI car price response:', jsonString);
    throw new Error('Invalid JSON response from AI while fetching car prices.');
  }

  // Format and save locally
  try {
    const formattedTree: Record<string, any> = {};
    finalCarArray.forEach((p: any) => {
      const b = p.brand || 'سایر';
      if (!formattedTree[b]) formattedTree[b] = { models: [] };
      let m = formattedTree[b].models.find((item: any) => item.name === p.model);
      if (!m) {
        m = { name: p.model, variants: [] };
        formattedTree[b].models.push(m);
      }
      m.variants.push({
        name: `مدل ${p.year || 1403}`,
        marketPrice: p.price,
        factoryPrice: p.factoryPrice || Math.round(p.price * 0.88),
      });
    });
    saveJsonDb('car_db_ai.json', formattedTree);
  } catch (err: any) {
    console.error('Error auto-formatting the car_db_ai.json:', err.message);
  }

  return finalCarArray;
}

