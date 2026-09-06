import { compare } from './pricing.mjs';
export type Quote = {
  id: string;
  currency: 'INR';
  pricePerPack: string;
  unitsPerPack: number;
  minimumQuantity: number;
  freight: string | null;
  tax: string | null;
  evidence: Record<string, { sourceId: string; quote: string }>;
};
export type Report = {
  id: string;
  mode: string;
  model: string;
  quantity: number;
  quotes: Quote[];
  comparison: ReturnType<typeof compare>;
  error?: string;
};
