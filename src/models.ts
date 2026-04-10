export interface FuelPrice {
  name: string;
  price_zone1: string;
  price_zone2: string;
}

export interface PriceData {
  company: string;
  updated_at?: string;
  prices: FuelPrice[];
  error?: string;
}
export interface TelegramMessage {
  id: string;
  text: string;
  date: string;
}

export interface PriceResponse {
  petrolimex: PriceData;
  pvoil: PriceData;
  telegram: TelegramMessage[];
}