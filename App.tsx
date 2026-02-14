import React, { useState } from 'react';
import TelegramMock from './components/TelegramMock';
import { generateBashScript, generatePythonCode } from './services/generator';
import { Terminal, Code, Play, Check, Copy, Info, Download, GitBranch } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { CAR_DB } from './constants';

enum Tab {
  SIMULATOR,
  PYTHON,
  BASH,
  ANALYSIS
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SIMULATOR);
  const [copied, setCopied] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [repoUrl, setRepoUrl] = useState("https://github.com/ebaz7/iramcarbot.git");

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

  const getRepoName = (url: string) => {
      try {
          const parts = url.split('/');
          let name = parts[parts.length - 1];
          if (name.endsWith('.git')) name = name.slice(0, -4);
          return name || 'iramcarbot';
      } catch {
          return 'iramcarbot';
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
                      {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            </div>
            <pre className="flex-1 bg-[#1e1e1e] text-blue-300 p-4 overflow-auto text-xs md:text-sm font-mono rounded-b-lg">
              <code>{generatePythonCode()}</code>
            </pre>
          </div>
        );
      case Tab.BASH:
        const repoName = getRepoName(repoUrl);
        const installCommands = `sudo apt-get update && sudo apt-get install -y git
git clone ${repoUrl}
cd ${repoName}
chmod +x install.sh
bash install.sh`;

        return (
           <div className="h-full overflow-hidden flex flex-col p-4 space-y-4 overflow-y-auto">
            
            {/* GitHub Section */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-lg">
                <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                    <GitBranch className="text-green-400" />
                    راهنمای نصب از گیت‌هاب
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                    دستورات زیر را کپی کرده و در ترمینال سرور خود اجرا کنید تا ربات دانلود و نصب شود:
                </p>
                
                <div className="bg-black rounded-lg p-4 relative group border border-slate-800">
                    <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed">{installCommands}</pre>
                    <button 
                        onClick={() => copyToClipboard(installCommands)}
                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2"
                        title="کپی دستورات"
                    >
                         {copied ? <Check size={16} /> : <Copy size={16} />}
                         <span className="text-xs">کپی</span>
                    </button>
                </div>
                
                <div className="mt-4 flex flex-col gap-2">
                     <label className="text-gray-500 text-xs">آدرس مخزن گیت‌هاب شما:</label>
                     <input 
                        type="text" 
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="bg-slate-800 text-gray-300 text-sm px-3 py-2 rounded border border-slate-600 w-full focus:outline-none focus:border-blue-500 transition-colors"
                     />
                </div>
            </div>

            {/* Manual Script Section */}
            <div className="flex-1 flex flex-col min-h-[300px]">
                <div className="bg-gray-800 text-gray-200 p-2 text-sm flex justify-between items-center rounded-t-lg">
                    <span>محتوای install.sh (جهت بررسی یا آپلود)</span>
                    <div className="flex gap-2">
                        <button 
                        onClick={() => downloadFile("install.sh", generateBashScript())}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white transition-colors"
                        title="دانلود فایل نصب"
                        >
                        <Download size={14} /> دانلود فایل
                        </button>
                        <button 
                        onClick={() => copyToClipboard(generateBashScript())}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "کپی" : "کپی"}
                        </button>
                    </div>
                </div>
                <pre className="flex-1 bg-[#1e1e1e] text-gray-400 p-4 overflow-auto text-xs md:text-sm font-mono rounded-b-lg">
                <code>{generateBashScript()}</code>
                </pre>
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
                <Terminal size={16} /> اسکریپت نصب
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