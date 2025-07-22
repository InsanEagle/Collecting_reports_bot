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
  conversation.waitFor("callback_query:data").then(async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Отправка отчета отменена.");
    await conversation.halt();
  });

  const cancelConversationInlineKeyboard = new InlineKeyboard().text(
    "Отменить",
    "cancel_conversation"
  );

  let mediaContext;
  let firstCycleMedia = true;
  while (true) {
    if (firstCycleMedia) {
      firstCycleMedia = false;
      await ctx.reply("Отправьте фото или видео с вашего рабочего места", {
        reply_markup: cancelConversationInlineKeyboard,
      });
    }

    const receivedCtx = await conversation.waitFor("message");

    if (receivedCtx.has(":media")) {
      mediaContext = receivedCtx;
      break;
    } else {
      await ctx.reply(
        "Это не фото или видео. Пожалуйста, отправьте медиафайл."
      );
    }
  }

  const videoInfo = mediaContext.message?.video;
  const photoInfo = mediaContext.message?.photo?.slice(-1)[0];
  const mediaType = photoInfo || videoInfo;

  if (!mediaType) {
    await ctx.reply("Не удалось обработать медиа. Попробуйте еще раз.");
    return;
  }
  const hydratedFile = await ctx.api.getFile(mediaType.file_id);

  let message;
  let firstCycleDescription = true;
  while (true) {
    if (firstCycleDescription) {
      firstCycleDescription = false;
      await ctx.reply("Теперь пришлите текстовое описание", {
        reply_markup: cancelConversationInlineKeyboard,
      });
    }

    const receivedCtx = await conversation.waitFor("message");

    if (receivedCtx.has(":text")) {
      message = receivedCtx.message;
      break;
    } else {
      await ctx.reply("Это не текстовое описание. Пожалуйста, введите текст.");
    }
  }

  const isSaved = await conversation.external(
    async () => await saveReport(hydratedFile, message?.text, ctx?.from?.id)
  );
  if (isSaved) {
    ctx.reply("Файлы успешно сохранены");
  } else {
    ctx.reply("Произошла ошибка. Файлы не сохранены. Попробуйте еще раз");
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

async function saveReport(
  media: File & FileX,
  message: string | undefined,
  userID: number | undefined
): Promise<boolean> {
  if (!userID || !message) {
    return false;
  }
  const rootFolderPath = path.join(__dirname, "reports");
  try {
    if (!fs.existsSync(rootFolderPath)) {
      fs.mkdirSync(rootFolderPath);
      console.log(`Folder '${rootFolderPath}' created successfully.`);
    } else {
      console.log(`Folder '${rootFolderPath}' already exists.`);
    }
  } catch (err) {
    console.error(`Error creating folder: ${err}`);
  }

  const now = new Date();
  const currentDate = now.toLocaleDateString("ru-RU");
  const currentTime = now.toLocaleTimeString("ru-RU");
  const formattedTimeString = currentTime.replace(/:/g, "_");

  const userFolderPath = path.join(
    rootFolderPath,
    `${currentDate}_${formattedTimeString}_${String(userID)}`
  );
  try {
    if (!fs.existsSync(userFolderPath)) {
      fs.mkdirSync(userFolderPath);
      console.log(`Folder '${userFolderPath}' created successfully.`);
    } else {
      console.log(`Folder '${userFolderPath}' already exists.`);
    }
  } catch (err) {
    console.error(`Error creating folder: ${err}`);
  }

  try {
    if (!media.file_path) {
      console.log("Media has no file path");
      return false;
    }
    const fileName = path.basename(media.file_path);
    const destinationPath = path.join(userFolderPath, fileName);
    const mediaPath = await media.download(destinationPath);
    console.log(`Media '${mediaPath}' saved successfully.`);
  } catch (err) {
    console.error(`Error saving media: ${err}`);
    return false;
  }
  const name = "description";
  let descriptionPath = path.join(userFolderPath, `${name}.txt`);
  try {
    let count = 1;
    while (fs.existsSync(descriptionPath)) {
      descriptionPath = path.join(userFolderPath, `${name}_${count}.txt`);
      count += 1;
    }
  } catch (err) {
    console.error(`Error creating txt path photo: ${err}`);
    return false;
  }

  try {
    fs.writeFileSync(descriptionPath, message);
    console.log("File written successfully (synchronously).");
  } catch (err) {
    console.error("Error writing file:", err);
    return false;
  }

  return true;
}
