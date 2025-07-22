import { Bot, Keyboard } from "grammy";
import "dotenv/config";

const key = process.env.TELEGRAM_BOT_API_KEY;
if (!key) {
  throw new Error("Cannot find TELEGRAM_BOT_API_KEY");
}

const bot = new Bot(key);

const keyboard = new Keyboard().text("Отправить отчет").text("Авторизоваться");

bot.command("start", (ctx) => {
  ctx.reply("Это бот для сбора отчетов сотрудников с места работы", {
    reply_markup: keyboard,
  });
});

bot
  .on("message:text")
  .hears("Отправить отчет", (ctx) =>
    ctx.reply("Вы нажали на кнопку или ввели 'Отправить отчет'")
  );

bot
  .on("message:text")
  .hears("Авторизоваться", (ctx) =>
    ctx.reply("Вы нажали на кнопку или ввели 'Авторизоваться'")
  );

bot.on("message", (ctx) =>
  ctx.reply(
    "Этот бот умеет только принимать отчеты. Нажмите на кнопку или введите 'Отправить отчет'"
  )
);

bot.start();
