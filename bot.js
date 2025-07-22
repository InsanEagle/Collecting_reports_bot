"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var grammy_1 = require("grammy");
var storage_file_1 = require("@grammyjs/storage-file");
var files_1 = require("@grammyjs/files");
var conversations_1 = require("@grammyjs/conversations");
require("dotenv/config");
var fs = require("fs");
var path = require("path");
var key = process.env.TELEGRAM_BOT_API_KEY;
if (!key) {
    throw new Error("Cannot find TELEGRAM_BOT_API_KEY");
}
var bot = new grammy_1.Bot(key);
bot.use((0, conversations_1.conversations)({
    storage: new storage_file_1.FileAdapter({
        dirName: "conversations",
    }),
}));
bot.api.config.use((0, files_1.hydrateFiles)(bot.token));
bot.use((0, grammy_1.session)({
    initial: function () { return ({ isAuthorized: false }); },
    storage: new storage_file_1.FileAdapter({
        dirName: "sessions",
    }),
}));
var keyboard = new grammy_1.Keyboard().text("Отправить отчет").text("Авторизоваться");
bot.api.setMyCommands([
    { command: "start", description: "Инициализация бота" },
    { command: "getid", description: "Узнать свой телеграм ID" },
]);
bot.use((0, conversations_1.createConversation)(sendReport, {
    plugins: [
        function (ctx, next) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.api.config.use((0, files_1.hydrateFiles)(bot.token));
                        return [4 /*yield*/, next()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    ],
}));
bot.command("start", function (ctx) {
    ctx.reply("Это бот для сбора отчетов сотрудников с места работы", {
        reply_markup: keyboard,
    });
});
bot.command("getid", function (ctx) { var _a; return ctx.reply("\u0412\u0430\u0448 \u0442\u0435\u043B\u0435\u0433\u0440\u0430\u043C ID: ".concat((_a = ctx === null || ctx === void 0 ? void 0 : ctx.from) === null || _a === void 0 ? void 0 : _a.id)); });
bot.on("message:text").hears("Отправить отчет", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!ctx.session.isAuthorized) return [3 /*break*/, 2];
                return [4 /*yield*/, ctx.conversation.enter("sendReport")];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                ctx.reply("Чтобы отправлять отчеты нужно быть авторизованным. Нажмите на кнопку или введите 'Авторизоваться'");
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
bot.on("message:text").hears("Авторизоваться", function (ctx) {
    if (ctx.session.isAuthorized) {
        ctx.reply("Вы уже авторизованы");
        return;
    }
    if (isUserInWhiteList(ctx.from.id)) {
        authorizeUser(ctx.session);
        ctx.reply("Вы успешно авторизованы");
    }
    else {
        ctx.reply("Не удалось авторизироваться. Вы не находитесь в списке разрешенных пользователей. Свяжитесь с поддержкой для решения данной проблемы");
    }
});
function sendReport(conversation, ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var cancelConversationInlineKeyboard, cancel, mediaContext, videoInfo, photoInfo, mediaType, hydratedFile, message, isSaved;
        var _this = this;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    cancelConversationInlineKeyboard = new grammy_1.InlineKeyboard().text("Отменить", "cancel_conversation");
                    return [4 /*yield*/, conversation.waitForCallbackQuery("cancel_conversation")];
                case 1:
                    cancel = _d.sent();
                    if (cancel) {
                        ctx.reply("Вы отменили диалог. Если захотите отправить отчет, нажмите на кнопку или введите 'Отправить отчет'");
                        conversation.halt();
                    }
                    return [4 /*yield*/, ctx.reply("Отправьте фото или видео с вашего рабочего места", {
                            reply_markup: cancelConversationInlineKeyboard,
                        })];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, conversation.waitUntil(function (ctx) { return ctx.has(":media"); }, {
                            otherwise: function (ctx) {
                                ctx.reply("Вы не отправили фото или видео. Отправьте сначала фото или видео", {
                                    reply_markup: cancelConversationInlineKeyboard,
                                });
                            },
                        })];
                case 3:
                    mediaContext = _d.sent();
                    videoInfo = (_a = mediaContext.message) === null || _a === void 0 ? void 0 : _a.video;
                    photoInfo = (_c = (_b = mediaContext.message) === null || _b === void 0 ? void 0 : _b.photo) === null || _c === void 0 ? void 0 : _c.slice(-1)[0];
                    mediaType = photoInfo || videoInfo;
                    if (!!mediaType) return [3 /*break*/, 5];
                    return [4 /*yield*/, ctx.reply("Не удалось получить фото или видео. Попробуйте еще раз.")];
                case 4:
                    _d.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, ctx.api.getFile(mediaType.file_id)];
                case 6:
                    hydratedFile = _d.sent();
                    return [4 /*yield*/, ctx.reply("Теперь пришлите текстовое описание")];
                case 7:
                    _d.sent();
                    return [4 /*yield*/, conversation.waitUntil(grammy_1.Context.has.filterQuery(":text"), {
                            otherwise: function (ctx) {
                                ctx.reply("Вы не отправили текстовое описание. Повторите ввод", {
                                    reply_markup: cancelConversationInlineKeyboard,
                                });
                            },
                        })];
                case 8:
                    message = (_d.sent()).message;
                    return [4 /*yield*/, conversation.external(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, saveReport(hydratedFile, message === null || message === void 0 ? void 0 : message.text, (_a = ctx === null || ctx === void 0 ? void 0 : ctx.from) === null || _a === void 0 ? void 0 : _a.id)];
                                case 1: return [2 /*return*/, _b.sent()];
                            }
                        }); }); })];
                case 9:
                    isSaved = _d.sent();
                    if (isSaved) {
                        ctx.reply("Файлы успешно сохранены");
                    }
                    else {
                        ctx.reply("Произошла ошибка. Файлы не сохранены. Попробуйте еще раз");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
bot.on("message", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var activeConversations;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, ctx.conversation.active()];
            case 1:
                activeConversations = _a.sent();
                if (Object.keys(activeConversations).length === 0) {
                    ctx.reply("Этот бот умеет только принимать отчеты. Нажмите на кнопку или введите 'Отправить отчет'");
                }
                return [2 /*return*/];
        }
    });
}); });
bot.catch(function (err) { return console.error(err); });
bot.start();
function isUserInWhiteList(userID) {
    try {
        var jsonString = fs.readFileSync("white_list.json", "utf-8");
        var users = JSON.parse(jsonString);
        if (users[userID]) {
            return true;
        }
        else {
            return false;
        }
    }
    catch (_a) {
        throw new Error("Error checking for user in white_list.json");
    }
}
function authorizeUser(session) {
    session.isAuthorized = true;
}
function saveReport(media, message, userID) {
    return __awaiter(this, void 0, void 0, function () {
        var rootFolderPath, now, currentDate, userFolderPath, fileName, destinationPath, mediaPath, err_1, name, descriptionPath, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!userID || !message) {
                        return [2 /*return*/, false];
                    }
                    rootFolderPath = path.join(__dirname, "reports");
                    try {
                        if (!fs.existsSync(rootFolderPath)) {
                            fs.mkdirSync(rootFolderPath);
                            console.log("Folder '".concat(rootFolderPath, "' created successfully."));
                        }
                        else {
                            console.log("Folder '".concat(rootFolderPath, "' already exists."));
                        }
                    }
                    catch (err) {
                        console.error("Error creating folder: ".concat(err));
                    }
                    now = new Date();
                    currentDate = now.toLocaleDateString("ru-RU");
                    userFolderPath = path.join(rootFolderPath, "".concat(currentDate, "_").concat(String(userID)));
                    try {
                        if (!fs.existsSync(userFolderPath)) {
                            fs.mkdirSync(userFolderPath);
                            console.log("Folder '".concat(userFolderPath, "' created successfully."));
                        }
                        else {
                            console.log("Folder '".concat(userFolderPath, "' already exists."));
                        }
                    }
                    catch (err) {
                        console.error("Error creating folder: ".concat(err));
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    if (!media.file_path) {
                        console.log("Media has no file path");
                        return [2 /*return*/, false];
                    }
                    fileName = path.basename(media.file_path);
                    destinationPath = path.join(userFolderPath, fileName);
                    return [4 /*yield*/, media.download(destinationPath)];
                case 2:
                    mediaPath = _a.sent();
                    console.log("Media '".concat(mediaPath, "' saved successfully."));
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error("Error saving media: ".concat(err_1));
                    return [2 /*return*/, false];
                case 4:
                    name = "description";
                    descriptionPath = path.join(userFolderPath, "".concat(name, ".txt"));
                    try {
                        count = 1;
                        while (fs.existsSync(descriptionPath)) {
                            descriptionPath = path.join(userFolderPath, "".concat(name, "_").concat(count, ".txt"));
                            count += 1;
                        }
                    }
                    catch (err) {
                        console.error("Error creating txt path photo: ".concat(err));
                        return [2 /*return*/, false];
                    }
                    try {
                        fs.writeFileSync(descriptionPath, message);
                        console.log("File written successfully (synchronously).");
                    }
                    catch (err) {
                        console.error("Error writing file:", err);
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
            }
        });
    });
}
