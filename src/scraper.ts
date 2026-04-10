import { PriceData, FuelPrice, PriceResponse } from "./models";

export async function fetchAllPrices(): Promise<PriceResponse> {
  const [petrolimex, pvoil] = await Promise.all([
    scrapePetrolimex(),
    scrapePVOil()
  ]);

  return { petrolimex, pvoil };
}

async function scrapePetrolimex(): Promise<PriceData> {
  const url = "https://portals.petrolimex.com.vn/~apis/portals/cms.item/search?object-identity=search&x-request=eyJGaWx0ZXJCeSI6eyJBbmQiOlt7IlN5c3RlbUlEIjp7IkVxdWFscyI6IjY3ODNkYzEyNzFmZjQ0OWU5NWI3NGE5NTIwOTY0MTY5In19LHsiUmVwb3NpdG9yeUlEIjp7IkVxdWFscyI6ImE5NTQ1MWUyM2I0NzRmZTU4ODZiZmI3Y2Y4NDNmNTNjIn19LHsiUmVwb3NpdG9yeUVudGl0eUlEIjp7IkVxdWFscyI6IjM4MDEzNzhmZTFlMDQ1YjFhZmExMGRlN2M1Nzc2MTI0In19LHsiU3RhdHVzIjp7IkVxdWFscyI6IlB1Ymxpc2hlZCJ9fV19LCJTb3J0QnkiOnsiTGFzdE1vZGlmaWVkIjoiRGVzY2VuZGluZyJ9LCJQYWdpbmF0aW9uIjp7IlRvdGFsUmVjb3JkcyI6LTEsIlRvdGFsUGFnZXMiOjAsIlBhZ2VTaXplIjowLCJQYWdlTnVtYmVyIjowfX0=";
  const data: PriceData = { company: "Petrolimex", prices: [] };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.petrolimex.com.vn",
        "Referer": "https://www.petrolimex.com.vn/"
      }
    });

    if (!res.ok) {
      data.error = `status code: ${res.status}`;
      return data;
    }

    const apiRes: any = await res.json();

    for (const item of apiRes.Objects || []) {
      if (item.Title && item.Zone1Price > 0) {
        data.prices.push({
          name: item.Title.trim(),
          price_zone1: formatPrice(item.Zone1Price),
          price_zone2: formatPrice(item.Zone2Price)
        });

        if (!data.updated_at && item.LastModified) {
          data.updated_at = item.LastModified;
        }
      }
    }

    if (data.prices.length === 0) data.error = "no prices extracted from API response";
  } catch (err: any) {
    data.error = `failed to fetch: ${err.message}`;
  }

  return data;
}

async function scrapePVOil(): Promise<PriceData> {
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

    // Extract update timestamp
    const dateMatch = html.match(/<h4[^>]*class="[^"]*sub-box-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
    if (dateMatch) {
      const text = dateMatch[1].replace(/<[^>]*>/g, '').trim();
      if (text.includes("Giá điều chỉnh") || text.includes("điều chỉnh")) {
        data.updated_at = text;
      }
    }

    // Extract prices using chunked Regex
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
            price_zone1: price
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

function formatPrice(price: number): string {
  const s = Math.floor(price).toString();
  if (s.length > 3) {
    return s.slice(0, -3) + "." + s.slice(-3);
  }
  return s;
}