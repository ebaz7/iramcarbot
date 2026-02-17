
import { CarDatabase, MobileDatabase } from './types';

// Updated Mock Data - Late 1403 / Early 1404
export const CAR_DB: CarDatabase = {
  "ایران خودرو": {
    name: "ایران خودرو",
    models: [
      {
        name: "پژو 207",
        variants: [
          { name: "207 دنده‌ای هیدرولیک (TU5)", marketPrice: 830, factoryPrice: 470 },
          { name: "207 دنده‌ای ارتقا یافته (فول)", marketPrice: 890, factoryPrice: 510 },
          { name: "207 اتوماتیک سقف شیشه ای", marketPrice: 1180, factoryPrice: 610 },
          { name: "207 اتوماتیک TU5P", marketPrice: 1100, factoryPrice: 590 }
        ]
      },
      {
        name: "دنا",
        variants: [
          { name: "دنا پلاس 6 دنده دستی", marketPrice: 1080, factoryPrice: 560 },
          { name: "دنا پلاس توربو اتوماتیک آپشنال", marketPrice: 1320, factoryPrice: 700 },
          { name: "دنا پلاس جوانان", marketPrice: 1420, factoryPrice: 750 }
        ]
      },
      {
        name: "تارا",
        variants: [
          { name: "تارا دستی V1 پلاس", marketPrice: 950, factoryPrice: 590 },
          { name: "تارا اتوماتیک V4 LX", marketPrice: 1350, factoryPrice: 690 }
        ]
      },
      {
        name: "هایما",
        variants: [
          { name: "هایما S7 پلاس", marketPrice: 1900, factoryPrice: 1190 },
          { name: "هایما S5 جدید", marketPrice: 1550, factoryPrice: 1050 },
          { name: "هایما 8S", marketPrice: 2100, factoryPrice: 1370 },
          { name: "هایما 7X", marketPrice: 1950, factoryPrice: 1480 }
        ]
      }
    ]
  },
  "سایپا": {
    name: "سایپا",
    models: [
      {
        name: "شاهین",
        variants: [
          { name: "شاهین G (دنده‌ای)", marketPrice: 810, factoryPrice: 440 },
          { name: "شاهین GL (بدون سانروف)", marketPrice: 780, factoryPrice: 420 },
          { name: "شاهین اتوماتیک CVT", marketPrice: 960, factoryPrice: 650 }
        ]
      },
      {
        name: "کوییک",
        variants: [
          { name: "کوییک GXR-L (رینگ آلومینیومی)", marketPrice: 495, factoryPrice: 390 },
          { name: "کوییک GX-L", marketPrice: 475, factoryPrice: 370 },
          { name: "کوییک اتوماتیک", marketPrice: 600, factoryPrice: 340 }
        ]
      },
      {
        name: "اطلس",
        variants: [
          { name: "اطلس G", marketPrice: 650, factoryPrice: 415 }
        ]
      },
      {
        name: "سهند",
        variants: [
          { name: "سهند S", marketPrice: 580, factoryPrice: 440 }
        ]
      }
    ]
  },
  "مدیران خودرو": {
    name: "مدیران خودرو",
    models: [
      {
        name: "X22 / X33",
        variants: [
          { name: "X22 Pro دنده‌ای", marketPrice: 1020, factoryPrice: 710 },
          { name: "X33 Cross اتوماتیک", marketPrice: 1400, factoryPrice: 1050 }
        ]
      },
      {
        name: "آریزو",
        variants: [
          { name: "آریزو 5 اسپورت FL", marketPrice: 1500, factoryPrice: 1100 },
          { name: "آریزو 6 پرو", marketPrice: 1700, factoryPrice: 1250 },
          { name: "آریزو 8 اکسلنت", marketPrice: 3000, factoryPrice: 2200 }
        ]
      },
      {
        name: "تیگو",
        variants: [
          { name: "تیگو 7 پرو پرمیوم", marketPrice: 2200, factoryPrice: 1550 },
          { name: "تیگو 8 پرو مکس IE", marketPrice: 3250, factoryPrice: 2690 },
          { name: "تیگو 8 پرو e+ (هیبرید)", marketPrice: 3400, factoryPrice: 2800 }
        ]
      },
      {
        name: "فونیکس",
        variants: [
          { name: "فونیکس FX پرمیوم", marketPrice: 2550, factoryPrice: 1750 }
        ]
      }
    ]
  },
  "کرمان موتور": {
    name: "کرمان موتور",
    models: [
      {
        name: "JAC",
        variants: [
          { name: "جک J4 آپشنال", marketPrice: 960, factoryPrice: 790 },
          { name: "جک S3 اتوماتیک", marketPrice: 1350, factoryPrice: 930 },
        ]
      },
      {
        name: "KMC",
        variants: [
          { name: "KMC T8", marketPrice: 1780, factoryPrice: 1350 },
          { name: "KMC T9", marketPrice: 2500, factoryPrice: 1950 },
          { name: "KMC J7", marketPrice: 1850, factoryPrice: 1380 },
          { name: "KMC X5", marketPrice: 1950, factoryPrice: 1400 },
          { name: "KMC A5", marketPrice: 1800, factoryPrice: 1300 }
        ]
      }
    ]
  },
  "بهمن موتور": {
    name: "بهمن موتور",
    models: [
      {
        name: "فیدلیتی",
        variants: [
          { name: "فیدلیتی پرایم 5 نفره", marketPrice: 2000, factoryPrice: 1350 },
          { name: "فیدلیتی پرایم 7 نفره", marketPrice: 2100, factoryPrice: 1360 },
          { name: "فیدلیتی پرستیژ 7 نفره", marketPrice: 2850, factoryPrice: 1720 }
        ]
      },
      {
        name: "دیگنیتی",
        variants: [
          { name: "دیگنیتی پرایم", marketPrice: 2150, factoryPrice: 1500 },
          { name: "دیگنیتی پرستیژ", marketPrice: 2700, factoryPrice: 1750 }
        ]
      },
      {
        name: "ریسپکت",
        variants: [
          { name: "ریسپکت 2", marketPrice: 1600, factoryPrice: 1150 }
        ]
      }
    ]
  },
  "آرین پارس": {
    name: "آرین پارس موتور",
    models: [
      {
        name: "لاماری",
        variants: [
          { name: "لاماری ایما", marketPrice: 2100, factoryPrice: 1430 },
          { name: "لاماری ایما HEV (هیبرید)", marketPrice: 2600, factoryPrice: 1800 }
        ]
      }
    ]
  },
  "فردا موتورز": {
    name: "فردا موتورز",
    models: [
      {
        name: "FMC",
        variants: [
          { name: "FMC SX5", marketPrice: 1320, factoryPrice: 980 },
          { name: "FMC T5", marketPrice: 1700, factoryPrice: 1300 }
        ]
      },
      {
        name: "Suba",
        variants: [
          { name: "سوبا M4", marketPrice: 2250, factoryPrice: 1850 }
        ]
      }
    ]
  }
};

