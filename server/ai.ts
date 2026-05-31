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
    // Return a safe slice to fit model context/token windows nicely
    return cleanText.slice(0, 30000);
  } catch (err: any) {
    console.error(`Error fetching URL (${url}):`, err.message);
    return "خطا در دریافت اطلاعات از سایت";
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
  const source = settings.aiSource || 'GEMINI';
  const today = new Date().toLocaleDateString('fa-IR');

  // Scraping the required website for car prices (Iran jib)
  const carUrl = "https://www.iranjib.ir/showgroup/45/%D9%82%DB%8C%D9%85%D8%AA-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AA%D9%88%D9%84%DB%8C%D8%AF-%D8%AF%D8%A7%D8%AE%D9%84/";
  const carHtml = await fetchAndClean(carUrl);

  const carPrompt = `
    امروز تاریخ ${today} است. وظیفه شما استخراج دقیق‌ترین و بروزترین قیمت خودروهای صفر در ایران است.
    در ادامه محتوای متنی استخراج شده از سایت ایران جیب (منبع معتبر قیمت خودرو) آورده شده است. لطفا قیمت‌ها را دقیقا از این متن استخراج کنید:

    ${carHtml}

    قیمت‌ها باید دقیق‌ترین و منطبق با متن بالا باشند. در صورت ذکر نشدن قیمت کارخانه برای برخی خودروها، فیلد مربوطه را صفر یا بر اساس محاسبات حدودی قرار دهید.
    خروجی باید صرفاً و لزوماً یک آرایه JSON معتبر طبق ساختار زیر (با فیلدهای انگلیسی و کلیدها دقیقاً به انگلیسی) باشد:
    [
      { "brand": "ایران خودرو", "model": "پژو 207 هیدرولیک", "year": 1403, "price": 780000000, "currency": "Toman" }
    ]

    نکات مهم:
    1. مقدار فیلد brand باید یکی از تولیدکنندگان معروف ایرانی مانند "ایران خودرو"، "سایپا"، "بهمن موتور"، "مدیران خودرو"، "کرمان موتور"، "پارس خودرو" یا موارد مشابه باشد.
    2. مقدار فیلد model باید شامل مدل و تیپ مربوطه باشد.
    3. مقدار قیمت ها (price) باید دقیقاً به تومان و به صورت عدد باشد. (اگر در متن به میلیون تومان بود، مثلا 780 میلیون، آن را تبدیل به 780000000 کنید).
    4. هیچ گونه متن اضافه یا فرمت مارک داون (Markdown) به همراه خروجی ارسال نکنید. فقط و فقط آرایه JSON خام را برگردانید.
  `;

  let jsonString = '[]';

  // Requesting completion
  if (source === 'GEMINI') {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API Key is missing.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: carPrompt,
      config: { responseMimeType: 'application/json' },
    });
    jsonString = response.text || '[]';
  } else if (source === 'DEEPSEEK') {
    const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DeepSeek API Key is missing.');
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: carPrompt + " (Return ONLY raw JSON array)" }],
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
      messages: [{ role: 'user', content: carPrompt + " (Return ONLY raw JSON array)" }]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    jsonString = response.data.choices[0].message.content;
  }

  let finalCarArray: any[] = [];
  try {
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    finalCarArray = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error('Failed to parse AI car price response:', jsonString);
    throw new Error('Invalid JSON response from AI while fetching car prices.');
  }

  // --- Background Scrape of Mobiles (Parallel Workflow to sync both databases) ---
  try {
    const mobUrl1 = "https://www.iranjib.ir/showgroup/28/%D9%82%DB%8C%D9%85%D8%AA-%D8%B1%D9%88%D8%B2-%D9%85%D9%88%D8%A8%D8%A7%DB%8C%D9%84/";
    const mobUrl3 = "https://www.mobile.ir/phones/prices.aspx?terms=&brandid=&provinceid=&duration=1&price_from=-1&price_to=-1&shopid=&pagesize=50&sort=date&dir=desc&submit=%D8%AC%D8%B3%D8%AA%D8%AC%D9%88";
    
    console.log("Scraping mobile prices from sources...");
    const mobHtml1 = await fetchAndClean(mobUrl1);
    const mobHtml3 = await fetchAndClean(mobUrl3);

    const mobPrompt = `
      امروز تاریخ ${today} است. وظیفه شما استخراج دقیق‌ترین و بروزترین قیمت گوشی‌های موبایل در ایران است.
      در ادامه محتوای متنی از منابع معتبر براتس آورده شده است:

      منبع ۱ (ایران جیب):
      ${mobHtml1.slice(0, 15000)}

      منبع ۲ (مرجع موبایل):
      ${mobHtml3.slice(0, 15000)}

      لطفاً برندها و مدل‌های معروف (مانند Apple, Samsung, Xiaomi) را به صورت درخت گرافیکی JSON سازماندهی کرده و با ساختار نمونه زیر تدارک ببینید:
      {
        "Apple": {
          "models": [
            {
              "name": "iPhone 15 Pro Max",
              "variants": [
                { "name": "256GB RAM 8", "officialPrice": 75000000, "marketPrice": 87000000 }
              ]
            }
          ]
        },
        "Samsung": {
          "models": [
            {
              "name": "Galaxy S24 Ultra",
              "variants": [
                { "name": "256GB RAM 12", "officialPrice": 68000000, "marketPrice": 70500000 }
              ]
            }
          ]
        }
      }

      نکته مهم:
      - قیمت ها باید به تومان و به صورت عدد باشند.
      - هیچ متنی اضافه تر از JSON ارسال نشود. فقط و فقط قالب JSON بالا را برگشت دهید.
    `;

    let mobJsonString = '{}';
    if (source === 'GEMINI') {
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: mobPrompt,
          config: { responseMimeType: 'application/json' },
        });
        mobJsonString = response.text || '{}';
      }
    } else if (source === 'DEEPSEEK') {
      const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
      if (apiKey) {
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: mobPrompt + " (Return ONLY raw JSON)" }],
          stream: false
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        mobJsonString = response.data.choices[0].message.content;
      }
    } else if (source === 'OPENAI') {
      const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: mobPrompt + " (Return ONLY raw JSON)" }]
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        mobJsonString = response.data.choices[0].message.content;
      }
    }

    const cleanedMobJson = mobJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const finalMobTree = JSON.parse(cleanedMobJson);
    if (finalMobTree && Object.keys(finalMobTree).length > 0) {
      saveJsonDb('mobile_db_ai.json', finalMobTree);
    }
  } catch (mobErr: any) {
    console.error('Failed to background update mobile prices:', mobErr.message);
  }

  // Save the custom structured car DB file too so we maintain high compatibility and offline functionality
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
