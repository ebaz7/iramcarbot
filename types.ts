export interface CarVariant {
  name: string;
  marketPrice: number; // In millions of Tomans
  factoryPrice: number; // In millions of Tomans
  lastUpdate?: string;
}

export interface CarModel {
  name: string;
  variants: CarVariant[];
}

export interface CarBrand {
  name: string;
  models: CarModel[];
}

export interface CarDatabase {
  [brand: string]: CarBrand;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  buttons?: InlineButton[][];
}

export interface InlineButton {
  text: string;
  callbackData?: string;
  webAppUrl?: string; // New field for Web App
  url?: string;       // New field for external links
}

export enum BotState {
  IDLE,
  BROWSING_BRANDS,
  BROWSING_MODELS,
  BROWSING_VARIANTS,
  ESTIMATING_BRAND,
  ESTIMATING_MODEL,
  ESTIMATING_YEAR,
  ESTIMATING_MILEAGE,
  ESTIMATING_PAINT,
  SEARCHING,
  // Support State
  SUPPORT_MESSAGE,
  // Admin States
  ADMIN_BROADCAST_TYPE,
  ADMIN_BROADCAST_TIME,
  ADMIN_BROADCAST_CONTENT,
  ADMIN_MANAGE_ADD
}

export interface EstimateData {
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  color?: string;
  paintCondition?: string;
}