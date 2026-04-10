import { PriceData } from "../models";

const scrapePVOil = async (): Promise<PriceData> => {
  const url = "https://www.pvoil.com.vn/";
  const data: PriceData = { company: "PVOil", prices: [] };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
      }
    });

    if (!res.ok) {
      data.error = `status code: ${res.status}`;
      return data;
    }

    const html = await res.text();
    const dateMatch = html.match(/<h4[^>]*class="[^"]*sub-box-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
    if (dateMatch) {
      const text = dateMatch[1].replace(/<[^>]*>/g, '').trim();
      if (text.includes("Giá điều chỉnh") || text.includes("điều chỉnh")) {
        data.updated_at = text;
      }
    }
    const blockRegex = /<a[^>]*class="[^"]*gasoline-price-item[^"]*"[\s\S]*?<\/a>/g;
    const nameRegex = /<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/;
    const priceRegex = /<span[^>]*class="[^"]*count[^"]*"[^>]*>([\s\S]*?)<\/span>/;

    let match;
    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[0];
      const nameMatch = block.match(nameRegex);
      const priceMatch = block.match(priceRegex);

      if (nameMatch && priceMatch) {
        const name = nameMatch[1].trim();
        let price = priceMatch[1].replace(/đ/g, "").trim();

        if (name !== "" && price !== "") {
          data.prices.push({
            name,
            price_zone1: price,
            price_zone2: "",
          });
        }
      }
    }

    if (data.prices.length === 0) data.error = "no prices extracted from page";
  } catch (err: any) {
    data.error = `failed to fetch: ${err.message}`;
  }

  return data;
}

export default { scrapePVOil }