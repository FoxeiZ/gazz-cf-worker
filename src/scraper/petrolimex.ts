import { formatPrice } from "../helper";
import { PriceData } from "../models";

const scrapePetrolimex = async (): Promise<PriceData> => {
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

export default { scrapePetrolimex }