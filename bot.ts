import { Bot, Keyboard, Context, session, SessionFlavor } from "grammy";
import { FileAdapter } from "@grammyjs/storage-file";
import "dotenv/config";
import * as fs from "fs";

const key = process.env.TELEGRAM_BOT_API_KEY;
if (!key) {
  throw new Error("Cannot find TELEGRAM_BOT_API_KEY");
}

interface SessionData {
  isAuthorized: boolean;
}
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(key);

bot.use(
  session({
    initial: () => ({ isAuthorized: false }),
    storage: new FileAdapter({
      dirName: "sessions",
    }),
  })
);

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

bot.on("message:text").hears("Авторизоваться", (ctx) => {
  if (ctx.session.isAuthorized) {
    ctx.reply("Вы уже авторизованы");
    return;
  }
  if (isUserInWhiteList(ctx.from.id)) {
    authorizeUser(ctx.session);
  } else {
    ctx.reply(
      "Не удалось авторизироваться. Вы не находитесь в списке разрешенных пользователей. Свяжитесь с поддержкой для решения данной проблемы"
    );
  }
});

bot.on("message", (ctx) =>
  ctx.reply(
    "Этот бот умеет только принимать отчеты. Нажмите на кнопку или введите 'Отправить отчет'"
  )
);

bot.catch((err) => console.error(err));
bot.start();

function isUserInWhiteList(userID: number): boolean {
  try {
    const jsonString = fs.readFileSync("white_list.json", "utf-8");
    const users = JSON.parse(jsonString);
    if (users[userID]) {
      return true;
    } else {
      return false;
    }
  } catch {
    throw new Error("Error checking for user in white_list.json");
  }
}

function authorizeUser(session: SessionData): void {
  session.isAuthorized = true;
}
