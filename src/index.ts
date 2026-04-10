import { fetchAllPrices } from "./scraper";

export interface Env {
  GAS_CACHE: KVNamespace;
  DISCORD_WEBHOOK_URL: string;
  IS_DEV?: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processPriceCheck(env));
  },
};

async function processPriceCheck(env: Env) {
  const isDev = env.IS_DEV === "true";
  const currentData = await fetchAllPrices();

  const petrolimexCached = await env.GAS_CACHE.get("petrolimex_data", { type: "json" }) as any;
  const pvoilCached = await env.GAS_CACHE.get("pvoil_data", { type: "json" }) as any;
  const petrolimexCurrentStr = JSON.stringify(currentData.petrolimex);
  const petrolimexCachedStr = JSON.stringify(petrolimexCached || {});
  const pvoilCurrentStr = JSON.stringify(currentData.pvoil);
  const pvoilCachedStr = JSON.stringify(pvoilCached || {});

  const petrolimexChanged = petrolimexCurrentStr !== petrolimexCachedStr;
  const pvoilChanged = pvoilCurrentStr !== pvoilCachedStr;

  const triggerPetrolimex = petrolimexChanged || isDev;
  const triggerPVOil = pvoilChanged || isDev;

  if (triggerPetrolimex || triggerPVOil) {
    await notifyDiscord(
      env.DISCORD_WEBHOOK_URL,
      currentData,
      { petrolimex: petrolimexCached, pvoil: pvoilCached },
      triggerPetrolimex,
      triggerPVOil,
      isDev
    );

    if (petrolimexChanged && !currentData.petrolimex.error) {
      await env.GAS_CACHE.put("petrolimex_data", petrolimexCurrentStr);
    }
    if (pvoilChanged && !currentData.pvoil.error) {
      await env.GAS_CACHE.put("pvoil_data", pvoilCurrentStr);
    }
  }
}

function getTrendIndicator(newPriceStr?: string, oldPriceStr?: string): string {
  if (!newPriceStr || !oldPriceStr) return "";

  const newP = parseInt(newPriceStr.replace(/\./g, ''), 10);
  const oldP = parseInt(oldPriceStr.replace(/\./g, ''), 10);

  if (isNaN(newP) || isNaN(oldP) || newP === oldP) return "";

  const diff = newP - oldP;
  if (diff > 0) return ` 📈 (+${diff.toLocaleString('vi-VN')})`;
  if (diff < 0) return ` 📉 (${diff.toLocaleString('vi-VN')})`;
  return "";
}

async function notifyDiscord(
  webhookUrl: string,
  newData: any,
  oldData: any,
  triggerPetrolimex: boolean,
  triggerPVOil: boolean,
  isDev: boolean
) {
  const embeds = [];

  if (triggerPetrolimex && !newData.petrolimex.error) {
    embeds.push({
      title: "Petrolimex",
      description: newData.petrolimex.updated_at || "N/A",
      color: 16734296,
      fields: newData.petrolimex.prices.map((newFuel: any) => {
        const oldFuel = oldData.petrolimex?.prices?.find((p: any) => p.name === newFuel.name);
        const trend1 = getTrendIndicator(newFuel.price_zone1, oldFuel?.price_zone1);
        const trend2 = getTrendIndicator(newFuel.price_zone2, oldFuel?.price_zone2);

        return {
          name: newFuel.name,
          value: `Vùng 1: ${newFuel.price_zone1} đ${trend1}\nVùng 2: ${newFuel.price_zone2 || "N/A"} đ${newFuel.price_zone2 ? trend2 : ""}`,
          inline: true
        };
      })
    });
  }

  if (triggerPVOil && !newData.pvoil.error) {
    embeds.push({
      title: "PVOil",
      description: newData.pvoil.updated_at || "N/A",
      color: 3447003,
      fields: newData.pvoil.prices.map((newFuel: any) => {
        const oldFuel = oldData.pvoil?.prices?.find((p: any) => p.name === newFuel.name);
        const trend1 = getTrendIndicator(newFuel.price_zone1, oldFuel?.price_zone1);

        return {
          name: newFuel.name,
          value: `${newFuel.price_zone1} đ${trend1}`,
          inline: true
        };
      })
    });
  }

  if (embeds.length === 0) return;

  const titles = [
    "huu duyen",
    "xang dau thay doi roi nhe",
    "con me no gia xang thay doi roi"
  ];
  let randomTitle = titles[Math.floor(Math.random() * titles.length)];
  if (isDev) {
    randomTitle = "[dev] " + randomTitle;
  }

  const payload = {
    content: randomTitle,
    embeds: embeds
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}