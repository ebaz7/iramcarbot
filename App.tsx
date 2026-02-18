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
        const rawUrl = getRawUrl(repoUrl, branch);
        const oneLiner = rawUrl ? `bash <(curl -Ls ${rawUrl})` : "# آدرس گیت‌هاب معتبر نیست";

        return (
           <div className="h-full overflow-hidden flex flex-col p-4 md:p-6 overflow-y-auto bg-slate-50">
            
            <div className="max-w-4xl mx-auto w-full space-y-8 pb-10">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 mb-2">🚀 راهنمای نصب ربات (بدون ارور ۴۰۴)</h2>
                    <p className="text-gray-500 text-sm">لطفاً مراحل زیر را **به ترتیب** انجام دهید تا روی سرور به مشکل نخورید.</p>
                </div>

                {/* Step 1: Download */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۱</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-4">
                        <Download className="text-blue-600" /> دانلود فایل‌ها
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                        ابتدا فایل‌های زیر را دانلود کنید. (ما کدها را برای شما آماده کرده‌ایم)
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={() => downloadFile("bot.py", generatePythonCode())}
                            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-3 rounded-lg text-gray-800 transition-colors font-mono text-sm"
                        >
                            <Download size={16} /> bot.py
                        </button>
                        <button 
                            onClick={() => downloadFile("install.sh", generateBashScript(repoUrl))}
                            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-3 rounded-lg text-gray-800 transition-colors font-mono text-sm"
                        >
                            <Download size={16} /> install.sh
                        </button>
                    </div>
                </div>

                {/* Step 2: Upload */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۲</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-4">
                        <UploadCloud className="text-purple-600" /> آپلود در گیت‌هاب
                    </h3>
                    <div className="bg-yellow-50 border-r-4 border-yellow-400 p-4 mb-4">
                        <p className="text-yellow-800 text-sm font-medium">
                            ⚠️ دلیل ارور 404 شما اینجاست!
                        </p>
                        <p className="text-yellow-700 text-xs mt-1">
                            سرور لینوکس نمی‌تواند فایلی که وجود ندارد را بخواند. شما باید فایل‌های دانلود شده در مرحله قبل را در مخزن گیت‌هاب خود آپلود کنید.
                        </p>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                        <li>به اکانت GitHub خود بروید.</li>
                        <li>یک مخزن (Repository) جدید بسازید (حتما <b>Public</b> باشد).</li>
                        <li>دو فایل <code>bot.py</code> و <code>install.sh</code> را در آن آپلود کنید (Drag & Drop).</li>
                        <li>مطمئن شوید نام فایل‌ها دقیقا همین باشد (حروف کوچک).</li>
                    </ul>
                </div>

                {/* Step 3: Verify */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden ring-2 ring-blue-500/20">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۳ (مهم)</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-4">
                        <Globe className="text-green-600" /> بررسی و دریافت لینک
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         <div>
                             <label className="text-gray-500 text-xs mb-1 block font-bold">آدرس مخزن شما (لینک صفحه اصلی ریپو):</label>
                             <input 
                                type="text" 
                                value={repoUrl}
                                onChange={(e) => { setRepoUrl(e.target.value); setUrlStatus('idle'); }}
                                placeholder="https://github.com/username/repo"
                                className="bg-gray-50 text-gray-800 text-sm px-3 py-3 rounded border border-gray-300 w-full focus:outline-none focus:border-blue-500 transition-colors font-mono ltr"
                             />
                         </div>
                         <div>
                             <label className="text-gray-500 text-xs mb-1 block font-bold">نام شاخه (Branch):</label>
                             <select 
                                value={branch}
                                onChange={(e) => { setBranch(e.target.value); setUrlStatus('idle'); }}
                                className="bg-gray-50 text-gray-800 text-sm px-3 py-3 rounded border border-gray-300 w-full focus:outline-none focus:border-blue-500 transition-colors"
                             >
                                 <option value="main">main</option>
                                 <option value="master">master</option>
                             </select>
                         </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                        <p className="text-xs text-gray-500 mb-3">ربات این آدرس را چک می‌کند:</p>
                        <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-4 break-all font-mono">{rawUrl || "..."}</code>
                        
                        <button 
                            onClick={checkUrlConnection}
                            disabled={urlStatus === 'checking' || !rawUrl}
                            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all shadow-md ${
                                urlStatus === 'success' ? 'bg-green-500 text-white cursor-default' :
                                urlStatus === 'error' ? 'bg-red-500 text-white' :
                                'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {urlStatus === 'checking' && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                            {urlStatus === 'idle' && "بررسی آنلاین فایل (کلیک کن)"}
                            {urlStatus === 'checking' && "در حال چک کردن..."}
                            {urlStatus === 'success' && <><Check size={18} /> فایل پیدا شد!</>}
                            {urlStatus === 'error' && <><XCircle size={18} /> پیدا نشد (404)</>}
                            {urlStatus === 'invalid' && "آدرس اشتباه"}
                        </button>

                        {urlStatus === 'error' && (
                            <p className="text-red-600 text-xs mt-3 font-bold animate-pulse">
                                ⛔ فایل install.sh در آدرس بالا وجود ندارد! لطفا مرحله ۲ را انجام دهید.
                            </p>
                        )}
                    </div>
                </div>

                {/* Step 4: Run */}
                <div className={`bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-6 relative overflow-hidden transition-all duration-500 ${urlStatus === 'success' ? 'opacity-100 grayscale-0' : 'opacity-50 grayscale'}`}>
                    <div className="absolute top-0 right-0 bg-gray-700 text-white px-3 py-1 rounded-bl-xl font-bold text-sm">مرحله ۴</div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-white mb-4">
                        <Terminal className="text-green-400" /> اجرای دستور در سرور
                    </h3>
                    
                    {urlStatus !== 'success' && (
                        <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-center p-4">
                            <span className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg transform -rotate-2">
                                🔒 اول مرحله ۳ را تیک سبز بگیرید
                            </span>
                        </div>
                    )}

                    <p className="text-gray-400 text-sm mb-3">
                        حالا که فایل تایید شد، این دستور را در ترمینال سرور (Putty یا Termius) بزنید:
                    </p>
                    
                    <div className="bg-black rounded-lg p-4 relative group border border-green-500/30">
                        <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed break-all" dir="ltr">{oneLiner}</pre>
                        <button 
                            onClick={() => copyToClipboard(oneLiner)}
                            className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all flex items-center gap-2"
                        >
                             {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
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