import { PriceData, FuelPrice, PriceResponse } from "../models";
import Petrolimex from "./petrolimex";
import PVOil from "./pvoil";
import Telegram from "./telegram";

export async function fetchAllPrices(): Promise<PriceResponse> {
  const [petrolimex, pvoil, telegram] = await Promise.all([
    Petrolimex.scrapePetrolimex(),
    PVOil.scrapePVOil(),
    Telegram.scrapeTelegram()
  ]);

  return { petrolimex, pvoil, telegram };
}
