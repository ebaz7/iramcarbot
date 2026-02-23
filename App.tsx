import React, { useState, useEffect } from 'react';
import { Settings, Upload, RefreshCw, Database, Bot, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface AppSettings {
  priority: 'AI' | 'EXCEL';
  aiSource: 'GEMINI' | 'DEEPSEEK' | 'OPENAI';
  updateInterval: number;
  lastUpdated: string | null;
  geminiApiKey: string;
  deepseekApiKey: string;
  openaiApiKey: string;
  telegramToken: string;
}

interface PriceItem {
  brand: string;
  model: string;
  year: number;
  price: number;
  currency: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'upload'>('dashboard');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchPrices();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchPrices = async () => {
    try {
      const res = await fetch('/api/prices');
      const data = await res.json();
      setPrices(data.data || []);
    } catch (err) {
      console.error('Failed to fetch prices', err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'تنظیمات با موفقیت ذخیره شد!' });
        fetchSettings();
      } else {
        throw new Error('Failed to update');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'خطا در ذخیره تنظیمات.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAiUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/update-ai', { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'آپدیت هوشمند با موفقیت انجام شد!' });
        fetchPrices();
        fetchSettings();
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'خطا در آپدیت هوشمند.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'فایل اکسل با موفقیت آپلود شد!' });
        fetchPrices();
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'خطا در آپلود فایل.' });
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <div className="flex items-center justify-center h-screen text-white bg-slate-900">در حال بارگذاری...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" dir="rtl">
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-64 bg-slate-800 border-l border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <Bot className="w-8 h-8 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">مدیریت ربات</h1>
        </div>
        
        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-400'}`}
          >
            <Database className="w-5 h-5" />
            داشبورد
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-400'}`}
          >
            <Settings className="w-5 h-5" />
            تنظیمات
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'upload' ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-400'}`}
          >
            <Upload className="w-5 h-5" />
            آپلود اکسل
          </button>
        </nav>

        <div className="absolute bottom-4 left-4 right-4 p-4 bg-slate-700/30 rounded-xl border border-slate-600/50">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Clock className="w-3 h-3" />
            آخرین آپدیت:
          </div>
          <div className="text-sm font-mono text-emerald-400" dir="ltr">
            {settings.lastUpdated ? new Date(settings.lastUpdated).toLocaleString() : 'هرگز'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mr-64 p-8">
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
            <button onClick={() => setMessage(null)} className="mr-auto hover:text-white">&times;</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">داشبورد قیمت‌ها</h2>
                <p className="text-slate-400">منبع فعلی: {settings.priority === 'AI' ? `هوش مصنوعی (${settings.aiSource})` : 'فایل اکسل'}</p>
              </div>
              <button 
                onClick={handleAiUpdate}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                آپدیت فوری (AI)
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prices.length > 0 ? (
                prices.map((item, idx) => (
                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-emerald-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-white">{item.brand} {item.model}</h3>
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">{item.year}</span>
                    </div>
                    <div className="text-2xl font-mono text-emerald-400 flex items-center gap-1 justify-end">
                      {item.price?.toLocaleString()} <span className="text-sm text-slate-500">{item.currency || 'تومان'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-slate-500 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                  هیچ داده‌ای موجود نیست. لطفا آپدیت هوشمند را بزنید یا فایل اکسل آپلود کنید.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">تنظیمات ربات</h2>
            <form onSubmit={handleUpdateSettings} className="space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">اولویت داده‌ها</label>
                  <select
                    value={settings.priority}
                    onChange={(e) => setSettings({ ...settings, priority: e.target.value as 'AI' | 'EXCEL' })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="AI">هوش مصنوعی</option>
                    <option value="EXCEL">فایل اکسل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">منبع هوش مصنوعی</label>
                  <select
                    value={settings.aiSource}
                    onChange={(e) => setSettings({ ...settings, aiSource: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="GEMINI">Gemini (Google)</option>
                    <option value="DEEPSEEK">DeepSeek</option>
                    <option value="OPENAI">ChatGPT (OpenAI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">فاصله زمانی آپدیت (ساعت)</label>
                  <input
                    type="number"
                    value={settings.updateInterval}
                    onChange={(e) => setSettings({ ...settings, updateInterval: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Gemini API Key</label>
                  <input
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="AIza..."
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">DeepSeek API Key</label>
                  <input
                    type="password"
                    value={settings.deepseekApiKey}
                    onChange={(e) => setSettings({ ...settings, deepseekApiKey: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="sk-..."
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">OpenAI API Key</label>
                  <input
                    type="password"
                    value={settings.openaiApiKey}
                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="sk-..."
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">توکن ربات تلگرام</label>
                <input
                  type="password"
                  value={settings.telegramToken}
                  onChange={(e) => setSettings({ ...settings, telegramToken: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="123456:ABC-..."
                  dir="ltr"
                />
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">آپلود فایل اکسل</h2>
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">انتخاب فایل اکسل</h3>
              <p className="text-slate-400 mb-6">فایل .xlsx شامل ستون‌های: Brand, Model, Year, Price</p>
              
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-emerald-500 file:text-white
                  hover:file:bg-emerald-600
                  cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
