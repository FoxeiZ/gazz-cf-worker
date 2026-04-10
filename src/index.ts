import { fetchAllPrices } from "./scraper";

export interface Env {
  GAS_CACHE: KVNamespace;
  DISCORD_WEBHOOK_URL: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processPriceCheck(env));
  },
};

async function processPriceCheck(env: Env) {
  const currentData = await fetchAllPrices();
  const currentHash = JSON.stringify(currentData);
  
  const cachedHash = await env.GAS_CACHE.get("latest_price_hash");

  if (currentHash !== cachedHash) {
    await notifyDiscord(env.DISCORD_WEBHOOK_URL, currentData);
    await env.GAS_CACHE.put("latest_price_hash", currentHash);
  }
}

async function notifyDiscord(webhookUrl: string, data: any) {
  const payload = {
    content: "con me no gia xang thay doi",
    embeds: [
      {
        title: "Petrolimex",
        description: data.petrolimex.updated_at || "N/A",
        color: 16734296, // Orange
        fields: data.petrolimex.prices.map((p: any) => ({
          name: p.name,
          value: `Vùng 1: ${p.price_zone1} VND\nVùng 2: ${p.price_zone2} VND`,
          inline: true
        }))
      },
      {
        title: "PVOil",
        description: data.pvoil.updated_at || "N/A",
        color: 3447003, // Blue
        fields: data.pvoil.prices.map((p: any) => ({
          name: p.name,
          value: `Price: ${p.price_zone1} VND`,
          inline: true
        }))
      }
    ]
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}