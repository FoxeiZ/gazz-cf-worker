import { PriceResponse, TelegramMessage } from './models';
import { fetchAllPrices } from './scraper';
import { cloneDeep } from 'lodash';

export interface Env {
	GAS_CACHE: KVNamespace;
	DISCORD_WEBHOOK_URL: string;
	IS_DEV?: string;
	TITLE_PREFIX?: string;
	TITLE_SUFFIX?: string;
}

export class GasPriceChecker {
	async processCheck(env: Env) {
		const isDev = env.IS_DEV === 'true';
		let currentData = await fetchAllPrices();

		if (isDev) {
			currentData = this.simulateDevPriceChanges(currentData);
		}

		const petrolimexCached = (await env.GAS_CACHE.get('petrolimex_data', { type: 'json' })) as any;
		const pvoilCached = (await env.GAS_CACHE.get('pvoil_data', { type: 'json' })) as any;
		const telegramCached = (await env.GAS_CACHE.get('telegram_data', { type: 'json' })) as any;

		const petrolimexCurrentStr = JSON.stringify(currentData.petrolimex);
		const petrolimexCachedStr = JSON.stringify(petrolimexCached || {});
		const pvoilCurrentStr = JSON.stringify(currentData.pvoil);
		const pvoilCachedStr = JSON.stringify(pvoilCached || {});

		const differentTelegramMessages = this.getDifferentTelegramMessages(currentData.telegram, telegramCached || []);

		const isTelegramChange = differentTelegramMessages.length > 0;
		const petrolimexChanged = petrolimexCurrentStr !== petrolimexCachedStr;
		const pvoilChanged = pvoilCurrentStr !== pvoilCachedStr;

		const triggerPetrolimex = petrolimexChanged || isDev;
		const triggerPVOil = pvoilChanged || isDev;

		if (triggerPetrolimex || triggerPVOil || isTelegramChange) {
			await this.notifyDiscord({
				webhookUrl: env.DISCORD_WEBHOOK_URL,
				newData: currentData,
				oldData: { petrolimex: petrolimexCached, pvoil: pvoilCached },
				triggerPetrolimex,
				triggerPVOil,
				isDev,
				titlePrefix: env.TITLE_PREFIX,
				titleSuffix: env.TITLE_SUFFIX,
				isTelegramChange,
				differentTelegramMessages,
			});

			if (!isDev) {
				if (petrolimexChanged && !currentData.petrolimex.error) {
					await env.GAS_CACHE.put('petrolimex_data', petrolimexCurrentStr);
				}
				if (pvoilChanged && !currentData.pvoil.error) {
					await env.GAS_CACHE.put('pvoil_data', pvoilCurrentStr);
				}
				if (isTelegramChange) {
					await env.GAS_CACHE.put('telegram_data', JSON.stringify(currentData.telegram.map((message) => message.id)));
				}
			}
		}
	}

	private getTrendIndicator(newPriceStr?: string, oldPriceStr?: string): string {
		if (!newPriceStr || !oldPriceStr) return '';

		const newP = parseInt(newPriceStr.replace(/\./g, ''), 10);
		const oldP = parseInt(oldPriceStr.replace(/\./g, ''), 10);

		if (isNaN(newP) || isNaN(oldP) || newP === oldP) return '';

		const diff = newP - oldP;
		if (diff > 0) return ` 📈 (+${diff.toLocaleString('vi-VN')})`;
		if (diff < 0) return ` 📉 (${diff.toLocaleString('vi-VN')})`;
		return '';
	}

	private parsePetrolimexDate(dateStr?: string): number | null {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return null;
		return Math.floor(date.getTime() / 1000);
	}

	private getPetrolimexEmbed(newData: any, oldData: any): any {
		const ts = this.parsePetrolimexDate(newData.petrolimex.updated_at);
		const desc = ts ? `Cập nhật: <t:${ts}:f> (<t:${ts}:R>)` : newData.petrolimex.updated_at || 'N/A';

		return {
			title: 'Petrolimex',
			description: desc,
			color: 16734296,
			fields: newData.petrolimex.prices.map((newFuel: any) => {
				const oldFuel = oldData.petrolimex?.prices?.find((p: any) => p.name === newFuel.name);
				const trend1 = this.getTrendIndicator(newFuel.price_zone1, oldFuel?.price_zone1);
				const trend2 = this.getTrendIndicator(newFuel.price_zone2, oldFuel?.price_zone2);

				return {
					name: newFuel.name,
					value: `Vùng 1: ${newFuel.price_zone1} đ${trend1}\nVùng 2: ${newFuel.price_zone2 || 'N/A'} đ${newFuel.price_zone2 ? trend2 : ''}`,
					inline: true,
				};
			}),
		};
	}

