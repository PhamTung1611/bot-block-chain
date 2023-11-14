import { Inject, Injectable } from '@nestjs/common';
import {
  session, Markup, Telegraf, Context
} from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletStatus } from 'src/wallet/enum/wallet.status.enum';
import { Button } from './enum/button.enum';
import { Action } from './enum/action.enum';
import { TransactionStatus } from 'src/transaction/enum/transaction.enum';
import { ConfigService } from '@nestjs/config';
import { format } from 'date-fns'
import { Api } from "telegram/tl"
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import { botCommand } from 'src/constants/commands/telegram.commands';
import { sleep } from 'telegram/Helpers';
import { Update, User } from 'telegraf/typings/core/types/typegram';
import { Any } from 'typeorm';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { Wallet } from 'ethers';

interface DataCache {
  action: string;
  step: number;
  money: string;
  receiver?: string;
  sender?: string;
  msg?: any[];
}
interface UserInfo {
  userId: number,
  username: string,
  text: string,
}
@Injectable()
export class
  TelegramService {
  // Create an array to store messages for each user
  private startInstances: Map<number, any[]> = new Map();
  private tokenInstances: Map<number, any[]> = new Map();
  private processMessages: Map<number, any> = new Map();
  private apiId = Number(this.configService.get('api_id'));
  private apiHash = this.configService.get('api_hash');
  private stringSession = new StringSession(this.configService.get('string_session'));
  //connect to Telegram bot
  private bot = new Telegraf(this.configService.get('bot_token'));

  private keyboardMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback('Deposit', Button.DEPOSIT),
      Markup.button.callback('Withdraw', Button.WITHDRAW),
      Markup.button.callback('Transfer', Button.WALLET_ADDRESS),
    ],
    [
      Markup.button.callback('Transaction History', Button.HISTORY),
      Markup.button.callback('Private Key', Button.PK),
      Markup.button.callback('Replace Wallet', Button.REPLACE_WALLET),
    ],
  ]);

  private keyCreateAccount = Markup.inlineKeyboard([
    [Markup.button.callback('Create Wallet', Button.CREATE),
    Markup.button.callback('Import Wallet', Button.IMPORT),
    ]
  ]);
  private tokens = Markup.inlineKeyboard([
    [Markup.button.callback('HUSD', Button.HUSD),
    Markup.button.callback('MTK', Button.MTK)],

  ]);
  private deleteButton = Markup.inlineKeyboard([
    [Markup.button.callback('Delete Message', Button.DELETE)],
  ]);
  private keyTransferMethod = Markup.inlineKeyboard([
    [Markup.button.callback('Wallet address', Button.WALLET_ADDRESS)],
    [Markup.button.callback('Cancel', Button.CANCEL)],
  ]);
  private forgotPassword = Markup.inlineKeyboard([
    [Markup.button.callback('Forgot Password', Button.FORGOT_PASSWORD)],
  ])
  constructor(
    private transactionService: TransactionService,
    private walletService: WalletService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.bot.use(session({ defaultSession: () => ({ count: 0 }) }));
    this.bot.start(this.handleStart.bind(this));
    this.bot.on('text', this.handleMessage.bind(this));
    this.bot.action(/.*/, this.handleButton.bind(this));
    this.bot.telegram.setMyCommands(botCommand);
    this.bot.launch();

  }
  //Use to indentify type
  identify<Type>(arg: Type): Type {
    return arg;
  }
  async handleStart(ctx: Context) {
    const userInfo = {
      userId: ctx.message?.from.id || ctx.callbackQuery?.from.id,
      username: ctx.message?.from.first_name || ctx.callbackQuery?.from.first_name,
    };
    const checkUser = await this.walletService.findOneUser(userInfo.userId.toString());
    if (!checkUser) {
      await ctx.replyWithHTML(
        `Xin chào <a href="tg://user?id=${userInfo.userId}">@${userInfo.username}</a> ! Hãy chọn hành động tạo ví mới hoặc import ví của bạn để tiếp tục !`,
        this.keyCreateAccount,
      );
    } else {
      const balance = await this.walletService.getBalance(checkUser.address)
      const nativeToken = await this.walletService.getUserNativeToken(checkUser.address)
      const message = await ctx.replyWithHTML(`Xin chào <a href="tg://user?id=${userInfo.userId}">@${userInfo.username}</a>!!\n💳Địa chỉ wallet!\n<code>${checkUser.address}</code>\n
🪙Token Balance:<b> ${balance} ${checkUser.currentSelectToken}</b>\n     
💰Hiện Tài khoản bạn đang có:<b> ${nativeToken} PGX </b>\n
📊Theo dõi giao dịch <a href="https://testnet.miraiscan.io"><u>click here</u>!</a>\n 
🎟️Nạp thêm <b>PGX</b> <a href="https://faucet.miraichain.io/"><u>click here</u>!</a>`, this.keyboardMarkup);
      const startInstances = this.startInstances.get(userInfo.userId) || [];
      startInstances.push(message);
      if (startInstances.length > 1) {
        startInstances.reverse();
        await this.deleteBotMessage(startInstances[1], 0);
        startInstances.pop();
        console.log(`Delete start instance of user ${userInfo.userId}`);
      }
      this.startInstances.set(userInfo.userId, startInstances);
    }
  }

  async handleMessage(msg: Context<Update>) {
    const userInfo = {
      userId: msg.message.from.id,
      username: msg.message.from.first_name,
      text: Object(msg.message).text,
    };
    const data: DataCache = await this.cacheManager.get(userInfo.userId.toString());
    if (data) {
      return await this.handleUserAction(msg, userInfo, data);
    }
    return await this.handleUserCommands(msg, userInfo, data);

  }
  async handleUserCommands(msg: Context, userInfo: UserInfo, data: DataCache) {
    switch (userInfo.text) {
      case '/clear':
        try {
          return await this.deleteHistory(msg);
        } catch (err) {
          return await msg.reply('some thing went wrong');
        }
      case '/info':
        return await msg.replyWithHTML('This is a telegram bot project that helps you manage your personal digital wallet.\n \nIt currently interacts with <a href="https://testnet.miraiscan.io"><u>Mirai blockchain network</u></a><b>(Currently in  development)</b>');
      case '/help':
        const helpMessage = await msg.reply(`Commands List:
        /start - Connect the bot to your blockchain Wallet
        /clear - Delete all history (development only)
        /info -information of the bot
        /cancel - Cancel current Action
        /token - Change bot supported token 
        /help - Show bot Commands help`, this.deleteButton);
        const messageId = msg.message.message_id + 1;
        this.processMessages.set(messageId, helpMessage);
        break;
      case '/token':
        await this.handleToken(msg, userInfo, data);
        break;
      case '/cancel':
        const message = await msg.reply(`Đang không thực hiện hành động nào`);
        this.deleteBotMessage(message, 5000);
        break;
      default:
        const finalMessage = await msg.reply('Xin lỗi, tôi không hiểu. Vui lòng thử lại');
        return this.deleteBotMessage(finalMessage, 5000);
    }
  }
  async handleToken(msg: Context, userInfo: UserInfo, data: DataCache) {
    const user = await this.walletService.findOneUser(userInfo.userId.toString());
    if ((!user)) {
      const message = await msg.reply('you have no wallet at the moment !');
      await this.deleteBotMessage(message, 5000);
      return;
    }
    const tokenMenu = await msg.reply(`Current using ${user.currentSelectToken} token`, this.tokens);
    const tokenInstances = this.tokenInstances.get(userInfo.userId) || [];
    tokenInstances.push(tokenMenu);
    if (tokenInstances.length > 1) {
      tokenInstances.reverse();
      await this.deleteBotMessage(tokenInstances[1], 0);
      tokenInstances.pop();
      console.log(`Delete token instance of user ${userInfo.userId}`);
    }
    this.tokenInstances.set(userInfo.userId, tokenInstances);
  }
  async handleChangingToken(token: string, msg: Context, userInfo: UserInfo) {
    await this.walletService.changeToken(token, userInfo.userId.toString());
    const message = await msg.reply(`changed to token ${token}`);
    this.handleStart(msg);
    await this.deleteBotMessage(message, 5000);
  }
  async handleUserAction(msg: any, userInfo: UserInfo, data: DataCache) {
    if (userInfo.text === '/cancel') {
      this.cacheManager.del(userInfo.userId.toString());
      const message = await msg.reply('Action Cancelled', this.handleStart(msg));
      this.deleteBotMessage(message, 5000);
      return;
    }
    switch (data.action) {
      case Action.DEPOSIT:
        await this.handleDepositAction(msg, userInfo, data);
        break;
      case Action.WITHDRAW:
        await this.handleWithDrawAction(msg, userInfo, data);
        break;
      case Action.HISTORY:
        await this.handleHistoryAction(msg, userInfo, data);
        break;
      case Action.TRANSFER_BY_ADDRESS:
        await this.handleTransferByAddressAction(msg, userInfo, data);
        break;
      case Action.SEND_MONEY_ADDRESS:
        await this.handleSendMoneyAction(msg, userInfo, data);
        break;
      case Action.REPLACE_WALLET:
        await this.handleReplaceWalletAction(msg, userInfo, data)
        break;
      case Action.IMPORT:
        await this.handleImportAction(msg, userInfo, data)
        break;
      case Action.CREATE:
        await this.handleCreateAccountAction(msg, userInfo, data)
        break;
      case Action.PRIVATE_KEY:
        await this.handlePrivateKeyAction(msg, userInfo, data);
        break;
      case Action.FORGOT_PASSWORD:
        await this.handleForgotPasswordAction(msg, userInfo, data);
        break;
      default:
        this.cacheManager.del(userInfo.userId.toString());
        const message = await msg.reply('Xin lỗi, tôi không hiểu', this.keyboardMarkup);
        this.deleteBotMessage(message, 5000);
        break;
    }
  }


  async handleButton(msg: Context) {
    const userInfo: UserInfo = {
      userId: msg.callbackQuery.from.id,
      username: msg.callbackQuery.from.first_name,
      text: Object(msg.callbackQuery).data,
    };
    const data: DataCache = (await this.cacheManager.get(userInfo.userId.toString())) || {
      action: '',
      step: 1,
      money: '',
    };
    const checkUser = await this.walletService.findOneUser(userInfo.userId.toString());
    switch (userInfo.text) {
      case Button.CREATE:
        await this.handleCreateAccountButton(msg, userInfo, data, checkUser);
        break;
      case Button.DEPOSIT:
        await this.handleDepositButton(msg, userInfo, data, checkUser);
        break;
      case Button.HISTORY:
        await this.handleHistoryButton(msg, userInfo, data, checkUser);
        break;
      case Button.PK:
        await this.handlePrivateKeyButton(msg, userInfo, data, checkUser);
        break;
      case Button.WALLET_ADDRESS:
        await this.handleWalletAddressButton(msg, userInfo, data, checkUser);
        break;
      case Button.TRANSFER:
        await this.handleTransferButton(msg, checkUser);
        break;
      case Button.WITHDRAW:
        await this.handleWithDrawButton(msg, userInfo, data, checkUser);
        break;
      case Button.CANCEL:
        await this.handleCancelButton(msg, userInfo, checkUser);
        break;
      case Button.HUSD:
        await this.handleChangingToken(Button.HUSD, msg, userInfo);
        break;
      case Button.MTK:
        await this.handleChangingToken(Button.MTK, msg, userInfo);
        break
      case Button.DELETE:
        await this.handleDeleteButton(msg);
        break;
      case Button.IMPORT:
        await this.handleImportAccountButton(msg, data, userInfo);
        break;
      case Button.REPLACE_WALLET:
        await this.handleReplaceWallet(msg, data, userInfo, checkUser);
        break;
      case Button.FORGOT_PASSWORD:
        await this.handleForgotPasswordButton(msg, data, userInfo, checkUser);
        break;
      default:
        await this.cacheManager.del(userInfo.userId.toString());
        const messages = [];
        messages.push(await msg.reply(`Xin lỗi tôi không hiểu`));
        messages.push(await msg.reply(
          'Tôi chỉ thực hiện được như bên dưới thôi!',
        ));
        await this.handleButton(msg)
        await this.deleteBotMessages(messages, 5000);
        break;
    }
  }

  //Action Handler
  async handleDepositAction(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache
  ) {
    if (data.step === 1) {
      const isValidAmount = await this.validateDepositAmount(userInfo, data, msg);
      if (!isValidAmount) {
        return;
      }
    }
    if (data.step === 2) {
      return await this.executeDepositAction(userInfo, data, msg);
    }
  }
  async validateDepositAmount(
    userInfo: UserInfo,
    data: DataCache,
    msg: Context,
  ): Promise<boolean> {
    if (!Number(userInfo.text)) {
      const message = await msg.reply("Số tiền sai cú pháp, Vui lòng nhập lại! Để hủy thao tác nhập lệnh /cancel");
      this.deleteBotMessage(message, 5000);
      return false;
    }
    if (Number(userInfo.text) && Number(userInfo.text) > 0) {
      data.money = userInfo.text;
      data.step = 2;
      return true;
    }
    await this.cacheManager.del(userInfo.userId.toString());
    const message = await msg.reply("Vui lòng thực hiện lại");
    this.deleteBotMessage(message, 5000);
    return false;
  }
  async createDepositTransaction(
    userInfo: UserInfo,
    data: DataCache,
    msg: Context
  ) {
    const user = await this.walletService.findOneUser(userInfo.userId.toString());
    const address = await this.walletService.checkAddress(userInfo.userId.toString());
    const token = user.currentSelectToken;
    const defaultTxHash = 'Unavailable';
    const createTransaction = {
      transactionHash: String(defaultTxHash),
      token: token,
      senderAddress: address,
      receiverAddress: address,
      balance: String(data.money),
      type: String(data.action),
      status: TransactionStatus.CREATED,
    };
    const transaction = await this.transactionService.createTransaction(createTransaction);
    const message = await msg.reply("processing...");
    this.processMessages.set(userInfo.userId, message)
    return transaction;
  }
  async executeDepositAction(
    userInfo: UserInfo,
    data: DataCache,
    msg: Context
  ): Promise<boolean> {
    const messages = [];
    const transaction = await this.createDepositTransaction(userInfo, data, msg);
    await this.transactionService.updateTransactionState(TransactionStatus.PENDING, transaction.id);
    //mint token
    const mint = await this.walletService.mint(transaction.senderAddress, data.money);

    if (!mint) {
      await this.transactionService.updateTransactionState(TransactionStatus.FAIL, transaction.id);
      messages.push(await msg.reply(`Nạp tiền thất bại`));
      messages.push(this.processMessages.get(userInfo.userId));
      await this.deleteBotMessages(messages, 5000);
      return false;
    }

    await this.transactionService.updateTransactionState(TransactionStatus.SUCCESS, transaction.id);
    await this.transactionService.updateTransactionHash(Object(mint).txhash, transaction.id);
    messages.push(await msg.reply(`Nạp tiền thành công`));
    messages.push(this.processMessages.get(userInfo.userId));
    this.cacheManager.del(userInfo.userId.toString());
    this.deleteBotMessages(messages, 5000);
    await sleep(2000);
    const message = await msg.reply(`tôi có thể giúp gì tiếp cho bạn`);
    await this.handleStart(msg);
    this.deleteBotMessage(message, 5000);
    return true;
  }

  async handleWithDrawAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const messages = [];
    const userId = userInfo.userId.toString();
    if (data.step === 1) {
      const input = userInfo.text;
      if (!Number(input)) {
        await this.cacheManager.del(userInfo.userId.toString());
        const message = await msg.reply('Vui lòng thực hiện lại');
        messages.push(message);
      }
      if (Number(input) && Number(input) > 0) {
        data.money = input;
        data.step = 2;
        await this.cacheManager.set(userId, data, 30000);
      } else {
        const message = await msg.reply(`Rút tiền thất bại, vui lòng thử lại`);
        messages.push(message);
        await this.cacheManager.del(userId);
      }
      if (data.step === 2) {
        await this.cacheManager.set(userId, data, 30000);
        const user = await this.walletService.findOneUser(userId);
        const address = await this.walletService.checkAddress(userId);
        const token = user.currentSelectToken;
        const defaultTxHash = 'Unavailable';
        const createTransaction = {
          transactionHash: String(defaultTxHash),
          token: token,
          balance: String(data.money),
          type: String(data.action),
          senderAddress: address,
          receiverAddress: address,
          status: TransactionStatus.CREATED,
        };
        const transaction =
          await this.transactionService.createTransaction(createTransaction);
        const balance = await this.walletService.getBalance(address);
        if (Number(balance) < Number(data.money)) {

          await this.cacheManager.del(userId);
          const message = await msg.reply(`Tài khoản không đủ tiền`);
          messages.push(message);
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          return;
        }
        const privateKey = await this.walletService.checkPrivateKeyByID(
          userId,
        );
        await this.transactionService.updateTransactionState(
          TransactionStatus.PENDING,
          transaction.id,
        );
        const message = await msg.reply(`processing....`);
        messages.push(message);
        const burn = await this.walletService.burn(data.money, privateKey);
        if (!burn) {
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          await this.cacheManager.del(userId);
          const message = await msg.replyWithHTML(`Lượng token PGX hiện tại không đủ để thực hiện giao dịch`);
          messages.push(message);
          this.deleteBotMessages(messages, 5000);
          return;
        }
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS,
          transaction.id,
        );
        console.log(Object(burn).txHash);
        await this.transactionService.updateTransactionHash(Object(burn).txHash, transaction.id);
        await this.cacheManager.del(userId);
        const message1 = await msg.reply(`Rút tiền thành công`);
        await this.handleStart(msg)
        messages.push(message1);
        this.deleteBotMessages(messages, 5000);
        return;
      }
    }
  }


  async handleHistoryAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const userId = userInfo.userId.toString();
    try {
      const address = await this.walletService.checkAddress(userId);
      const listHistory = await this.transactionService.getListHistory(address);

      if (data.step === 1) {
        const amountHistory = userInfo.text;
        if (!Number(amountHistory)) {
          await this.cacheManager.del(userId);
          const message = await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
          this.deleteBotMessages([message], 5000);
          return;
        } else if (Number(listHistory) < Number(amountHistory)) {
          await this.cacheManager.del(userId);
          const message = await msg.reply(
            `Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`,
          );
          this.deleteBotMessages([message], 5000);
          return;
        }
        const selectHistory = await this.transactionService.getAmountHistory(
          Number(amountHistory),
          address,
        );

        let transaction = '';
        let i = 1;
        for (const item of selectHistory) {
          transaction += `${i++}.Transaction Hash:  <code>${item?.transactionHash}</code>\nAmount: ${item?.balance} <b>${item?.token}</b>\nType:<b>${item?.type}</b>\nStatus:<b>${item.status}</b>\nTransaction created at:<b> ${format(item?.createdDate, 'yyyy-MM-dd HH:mm:ss')}</b>\n\n`;
        }
        const messages = [];
        const message = await msg.replyWithHTML(transaction, this.deleteButton);
        this.processMessages.set(message.message_id, message)
        messages.push(
          await msg.replyWithHTML(
            `Bạn đang xem <b>${selectHistory.length} giao dịch </b>`,
          ),
        );
        this.deleteBotMessages(messages, 3000);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async handleReplaceWalletAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const user = await this.walletService.findOneUser(userInfo.userId.toString());
    const userId = userInfo.userId.toString();
    const pk = Object(msg.message).text
    console.log(pk);
    if (pk === user.privateKey) {
      const finalMessage = await msg.reply('Bạn đang sử dụng ví này Vui lòng nhập lại. Để hủy nhập /cancel');
      this.deleteBotMessage(finalMessage, 10000)
      return;
    }
    const checkPrivateKey = await this.walletService.checkPrivateKey(pk);
    if (!checkPrivateKey) {
      const finalMessage = await msg.reply('Không đúng định dạng PrivateKey, Vui lòng nhập lại. Để hủy nhập /cancel');
      this.deleteBotMessage(finalMessage, 10000)
      this.handleStart(msg)

    } else {
      const update = await this.walletService.updateAddress(userId, pk)
      if (!update) {
        const finalMessage = await msg.reply('Không thành công');
        this.deleteBotMessage(finalMessage, 10000)
        this.handleStart(msg)
        await this.cacheManager.del(userId);
      } else {
        const finalMessage = await msg.reply('Thành công');
        this.deleteBotMessage(finalMessage, 10000)
        this.handleStart(msg)
        await this.cacheManager.del(userId);
      }
    }
  }
  async handleTransferByAddressAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const messages = [];
    if (data.step === 1) {
      const address = userInfo.text;
      data.step = 2;
      const checkAddress =
        await this.walletService.checkAddressContract(address);
      if (!checkAddress) {
        messages.push(await msg.reply(`Địa chỉ người dùng không tồn tại`));
        messages.push(await msg.reply('Vui lòng Điền lại địa chỉ'));
        data.step = 1;
        await this.deleteBotMessages(messages, 5000)
        return;
      }
      if (data.action === Action.TRANSFER_BY_ADDRESS) {
        data.action = Action.SEND_MONEY_ADDRESS;
        data.step = 3;
        data.receiver = address;
        messages.push(await msg.reply('Bạn muốn chuyển bao nhiêu tiền'));
        await this.deleteBotMessages(messages, 5000)
        return;
      }
    } else {
      messages.push(await msg.reply(`Có gì đó không ổn vui lòng thử lại`));
      await this.cacheManager.del(userInfo.userId.toString());
    }
    await this.deleteBotMessages(messages, 5000)

  }
  async handleSendMoneyAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const messages = [];
    const userId = userInfo.userId.toString();
    if (data.action === Action.SEND_MONEY_ADDRESS) {
      const money = userInfo.text;
      if (!Number(money)) {
        await this.cacheManager.del(userInfo.userId.toString());
        const message = await msg.reply(
          'Vui lòng thực hiện lại',
        )
        await this.handleStart(msg);
        this.deleteBotMessage(message, 5000);
        return;
      }
      if (Number(money) && Number(money) > 0) {
        data.money = userInfo.text;
        data.step = 2;
        await this.cacheManager.set(userId, data, 30000);
      }

      const receiver = data.receiver;
      const sender = await this.walletService.getAddressById(userId);
      const token = (await this.walletService.findOneUser(userId)).currentSelectToken;
      const defaultTxHash = 'Unavailable';
      const createTransaction = {
        balance: String(data.money),
        transactionHash: String(defaultTxHash),
        token: token,
        type: Action.SEND_MONEY_ADDRESS,
        senderAddress: sender,
        receiverAddress: receiver,
        status: TransactionStatus.CREATED,
      };
      const transaction =
        await this.transactionService.createTransaction(createTransaction);
      const message = await msg.reply(`processing...`);
      messages.push(message);
      const checkStatus = await this.walletService.sendMoneybyAddress(
        userId,
        receiver,
        money,
      );
      await this.transactionService.updateTransactionState(
        TransactionStatus.PENDING,
        transaction.id,
      );
      if (Object(checkStatus).status === TransactionStatus.SUCCESS && data.step === 2) {
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS,
          transaction.id,
        );
        await this.transactionService.updateTransactionHash(Object(checkStatus).txHash, transaction.id);
        const message = await msg.reply(`Chuyển tiền thành công`);
        await this.handleStart(msg)
        messages.push(message);
        data.step = 1;
        data.action = '';
      } else if (checkStatus === WalletStatus.NOT_ENOUGH_FUND) {
        const message = await msg.reply(
          `Không đủ tiền trong tài khoản, vui lòng thử lại`
        );
        await this.handleStart(msg);
        messages.push(message);
        this.cacheManager.del(userId);
      }
      else if (checkStatus === WalletStatus.SELF) {
        const message = await msg.reply(
          `Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`
        );
        await this.handleStart(msg)
        messages.push(message);
        this.cacheManager.del(userId);
      } else {
        const message = await msg.replyWithHTML(`Lượng token PGX hiện tại không đủ để thực hiện giao dịch`);
        this.deleteBotMessage(message, 5000);
        messages.push(message);
        await this.transactionService.updateTransactionState(
          TransactionStatus.FAIL,
          transaction.id,
        );
        this.cacheManager.del(userId);
      }
    }
    for (const message of messages) {
      this.deleteBotMessage(message, 3000);
    }
  }
  async handleForgotPasswordAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    const userId = userInfo.userId.toString();
    const wallet = await this.walletService.findOneUser(userId);
    if (data.action === Action.FORGOT_PASSWORD && data.step === 1) {
      const isVerified = await this.walletService.verifyBackupPhrase(userInfo.text, wallet.address);
      if (isVerified) {
        await this.setCache(userInfo, Action.FORGOT_PASSWORD, 2);
        await msg.reply('Enter your new password:');
        return;
      }
      await msg.reply('some thing wrong with your mnemonic! Please try again !');
      return;
    }
    if (data.action === Action.FORGOT_PASSWORD && data.step === 2) {
      await this.walletService.updatePassword(userInfo.text, userId);
      await msg.reply('Your password has been updated');
      await this.handleStart(msg)
    }

  }
  //Button Handler
  async setCache(userInfo: UserInfo, action: Action, step: number) {
    await this.cacheManager.set(
      userInfo.userId.toString(),
      {
        action: action,
        step: step,
      },
      30000,
    );
  }
  async handleImportAccountButton(msg: Context, data: DataCache, userInfo: UserInfo) {
    this.setCache(userInfo, Action.IMPORT, 1);
    const finalMessage = await msg.replyWithHTML(`Vui lòng nhập privateKey của ví bạn muốn import`);
    this.deleteBotMessage(finalMessage, 10000)
  }
  async handleReplaceWallet(msg: any, data: any, userInfo: any, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.REPLACE_WALLET, 1);
      const finalMessage = await msg.replyWithHTML(`Vui lòng nhập privateKey của ví bạn muốn import`);
      this.deleteBotMessage(finalMessage, 10000)
    } else {
      await this.cacheManager.del(userInfo.userId);
      this.setCache(userInfo, Action.REPLACE_WALLET, 1);
      const message = await msg.reply('Vui lòng nhập privateKey của ví bạn muốn import');
      this.deleteBotMessage(message, 10000)
    }
  }

  async handleImportAction(msg: Context, userInfo: UserInfo, data: DataCache) {
    console.log(this.identify(msg.chat));
    const user = {
      userId: msg.chat.id,
      username: Object(msg.chat).first_name,
    };
    if (data.action == Action.IMPORT && data.step === 1) {
      const input = Object(msg.message).text
      await this.cacheManager.del(userInfo.userId.toString());
      const address = await this.walletService.generateWalletFromPrivateKey(input);
      if (!address) {
        const message = await msg.replyWithHTML(
          `Private Key sai cú pháp Vui lòng nhập lại\n (Example: 0xFFFFFFFFFFFFF****************FD2E8CD0364140)`,
        )
        this.deleteBotMessage(message, 10000);
        return;
      }
      const encryptedPrivateKey = await this.walletService.encryptPrivateKey(userInfo.text);
      const createWallet = {
        userId: user.userId,
        username: user.username,
        password: 'Unavailable',
        address: address,
        privateKey: encryptedPrivateKey.encryptedPrivateKey.toString('hex'),
        iv: encryptedPrivateKey.iv.toString('hex'),
        currentSelectToken: 'HUSD',
      }
      const isCreated = await this.walletService.createWallet(createWallet, address);
      if (!isCreated) {
        msg.reply('Wallet creation failed! some error occurred');
        return isCreated;
      }
      this.setCache(userInfo, Action.IMPORT, 2);
      const message = await msg.reply(
        `Vui lòng nhập mật khẩu mới cho ví!`
      )
      this.deleteBotMessage(message, 10000);
    }

    if (data.action == Action.IMPORT && data.step === 2) {
      await msg.reply(`Import ví cho user ${user.userId}...`);
      const update = this.walletService.updatePassword(userInfo.text, user.userId.toString());
      if (update) {
        await msg.reply(
          `Import thành công!`,
        )
        await this.handleStart(msg);
        await this.cacheManager.del(userInfo.userId.toString());
      } else {
        await msg.reply(
          `Lỗi`,
        )
      }
    }
  }

  async handleCreateAccountAction(msg: Context,
    userInfo: any,
    data: DataCache) {
    const messages = [];
    if (data.action !== '') {
      await this.cacheManager.del(userInfo.userId);
    }
    const password = await this.walletService.hashPassword(userInfo.text);
    const wallet = await this.walletService.generateNewWallet();
    const user = {
      userId: msg.chat.id,
      username: Object(msg.chat).first_name,
      password: password
    };
    messages.push(await msg.reply(`Tạo tài khoản cho user ${user.userId}...`));
    const message = await msg.replyWithHTML(`Recovery phrase dùng phòng khi bạn quên mật khẩu hãy lưu lại ở đâu đó trong máy bạn: \n <code>${wallet.mnemonic}</code>`, this.deleteButton);
    this.processMessages.set(message.message_id, message);
    const createWallet = {
      userId: user.userId.toString(),
      username: user.username,
      password: password,
      address: wallet.address,
      privateKey: wallet.privateKey,
      iv: wallet.iv,
      currentSelectToken: 'HUSD',
    }
    const createAccount = await this.walletService.createWallet(createWallet, wallet.address);
    if (!createAccount) {
     await msg.reply('Wallet creation failed! some error occurred');
      return createAccount;
    }
    messages.push(await msg.reply(
      `Tạo tài khoản thành công!`
    ));
    await this.handleStart(msg)
    await this.cacheManager.del(userInfo.userId);
    await this.deleteBotMessages(messages, 5000);
  }
  async handleCreateAccountButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    const messages = [];
    if (checkUser) {
      messages.push(await msg.reply(`Đã có tài khoản! Vui lòng thực hiện hành động khác`));
      await this.handleStart(msg);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.CREATE, 1);
      messages.push(await msg.reply(`Nhập mật khấu mới cho ví`))
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.CREATE, 1);
      messages.push(await msg.reply(`Nhập mật khấu mới cho ví`))
    }

    this.deleteBotMessages(messages, 10000);
  }
  async handleForgotPasswordButton(msg: Context, data: DataCache, userInfo: UserInfo, checkUser: WalletEntity) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.FORGOT_PASSWORD, 1);
      const finalMessage = await msg.reply('Hãy nhập vào Recovery phrase:');
      this.deleteBotMessage(finalMessage, 10000)
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.FORGOT_PASSWORD, 1);
      const message = await msg.reply('Hãy nhập vào Recovery phrase:');
      this.deleteBotMessage(message, 10000)
    }
  }
  async handleDepositButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.DEPOSIT, 1);
      const finalMessage = await msg.reply('Bạn muốn nạp bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.DEPOSIT, 1);
      const message = await msg.reply('Bạn muốn nạp bao nhiêu tiền');
      this.deleteBotMessage(message, 10000)
    }
  }
  async handleWithDrawButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.WITHDRAW, 1);
      const finalMessage = await msg.reply('Bạn muốn rút bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)

    } else {
      // const finalMessage = await msg.reply(`Canceling ${data.action}`);
      // this.deleteBotMessage(finalMessage,1000)
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.WITHDRAW, 1);
      const finalMessage = await msg.reply('Bạn muốn rút bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000);
    }
  }
  async handleHistoryButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    const address = await this.walletService.checkAddress(userInfo.userId.toString());

    const listHistory = await this.transactionService.getListHistory(address);
    if (Number(listHistory) === 0) {
      const finalMessage = await msg.reply('Bạn không có lịch sử giao dịch nào');
      return this.deleteBotMessage(finalMessage, 10000)
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.HISTORY, 1);
      const message = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(message, 5000)
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.HISTORY, 1);
      const message = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(message, 5000)
    }
  }
  async handlePrivateKeyButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    const messages = [];
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.PRIVATE_KEY, 1);
      messages.push(await msg.reply(`Enter your password to see your private key: `, this.forgotPassword))
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.PRIVATE_KEY, 1);
      messages.push(await msg.reply(`Enter your password to see your private key: `, this.forgotPassword))
    }
    await this.deleteBotMessages(messages, 30000);
  }
  async handlePrivateKeyAction(msg: Context,
    userInfo: UserInfo,
    data: DataCache) {
    if (data.action !== Action.PRIVATE_KEY) {
      return;
    }
    const userId = userInfo.userId.toString();
    const hashPassword = (await this.walletService.findOneUser(userId)).password;
    const isPassword = await this.walletService.verifyPassword(userInfo.text, hashPassword);
    if (isPassword) {
      const address = await this.walletService.getAddressById(userId);
      const tempMessage = await msg.reply('🗝Here is your private key (Dont share it to others)')
      const message = await msg.replyWithHTML(`<tg-spoiler>${await this.walletService.getPrivateKey(address)}</tg-spoiler>`, this.deleteButton);
      this.deleteBotMessage(tempMessage, 5000);
      this.processMessages.set(message.message_id, message);
      await this.cacheManager.del(userId);
      return;
    }
    const tempMessage = await msg.reply('Wrong Password! Try again (to cancel action type /cancel)')
    this.deleteBotMessage(tempMessage, 5000);
  }
  async handleWalletAddressButton(
    msg: Context,
    userInfo: UserInfo,
    data: DataCache,
    checkUser: WalletEntity,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(userInfo, Action.TRANSFER_BY_ADDRESS, 1);
      const finalMessage = await msg.reply('Điền địa chỉ người nhận');
      await this.deleteBotMessage(finalMessage, 10000)
    } else {
      // await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(userInfo.userId.toString());
      this.setCache(userInfo, Action.TRANSFER_BY_ADDRESS, 1);
      const finalMessage = await msg.reply('Điền địa chỉ người nhận');
      await this.deleteBotMessage(finalMessage, 10000)
    }
  }
  async handleTransferButton(msg: Context, checkUser: WalletEntity) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    await msg.reply(
      'Bạn muốn chuyển tiền bằng phương thức gì',
      this.keyTransferMethod,
    );
  }
  async handleCancelButton(msg: Context, userInfo: UserInfo, checkUser: WalletEntity) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    await this.cacheManager.del(userInfo.userId.toString());
    const finalMessage = await msg.reply('Hủy giao dịch thành công', this.keyboardMarkup);
    console.log(this.identify(finalMessage));
    this.deleteBotMessage(finalMessage, 30000)
  }
  async handleDeleteButton(msg: Context) {
    const messageId = msg.callbackQuery?.message.message_id || msg.message?.message_id;
    const message = this.processMessages.get(messageId)
    console.log('Deleting message id=' + messageId);
    await this.deleteBotMessage(message, 0);
  }

  async deleteBotMessage(ctx: any, delay: number) {
    if (ctx?.chat) {
      const chatId = await ctx.chat.id;
      const messageId = await ctx.message_id;
      try {
        setTimeout(() => {
          (async () => {
            await this.bot.telegram.deleteMessage(chatId, messageId);
          })();
        }, delay);
      } catch (error) {
        console.log(error);
      }
    } else {
      console.log('Something went wrong');
    }
  }
  async deleteBotMessages(messages: any[], delay: number) {
    for (const message of messages) {
      this.deleteBotMessage(message, delay);
    }
  }
  async telegramClient() {
    const client = new TelegramClient(this.stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });
    await client.start({
      phoneNumber: async () => await input.text("Please enter your number: "),
      password: async () => await input.text("Please enter your password: "),
      phoneCode: async () =>
        await input.text("Please enter the code you received: "),
      onError: (err) =>

        console.log(err),
    });
    //  console.log("connected to telegram client");
    //  console.log(client.session.save()); // Save this string to avoid logging in again
    return client;
  }
  async deleteHistory(msg: Context) {
    const userId = msg.message.from.id;
    try {
      this.startInstances.delete(userId);
      await this.cacheManager.del(userId.toString());
      const client = await this.telegramClient();
      await client.invoke(
        new Api.messages.DeleteHistory({
          peer: `https://t.me/${this.bot.botInfo.username}`,
          maxId: 0,
          justClear: true,
          revoke: true,
          minDate: 43,
        })
      )

      const message = await msg.reply(`History deleted successfully at ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`);
      await this.handleStart(msg)
      this.deleteBotMessage(message, 3000);
    }
    catch (err) {
      console.error(err);
      await msg.reply(`Some thing went wrong`);
    }
  }
}