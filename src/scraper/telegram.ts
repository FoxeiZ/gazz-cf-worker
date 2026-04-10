import { TelegramMessage } from "../models";

const scrapeTelegram = async () => {
  const url = `https://t.me/s/cuongtruewireless`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CloudflareWorker/1.0)" }
  });

  const messages: TelegramMessage[] = [];
  let currentMessage: Partial<TelegramMessage> = {};

  // Use HTMLRewriter to efficiently parse the stream
  const rewriter = new HTMLRewriter()
    .on(".tgme_widget_message", {
      element(el) {
        const dataId = el.getAttribute("data-post");
        if (dataId) {
          if (currentMessage.id) messages.push(currentMessage as TelegramMessage);
          currentMessage = { id: dataId, text: "" };
        }
      }
    })
    .on(".tgme_widget_message_text", {
      text(t) {
        currentMessage.text += t.text;
      }
    })
    .on(".tgme_widget_message_date time", {
      element(el) {
        currentMessage.date = el.getAttribute("datetime") || "";
      }
    });

  await rewriter.transform(response).arrayBuffer();
  if (currentMessage.id) messages.push(currentMessage as TelegramMessage);

  return messages;
}

export default { scrapeTelegram };