export const MOBILE_DB: MobileDatabase = {
  "Apple": {
    name: "اپل (Apple)",
    models: [
      { name: "iPhone 13 CH", price: 39.5, storage: "128GB" },
      { name: "iPhone 13 CH", price: 48.0, storage: "256GB" },
      { name: "iPhone 11 (استوک)", price: 24.0, storage: "128GB" }
    ]
  },
  "Samsung": {
    name: "سامسونگ (Samsung)",
    models: [
      { name: "Galaxy S24 Ultra", price: 72.0, storage: "256GB" },
      { name: "Galaxy S23 FE", price: 26.5, storage: "256GB" },
      { name: "Galaxy A55", price: 21.0, storage: "256GB" },
      { name: "Galaxy A35", price: 16.5, storage: "128GB" },
      { name: "Galaxy A15", price: 7.8, storage: "128GB" }
    ]
  },
  "Xiaomi": {
    name: "شیائومی (Xiaomi)",
    models: [
      { name: "Redmi Note 13 Pro+", price: 23.0, storage: "512GB" },
      { name: "Redmi Note 13 4G", price: 9.5, storage: "256GB" },
      { name: "Poco X6 Pro", price: 18.8, storage: "512GB" },
      { name: "Xiaomi 14T", price: 34.0, storage: "512GB" }
    ]
  }
};

export const YEARS = [1404, 1403, 1402, 1401, 1400, 1399, 1398, 1397, 1396, 1395, 1394, 1393, 1392, 1391, 1390];
export const COLORS = ["سفید", "مشکی", "نوک مدادی", "نقره ای", "سایر"];

// Real-world Iranian Market Depreciation Percentages
export const PAINT_CONDITIONS = [
  { label: "بدون رنگ (سالم)", drop: 0 },
  { label: "لیسه گیری / خط و خش جزئی", drop: 0.02 },
  { label: "یک لکه رنگ (گلگیر/درب)", drop: 0.04 },
  { label: "دو لکه رنگ", drop: 0.07 },
  { label: "یک درب/گلگیر تعویض", drop: 0.05 },
  { label: "دور رنگ", drop: 0.25 },
  { label: "سقف و ستون رنگ", drop: 0.40 }, // Heavy accident
  { label: "تمام رنگ", drop: 0.35 },
  { label: "تعویض اتاق (قانونی)", drop: 0.30 }
];
