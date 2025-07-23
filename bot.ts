import {
  Bot,
  Keyboard,
  InlineKeyboard,
  Context,
  session,
  SessionFlavor,
} from "grammy";
import { FileAdapter } from "@grammyjs/storage-file";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { type File } from "@grammyjs/types";
import { type FileX } from "@grammyjs/files/out/files";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

import { appendValues } from "./google_api/sheets/sheets.js";

const key = process.env.TELEGRAM_BOT_API_KEY;
if (!key) {
  throw new Error("Cannot find TELEGRAM_BOT_API_KEY");
}

interface SessionData {
  isAuthorized: boolean;
}
type MyContext = ConversationFlavor<Context> & SessionFlavor<SessionData>;
type MyConversationContext = FileFlavor<Context>;

type MyConversation = Conversation<MyContext, MyConversationContext>;

const bot = new Bot<MyContext>(key);

bot.use(
  conversations({
    storage: new FileAdapter({
      dirName: "conversations",
    }),
  })
);
bot.api.config.use(hydrateFiles(bot.token));

bot.use(
  session({
    initial: () => ({ isAuthorized: false }),
    storage: new FileAdapter({
      dirName: "sessions",
    }),
  })
);

const keyboard = new Keyboard().text("Отправить отчет").text("Авторизоваться");

bot.api.setMyCommands([
  { command: "start", description: "Инициализация бота" },
  { command: "getid", description: "Узнать свой телеграм ID" },
]);

bot.use(
  createConversation(sendReport, {
    plugins: [
      async (ctx, next) => {
        ctx.api.config.use(hydrateFiles(bot.token));
        await next();
      },
    ],
  })
);

bot.command("start", (ctx) => {
  ctx.reply("Это бот для сбора отчетов сотрудников с места работы", {
    reply_markup: keyboard,
  });
});

bot.command("getid", (ctx) => ctx.reply(`Ваш телеграм ID: ${ctx?.from?.id}`));

bot.on("message:text").hears("Отправить отчет", async (ctx) => {
  if (ctx.session.isAuthorized) {
    await ctx.conversation.enter("sendReport");
  } else {
    ctx.reply(
      "Чтобы отправлять отчеты нужно быть авторизованным. Нажмите на кнопку или введите 'Авторизоваться'"
    );
  }
});

bot.on("message:text").hears("Авторизоваться", (ctx) => {
  if (ctx.session.isAuthorized) {
    ctx.reply("Вы уже авторизованы");
    return;
  }
  if (isUserInWhiteList(ctx.from.id)) {
    authorizeUser(ctx.session);
    ctx.reply("Вы успешно авторизованы");
  } else {
    ctx.reply(
      "Не удалось авторизироваться. Вы не находитесь в списке разрешенных пользователей. Свяжитесь с поддержкой для решения данной проблемы"
    );
  }
});