	private parsePVOilDate(dateStr?: string): number | null {
		if (!dateStr) return null;

		const match = dateStr.match(/(\d{2}:\d{2})\s*ngày\s*(\d{2})\/(\d{2})\/(\d{4})/);
		if (!match) return null;

		const time = match[1];
		const day = match[2];
		const month = match[3];
		const year = match[4];

		const isoStr = `${year}-${month}-${day}T${time}:00+07:00`;
		const date = new Date(isoStr);

		if (isNaN(date.getTime())) return null;
		return Math.floor(date.getTime() / 1000);
	}

	private getPVOilEmbed(newData: any, oldData: any): any {
		const ts = this.parsePVOilDate(newData.pvoil.updated_at);
		const desc = ts ? `Cập nhật: <t:${ts}:f> (<t:${ts}:R>)` : newData.pvoil.updated_at || 'N/A';

		return {
			title: 'PVOil',
			description: desc,
			color: 3447003,
			fields: newData.pvoil.prices.map((newFuel: any) => {
				const oldFuel = oldData.pvoil?.prices?.find((p: any) => p.name === newFuel.name);
				const trend1 = this.getTrendIndicator(newFuel.price_zone1, oldFuel?.price_zone1);

				return {
					name: newFuel.name,
					value: `Price: ${newFuel.price_zone1} đ${trend1}`,
					inline: true,
				};
			}),
		};
	}

	async notifyDiscord({
		webhookUrl,
		newData,
		oldData,
		triggerPetrolimex,
		triggerPVOil,
		isDev,
		titlePrefix,
		titleSuffix,
		isTelegramChange,
		differentTelegramMessages,
	}: {
		webhookUrl: string;
		newData: any;
		oldData: any;
		triggerPetrolimex: boolean;
		triggerPVOil: boolean;
		isDev: boolean;
		titlePrefix?: string;
		titleSuffix?: string;
		isTelegramChange: boolean;
		differentTelegramMessages: TelegramMessage[];
	}) {
		const embeds = [];

		if (triggerPetrolimex && !newData.petrolimex.error) {
			embeds.push(this.getPetrolimexEmbed(newData, oldData));
		}

		if (triggerPVOil && !newData.pvoil.error) {
			embeds.push(this.getPVOilEmbed(newData, oldData));
		}

		if (isTelegramChange) {
			const ts = Math.floor(new Date(differentTelegramMessages[0].date).getTime() / 1000);
			embeds.push({
				title: 'Hữu duyên',
				description: `Có ${differentTelegramMessages.length} tin nhắn mới, cập nhật: <t:${ts}:f> (<t:${ts}:R>)`,
				color: 42069,
				fields: differentTelegramMessages.map((message: TelegramMessage) => {
					return {
						name: 'Chủ tịch',
						value: `${message.text} <t:${new Date(message.date).getTime() / 1000}:R>`,
					};
				}),
			});
		} else {
			embeds.push({
				title: 'Không hữu duyên rr chủ tịch ơi',
				description: '',
				color: 13376026,
			});
		}

		if (embeds.length === 0) return;

		let title = 'Tin nóng nằm vùng';

		if (isDev) {
			title = '[dev] ' + title;
		}

		const prefix = titlePrefix ? `${titlePrefix} ` : '';
		const suffix = titleSuffix ? ` ${titleSuffix}` : '';
		const finalContent = `${prefix}${title}${suffix}`;

		const payload = {
			content: finalContent,
			embeds: embeds,
		};

		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
	}

	simulateDevPriceChanges(data: PriceResponse) {
		const cloned = cloneDeep(data);

		const modifyPrice = (priceStr: string) => {
			if (!priceStr) return priceStr;
			let p = parseInt(priceStr.replace(/\./g, ''), 10);
			if (isNaN(p)) return priceStr;

			const delta = (Math.floor(Math.random() * 10) + 1) * 100;
			const sign = Math.random() > 0.5 ? 1 : -1;
			p += delta * sign;

			const s = p.toString();
			return s.length > 3 ? s.slice(0, -3) + '.' + s.slice(-3) : s;
		};

		if (cloned.petrolimex?.prices?.length > 0) {
			cloned.petrolimex.prices[0].price_zone1 = modifyPrice(cloned.petrolimex.prices[0].price_zone1);
			cloned.petrolimex.prices[0].price_zone2 = modifyPrice(cloned.petrolimex.prices[0].price_zone2);
		}

		if (cloned.pvoil?.prices?.length > 0) {
			cloned.pvoil.prices[0].price_zone1 = modifyPrice(cloned.pvoil.prices[0].price_zone1);
		}

		return cloned;
	}

	private getDifferentTelegramMessages(messages: TelegramMessage[], cachedMessages: string[]) {
		const newMessages = messages.filter((message) => !cachedMessages.includes(message.id));
		const newLatestMessage = newMessages.filter((message) => new Date(message.date).getTime() > Date.now() - 1000 * 60 * 60 * 1);
		return newLatestMessage;
	}
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const gasPriceChecker = new GasPriceChecker();
		ctx.waitUntil(gasPriceChecker.processCheck(env));
	},
};
