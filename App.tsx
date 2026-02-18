
import React, { useState } from 'react';
import TelegramMock from './components/TelegramMock';
import { generateBashScript, generatePythonCode } from './services/generator';
import { Terminal, Code, Play, Check, Copy, Info, Download, GitBranch, Server, AlertTriangle, ExternalLink, Globe, UploadCloud, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { CAR_DB } from './constants';

enum Tab {
  SIMULATOR,
  PYTHON,
  BASH,
  ANALYSIS
}

type UrlStatus = 'idle' | 'checking' | 'success' | 'error' | 'invalid';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.BASH); // Default to BASH to show instructions first
  const [copied, setCopied] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  // Repo Config
  const [repoUrl, setRepoUrl] = useState("https://github.com/ebaz7/iramcarbot");
  const [branch, setBranch] = useState("main");
  const [urlStatus, setUrlStatus] = useState<UrlStatus>('idle');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleAnalyzeMarket = async () => {
    if (!process.env.API_KEY) {
      setAnalysis("⚠️ API Key not found. Please set REACT_APP_GEMINI_API_KEY.");
      return;
    }

    setLoadingAnalysis(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const today = new Date().toLocaleDateString('fa-IR');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a professional Iranian car market analyst.
        
        Task: Provide a "Daily Market Price Estimation" for today: ${today}.
        
        The user believes the internal database prices are outdated.
        IGNORE the internal JSON data.
        INSTEAD, use your own knowledge to estimate the CURRENT REAL-WORLD market price (in Millions of Tomans) for these popular cars in Iran:
        
        1. Peugeot 207 (Dandei & MC)
        2. Dena Plus Turbo (Auto)
        3. Shahin G
        4. Quick GX
        5. Lamari Eama
        6. Tiggo 8 Pro Max
        
        Output format (Persian):
        - Car Name
        - Estimated Market Price Range (Today)
        - Brief trend analysis (Up/Down/Stable)
        
        Disclaimers: Mention that these are AI estimates and real transaction prices may vary slightly in dealerships.`,
      });
      
      setAnalysis(response.text || "No analysis generated.");
    } catch (error) {
      console.error(error);
      setAnalysis("Failed to generate analysis. Please check your API Key and connection.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Helper to extract raw URL
  const getRawUrl = (url: string, branchName: string): string | null => {
      try {
          let cleanUrl = url.trim();
          if (cleanUrl.endsWith('.git')) cleanUrl = cleanUrl.slice(0, -4);
          if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
          
          const parts = cleanUrl.split('/');
          // Valid: https://github.com/User/Repo
          if (parts.length >= 5) {
              const user = parts[parts.length - 2];
              const repo = parts[parts.length - 1];
              return `https://raw.githubusercontent.com/${user}/${repo}/${branchName}/install.sh`;
          }
          return null;
      } catch {
          return null;
      }
  };

  const checkUrlConnection = async () => {
    const raw = getRawUrl(repoUrl, branch);
    if (!raw) {
        setUrlStatus('invalid');
        return;
    }
    setUrlStatus('checking');
    try {
        const res = await fetch(raw, { method: 'HEAD' });
        if (res.ok) {
            setUrlStatus('success');
        } else {
            setUrlStatus('error');
        }
    } catch (e) {
        // Fallback for CORS issues or network errors, assume error or ask user to click
        // Assuming 404 if fetch fails in typical browser environment for public github raw
        setUrlStatus('error');
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case Tab.SIMULATOR:
        return (
          <div className="h-full flex items-center justify-center p-4">
             <div className="w-full max-w-md h-[600px] md:h-[700px]">
                <TelegramMock />
             </div>
          </div>
        );
      case Tab.PYTHON:
        return (
          <div className="h-full overflow-hidden flex flex-col">
            <div className="bg-gray-800 text-gray-200 p-2 text-sm flex justify-between items-center rounded-t-lg">
                <span>bot.py</span>
                <div className="flex gap-2">
                    <button 
                      onClick={() => downloadFile("bot.py", generatePythonCode())}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                      title="دانلود فایل پایتون"
                    >
                      <Download size={14} />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatePythonCode())}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "کپی شد" : "کپی"}
                    </button>
                </div>
            </div>
            <pre className="flex-1 bg-[#1e1e1e] text-blue-300 p-4 overflow-auto text-xs md:text-sm font-mono rounded-b-lg">
              <code>{generatePythonCode()}</code>
            </pre>
          </div>
        );
      case Tab.BASH:
        const bashCode = generateBashScript(repoUrl);

        return (
           <div className="h-full overflow-hidden flex flex-col p-4 md:p-6 overflow-y-auto bg-slate-50">
            
            <div className="max-w-4xl mx-auto w-full space-y-8 pb-10">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 mb-2">🚗 مدیریت ربات (نسخه استاندارد)</h2>
                    <p className="text-gray-500 text-sm">منوی کلاسیک مدیریت ربات (شامل نصب، آپدیت و تعمیر بکاپ)</p>
                </div>

                {/* Step 1: Warning */}
                <div className="bg-blue-50 border-r-4 border-blue-600 p-4 rounded shadow-sm">
                    <div className="flex items-center gap-2 font-bold text-blue-800 mb-2">
                        <Info /> بازگشت به تنظیمات اصلی
                    </div>
                    <ul className="text-blue-700 text-sm list-disc list-inside">
                        <li><b>منوی ۹ گزینه‌ای:</b> تمام امکانات به حالت قبل برگشت.</li>
                        <li><b>حذف پسورد:</b> دیگر موقع نصب یا ریستور پسورد اجباری نیست.</li>
                        <li><b>تعمیر ریستور:</b> مشکل "کار نکردن ریستور" با اصلاح دسترسی فایل‌ها حل شد.</li>
                    </ul>
                </div>

                {/* Step 2: Download & Copy */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۱ (دریافت فایل)</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-4">
                        <Download className="text-blue-600" /> دانلود اسکریپت
                    </h3>
                    <div className="flex flex-wrap gap-3 mb-6">
                        <button 
                            onClick={() => downloadFile("install.sh", bashCode)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg text-white transition-colors font-bold text-sm shadow-lg w-full md:w-auto justify-center"
                        >
                            <Download size={20} /> دانلود install.sh
                        </button>
                    </div>

                    <h3 className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-2">
                        <Copy className="text-purple-600" /> یا کپی کد (روش دستی)
                    </h3>
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <div className="bg-gray-700 p-2 flex justify-between items-center text-xs text-gray-300">
                            <span>install.sh</span>
                            <button 
                                onClick={() => copyToClipboard(bashCode)}
                                className="flex items-center gap-1 hover:text-white"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />} کپی کامل
                            </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-green-300 overflow-x-auto h-64 md:h-96" dir="ltr">
                            {bashCode}
                        </pre>
                    </div>
                </div>

                {/* Step 3: Run Manually */}
                <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-green-600 text-white px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۲ (اجرا)</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-white mb-4">
                        <Terminal className="text-green-400" /> دستور اجرا در سرور
                    </h3>
                    
                    <div className="space-y-4">
                        <p className="text-gray-300 text-sm">
                            ۱. فایل <b>install.sh</b> را در سرور آپلود کنید (یا بسازید و کد بالا را داخلش بریزید).
                            <br/>
                            ۲. دستور زیر را بزنید:
                        </p>
                        <div className="bg-black rounded-lg p-4 relative group border border-green-500/30">
                            <pre className="text-green-400 font-mono text-sm" dir="ltr">bash install.sh</pre>
                        </div>
                        <p className="text-yellow-400 text-xs mt-2">
                            * برای رفع مشکل ربات، گزینه ۸ (Restore) را انتخاب کنید و فایل بکاپ خود را بدهید.
                        </p>
                    </div>
                </div>

            </div>
          </div>
        );
      case Tab.ANALYSIS:
        return (
           <div className="h-full p-8 flex flex-col items-center justify-center text-center">
              <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl w-full">
                <h3 className="text-xl font-bold mb-4 flex items-center justify-center gap-2 text-indigo-600">
                  <Info /> هوش مصنوعی بازار (Gemini)
                </h3>
                <p className="text-gray-600 mb-6">
                  با توجه به نوسانات شدید بازار، دیتابیس داخلی ممکن است قدیمی باشد. 
                  با کلیک روی دکمه زیر، هوش مصنوعی گوگل (Gemini) بر اساس <b>تاریخ امروز</b> و دانش خود، قیمت‌های واقعی بازار را تخمین می‌زند.
                </p>
                
                {loadingAnalysis ? (
                  <div className="animate-pulse flex space-x-4 justify-center items-center h-24">
                     <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></div>
                     <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                     <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                ) : analysis ? (
                  <div className="text-right bg-indigo-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap leading-relaxed border border-indigo-100 max-h-[400px] overflow-y-auto">
                    {analysis}
                  </div>
                ) : (
                   <button 
                      onClick={handleAnalyzeMarket}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                   >
                     استعلام قیمت واقعی روز (Gemini)
                   </button>
                )}
              </div>
           </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white">
               <Terminal size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold text-gray-800">Iran Car Bot Builder</h1>
               <p className="text-xs text-gray-500">سازنده و شبیه‌ساز ربات تلگرام قیمت خودرو</p>
             </div>
          </div>
          
          <nav className="flex bg-gray-100 p-1 rounded-xl">
             <button 
                onClick={() => setActiveTab(Tab.SIMULATOR)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === Tab.SIMULATOR ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Play size={16} /> شبیه‌ساز
             </button>
             <button 
                onClick={() => setActiveTab(Tab.PYTHON)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === Tab.PYTHON ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Code size={16} /> کد پایتون
             </button>
             <button 
                onClick={() => setActiveTab(Tab.BASH)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === Tab.BASH ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Terminal size={16} /> راهنمای نصب
             </button>
             <button 
                onClick={() => setActiveTab(Tab.ANALYSIS)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === Tab.ANALYSIS ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Info size={16} /> تحلیل هوشمند
             </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
          <div className="bg-white rounded-2xl shadow-xl h-[calc(100vh-140px)] border border-gray-100 overflow-hidden">
             {renderContent()}
          </div>
      </main>
    </div>
  );
}