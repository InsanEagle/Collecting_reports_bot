import { Bot, Keyboard, Context, session, SessionFlavor } from "grammy";
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

bot.use(conversations());
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

bot
  .on("message:text")
  .hears(
    "Отправить отчет",
    async (ctx) => await ctx.conversation.enter("sendReport")
  );

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
  await ctx.reply("Отправьте фото с вашего рабочего места");
  const photoContext = await conversation.waitUntil(
    (ctx) => ctx.has(":photo"),
    {
      otherwise(ctx) {
        ctx.reply("Вы не отправили фото. Отправьте сначала фото");
      },
    }
  );
  const photoInfo = photoContext.message?.photo?.slice(-1)[0];
  if (!photoInfo) {
    await ctx.reply("Не удалось получить фото. Попробуйте еще раз.");
    return;
  }
  const hydratedFile = await ctx.api.getFile(photoInfo.file_id);

  await ctx.reply("Теперь пришлите текстовое описание");
  const { message } = await conversation.waitUntil(
    Context.has.filterQuery(":text"),
    {
      otherwise(ctx) {
        ctx.reply("Вы не отправили текстовое описание. Повторите ввод");
      },
    }
  );
  const isSaved = await conversation.external(
    async () => await saveReport(hydratedFile, message?.text, ctx?.from?.id)
  );
  if (isSaved) {
    ctx.reply("Файлы успешно сохранены");
  } else {
    ctx.reply("Произошла ошибка. Файлы не сохранены. Попробуйте еще раз");
  }
}

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

async function saveReport(
  photo: File & FileX,
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

  const userFolderPath = path.join(
    rootFolderPath,
    `${currentDate}_${String(userID)}`
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
    const fileName = path.basename(photo.file_path || "photo.jpg");
    const destinationPath = path.join(userFolderPath, fileName);
    const photoPath = await photo.download(destinationPath);
    console.log(`Photo '${photoPath}' saved successfully.`);
  } catch (err) {
    console.error(`Error saving photo: ${err}`);
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
  }

  try {
    fs.writeFileSync(descriptionPath, message);
    console.log("File written successfully (synchronously).");
  } catch (err) {
    console.error("Error writing file:", err);
  }

  return true;
}