async function sendReport(
  conversation: MyConversation,
  ctx: MyConversationContext
) {
  const cancelConversationInlineKeyboard = new InlineKeyboard().text(
    "Отменить",
    "cancel_conversation"
  );

  const doneAndCancelConversationInlineKeyboard = new InlineKeyboard()
    .text("Завершить", "done_conversation")
    .row()
    .text("Отменить", "cancel_conversation");

  const collectedMedia: (File & FileX)[] = [];
  let gotMedia = false;

  await ctx.reply(
    "Шаг 1 из 2: Отправьте фото или видео с вашего рабочего места. Можно отправить несколько файлов. Когда закончите, нажмите 'Завершить'.",
    {
      reply_markup: doneAndCancelConversationInlineKeyboard,
    }
  );

  while (true) {
    const latestCtx = await conversation.wait();

    if (latestCtx.callbackQuery) {
      const queryData = latestCtx.callbackQuery.data;

      if (queryData === "cancel_conversation") {
        await latestCtx.answerCallbackQuery();
        await latestCtx.editMessageText("Отправка отчета отменена.");
        return;
      }

      if (queryData === "done_conversation") {
        await latestCtx.answerCallbackQuery();
        if (!gotMedia) {
          await latestCtx.reply(
            "Вы не отправили ни одного медиафайла. Пожалуйста, отправьте хотя бы один, прежде чем завершать.",
            { reply_markup: doneAndCancelConversationInlineKeyboard }
          );
          continue;
        } else {
          await latestCtx.editMessageText("Медиафайлы приняты.");
          break;
        }
      }
    } else if (latestCtx.message?.photo || latestCtx.message?.video) {
      gotMedia = true;
      const file = await latestCtx.getFile();
      collectedMedia.push(file);

      await latestCtx.reply(
        "Файл принят. Можете отправить еще или нажать 'Завершить'.",
        {
          reply_markup: doneAndCancelConversationInlineKeyboard,
        }
      );
    } else {
      await latestCtx.reply(
        "Это не медиафайл. Пожалуйста, отправьте фото или видео. Если хотите закончить, нажмите 'Завершить'.",
        {
          reply_markup: doneAndCancelConversationInlineKeyboard,
        }
      );
    }
  }

  if (collectedMedia.length === 0) {
    await ctx.reply(
      "Не было отправлено ни одного медиафайла. Отправка отчета отменена."
    );
    return;
  }

  await ctx.reply(
    "Шаг 2 из 2: Теперь пришлите текстовое описание к вашему отчету.",
    {
      reply_markup: cancelConversationInlineKeyboard,
    }
  );

  let descriptionMessage: string | undefined;

  while (true) {
    const descCtx = await conversation.wait();

    if (descCtx.callbackQuery?.data === "cancel_conversation") {
      await descCtx.answerCallbackQuery();
      await descCtx.editMessageText("Отправка отчета отменена.");
      return;
    }

    if (descCtx.message?.text) {
      descriptionMessage = descCtx.message.text;
      break;
    } else {
      await descCtx.reply("Пожалуйста, пришлите текстовое описание.", {
        reply_markup: cancelConversationInlineKeyboard,
      });
    }
  }

  await ctx.reply("Спасибо! Сохраняю ваш отчет...");
  const isSaved = await conversation.external(() =>
    saveFullReport(collectedMedia, descriptionMessage, ctx?.from?.id)
  );

  if (isSaved) {
    ctx.reply("Отчет успешно сохранен и отправлен!");
  } else {
    ctx.reply(
      "Произошла ошибка при сохранении. Файлы не сохранены. Попробуйте еще раз."
    );
  }
}

bot.on("message", async (ctx) => {
  const activeConversations = await ctx.conversation.active();

  if (Object.keys(activeConversations).length === 0) {
    ctx.reply(
      "Этот бот умеет только принимать отчеты. Нажмите на кнопку или введите 'Отправить отчет'"
    );
  }
});

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

async function saveFullReport(
  mediaArray: (File & FileX)[],
  message: string | undefined,
  userID: number | undefined
): Promise<boolean> {
  if (!userID || !message || mediaArray.length === 0) {
    return false;
  }

  const rootFolderPath = path.join(__dirname, "reports");
  try {
    if (!fs.existsSync(rootFolderPath)) {
      fs.mkdirSync(rootFolderPath, { recursive: true });
    }
  } catch (err) {
    console.error(`Error creating root folder: ${err}`);
    return false;
  }

  const now = new Date();
  const currentDate = now.toLocaleDateString("ru-RU");
  const currentTime = now.toLocaleTimeString("ru-RU").replace(/:/g, "_");
  const reportFolderPath = path.join(
    rootFolderPath,
    `${currentDate}_${currentTime}_${String(userID)}`
  );

  try {
    fs.mkdirSync(reportFolderPath, { recursive: true });
    console.log(`Report folder '${reportFolderPath}' created successfully.`);
  } catch (err) {
    console.error(`Error creating report folder: ${err}`);
    return false;
  }

  try {
    for (const media of mediaArray) {
      if (!media.file_path) continue;
      const fileName = path.basename(media.file_path);
      const destinationPath = path.join(reportFolderPath, fileName);
      await media.download(destinationPath);
      console.log(`Media '${fileName}' saved successfully.`);
    }
  } catch (err) {
    console.error(`Error saving media files: ${err}`);
    return false;
  }

  try {
    const descriptionPath = path.join(reportFolderPath, "description.txt");
    fs.writeFileSync(descriptionPath, message);
    console.log("Description file written successfully.");
  } catch (err) {
    console.error("Error writing description file:", err);
    return false;
  }

  try {
    const data = [[currentDate, userID, message, reportFolderPath]];
    await appendValues(data);
    console.log("Data successfully added to Google Sheet");
  } catch (err) {
    console.error("Error adding data to Google Sheet:", err);
    return false;
  }

  return true;
}
