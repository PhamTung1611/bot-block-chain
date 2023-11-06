import { Inject, Injectable } from '@nestjs/common';
import {
  session, Markup, Telegraf
} from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletStatus } from 'src/wallet/wallet.status.enum';
import { Button } from './enum/button.enum';
import { Action } from './enum/action.enum';
import { TransactionStatus } from 'src/transaction/enum/transaction.enum';
import { ConfigService } from '@nestjs/config';
interface DataCache {
  action: string;
  step: number;
  money: string;
  receiver?: string;
  sender?: string;
  msg?: any[];
}
import { format } from 'date-fns'
import { Api } from "telegram/tl"
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import { botCommand } from 'src/constants/commands/telegram.commands';
import { sleep } from 'telegram/Helpers';

@Injectable()
export class TelegramService {
  // Create an array to store messages for each user
  private startInstances: Map<number, string[]> = new Map();
  private tokenInstances: Map<number, string[]> = new Map();
  private processMessages: Map<number, string> = new Map();
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
      Markup.button.callback('Balance', Button.INFORMATION),
      Markup.button.callback('Replace Wallet', Button.REPLACE_WALLET),
    ],
  ]);

  private keyCreateAccount = Markup.inlineKeyboard([
    [Markup.button.callback('Create Account', Button.CREATE),
    Markup.button.callback('Import Account', Button.IMPORT),
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

  async handleStart(ctx: any) {

    const options = {
      userId: ctx.update.message?.from.id || ctx.update.callback_query?.from.id,
      username: ctx.update.message?.from.first_name || ctx.update.callback_query?.from.first_name,
    };
    const checkUser = await this.walletService.findOneUser(options.userId);

    if (!checkUser) {
      await ctx.replyWithHTML(
        `Xin chào <a href="tg://user?id=${options.userId}">@${options.username}</a> ! Bạn chưa có tài khoản vui lòng tạo một tài khoản để tiếp tục`,
        this.keyCreateAccount,
      );
    } else {
      const nativeToken = await this.walletService.getUserNativeToken(checkUser.address)
      const message = await ctx.replyWithHTML(`Xin chào <a href="tg://user?id=${options.userId}">@${options.username}</a>!!\n💳Địa chỉ wallet!\n<code>${checkUser.address}</code>\n
🪙Token Selected: ${await this.walletService.getTokenSymbol()}\n    
💰Hiện Tài khoản bạn đang có:<b> ${nativeToken} PGX </b>\n
📊Theo dõi giao dịch <a href="https://testnet.miraiscan.io"><u>click here</u>!</a>\n 
🎟️Nạp thêm <b>PGX</b> <a href="https://faucet.miraichain.io/"><u>click here</u>!</a>`, this.keyboardMarkup);
      const startInstances = this.startInstances.get(options.userId) || [];
      startInstances.push(message);
      if (startInstances.length > 1) {
        startInstances.reverse();
        await this.deleteBotMessage(startInstances[1], 0);
        startInstances.pop();
        console.log(`Delete start instance of user ${options.userId}`);
      }
      this.startInstances.set(options.userId, startInstances);
    }
  }


  async handleMessage(msg: any) {
    const options = {
      userId: msg.update.message.from.id,
      username: msg.update.message.from.first_name,
      text: msg.update.message.text,
    };
    const data: DataCache = await this.cacheManager.get(options.userId);
    if (data) {
      return await this.handleUserAction(msg, options, data);
    }
    return await this.handleUserCommands(msg, options, data);

  }
  async handleUserCommands(msg: any, options: any, data: any) {
    switch (options.text) {
      case '/clear':
        try {
          return await this.deleteHistory(msg);
        } catch (err) {
          return await msg.reply('some thing went wrong');
        }
      case '/info':
        return await msg.reply('havent implemented');
      case '/help':
        return await msg.reply('havent implemented');
      case '/token':
        await this.handleToken(msg, options);
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
  async handleToken(msg: any, options: any) {
    const tokenMenu = await msg.reply(`Current using ${await this.walletService.getTokenSymbol()} token`, this.tokens);
    const tokenInstances = this.tokenInstances.get(options.userId) || [];
    tokenInstances.push(tokenMenu);
    if (tokenInstances.length > 1) {
      tokenInstances.reverse();
      await this.deleteBotMessage(tokenInstances[1], 0);
      tokenInstances.pop();
      console.log(`Delete token instance of user ${options.userId}`);
    }
    this.tokenInstances.set(options.userId, tokenInstances);
  }
  async handleChangingToken(token: string, msg: any, options: any) {
    await this.walletService.changeToken(token);
    const message = await msg.reply(`changed to token ${token}`, this.handleStart(msg))
    await this.deleteBotMessage(message, 5000);
  }
  async handleUserAction(msg: any, options: any, data: DataCache) {
    if (options.text === '/cancel') {
      this.cacheManager.del(options.userId);
      const message = await msg.reply('Action Cancelled', this.handleStart(msg));
      this.deleteBotMessage(message, 5000);
      return;
    }
    switch (data.action) {
      case Action.DEPOSIT:
        await this.handleDepositAction(msg, options, data);
        break;
      case Action.WITHDRAW:
        await this.handleWithDrawAction(msg, options, data);
        break;
      case Action.HISTORY:
        await this.handleHistoryAction(msg, options, data);
        break;
      case Action.TRANSFER_BY_ADDRESS:
        await this.handleTransferByAddressAction(msg, options, data);
        break;
      case Action.SEND_MONEY_ADDRESS:
        await this.handleSendMoneyAction(msg, options, data);
        break;
      default:
        this.cacheManager.del(options.userId);
        const message = await msg.reply('Xin lỗi, tôi không hiểu', this.keyboardMarkup);
        this.deleteBotMessage(message, 5000);
        break;
    }
  }
  async handleButton(msg: any) {
    const options = {
      userId: msg.update.callback_query.from.id,
      username: msg.update.callback_query.from.first_name,
      data: msg.update.callback_query.data,
    };
    const data: DataCache = (await this.cacheManager.get(options.userId)) || {
      action: '',
      step: 1,
      money: '',
    };
    const checkUser = await this.walletService.findOneUser(options.userId);
    switch (options.data) {
      case Button.CREATE:
        await this.handleCreateAccountButton(msg, options, data, checkUser);
        break;
      case Button.DEPOSIT:
        await this.handleDepositButton(msg, options, data, checkUser);
        break;
      case Button.HISTORY:
        await this.handleHistoryButton(msg, options, data, checkUser);
        break;
      case Button.INFORMATION:
        await this.handleInformationButton(msg, options, data, checkUser);
        break;
      case Button.WALLET_ADDRESS:
        await this.handleWalletAddressButton(msg, options, data, checkUser);
        break;
      case Button.TRANSFER:
        await this.handleTransferButton(msg, checkUser);
        break;
      case Button.WITHDRAW:
        await this.handleWithDrawButton(msg, options, data, checkUser);
        break;
      case Button.CANCEL:
        await this.handleCancelButton(msg, options, checkUser);
        break;
      case Button.HUSD:
        await this.handleChangingToken(Button.HUSD, msg, options);
        break;
      case Button.MTK:
        await this.handleChangingToken(Button.MTK, msg, options);
        break
      case Button.DELETE:
        await this.handleDeleteButton(options.userId);
        break;
      case Button.IMPORT:
        await this.handleImportAccountButton(msg);
      case Button.REPLACE_WALLET:
        await this.handleReplaceWallet(msg);
        break;
      default:
        await this.cacheManager.del(options.userId);
        const messages = [];
        messages.push(await msg.reply(`Xin lỗi tôi không hiểu`));
        messages.push(await msg.reply(
          'Tôi chỉ thực hiện được như bên dưới thôi!',
          await this.handleButton(msg),
        ));
        await this.deleteBotMessages(messages, 5000);
        break;
    }
  }



  //Action Handler
  async handleDepositAction(
    msg: any,
    options: any,
    data: DataCache
  ): Promise<any> {
    if (data.step === 1) {
      const isValidAmount = await this.validateDepositAmount(options, data, msg);
      if (!isValidAmount) {
        return;
      }
    }
    if (data.step === 2) {
      return await this.executeDepositAction(options, data, msg);
    }
  }

  async validateDepositAmount(
    options: any,
    data: DataCache,
    msg: any,
  ): Promise<boolean> {
    if (!Number(options.text)) {
      const message = await msg.reply("Số tiền sai cú pháp, Vui lòng nhập lại! Để hủy thao tác nhập lệnh /cancel");
      this.deleteBotMessage(message, 5000);
      return false;
    }
    if (Number(options.text) && Number(options.text) > 0) {
      data.money = options.text;
      data.step = 2;
      return true;
    }
    await this.cacheManager.del(options.userId);
    const message = await msg.reply("Vui lòng thực hiện lại");
    this.deleteBotMessage(message, 5000);
    return false;
  }

  async createDepositTransaction(
    options: any,
    data: DataCache,
    msg: any
  ): Promise<any> {
    const address = await this.walletService.checkAddress(options.userId);
    const token = await this.walletService.getTokenSymbol();
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
    this.processMessages.set(options.userId, message)
    return transaction;
  }

  async executeDepositAction(
    options: any,
    data: DataCache,
    msg: any
  ): Promise<boolean> {
    const messages = [];
    const transaction = await this.createDepositTransaction(options, data, msg);
    await this.transactionService.updateTransactionState(TransactionStatus.PENDING, transaction.id);
    //mint token
    const mint = await this.walletService.mint(transaction.senderAddress, data.money);
    if (mint === WalletStatus.NOT_ENOUGH_GAS) {
      await this.cacheManager.del(options.userId);
      const message = await msg.replyWithHTML(`Lượng token PGX hiện tại không đủ để thực hiện giao dịch`);
      this.deleteBotMessage(message, 5000);
      return;
    }
    if (!mint) {
      await this.transactionService.updateTransactionState(TransactionStatus.FAIL, transaction.id);
      messages.push(await msg.reply(`Nạp tiền thất bại`));
      messages.push(this.processMessages.get(options.userId));
      await this.deleteBotMessages(messages, 5000);
      return false;
    }
    await this.transactionService.updateTransactionState(TransactionStatus.SUCCESS, transaction.id);
    await this.transactionService.updateTransactionHash(Object(mint).txhash, transaction.id);
    messages.push(await msg.reply(`Nạp tiền thành công`));
    messages.push(this.processMessages.get(options.userId));
    this.cacheManager.del(options.userId);
    this.deleteBotMessages(messages, 5000);
    await sleep(2000);
    const message = await msg.reply(`tôi có thể giúp gì tiếp cho bạn`, this.handleStart(msg));
    this.deleteBotMessage(message, 5000);
    return true;
  }



  async handleWithDrawAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.step === 1) {
      const Money = options.text;
      if (!Number(Money)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply('Vui lòng thực hiện lại');
        messages.push(message);
      }
      if (Number(Money) && Number(Money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.userId, data, 30000);
      } else {
        const message = await msg.reply(`Rút tiền thất bại, vui lòng thử lại`);
        messages.push(message);
        await this.cacheManager.del(options.userId);
      }
      if (data.step === 2) {
        await this.cacheManager.set(options.userId, data, 30000);

        const address = await this.walletService.checkAddress(options.userId);
        const token = await this.walletService.getTokenSymbol();
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
          await this.cacheManager.del(options.userId);
          const message = await msg.reply(`Tài khoản không đủ tiền`);
          messages.push(message);
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          return;
        }
        const privateKey = await this.walletService.checkPrivateKeyByID(
          options.userId,
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
          await this.cacheManager.del(options.userId);
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
        await this.cacheManager.del(options.userId);
        const message1 = await msg.reply(`Rút tiền thành công`, this.handleStart(msg));
        messages.push(message1);
        this.deleteBotMessages(messages, 5000);
        return;
      }
    }
  }


  async handleHistoryAction(msg: any, options: any, data: DataCache) {
    try {
      const address = await this.walletService.checkAddress(options.userId);
      const listHistory = await this.transactionService.getListHistory(address);

      if (data.step === 1) {
        const amountHistory = options.text;
        if (!Number(amountHistory)) {
          await this.cacheManager.del(options.userId);
          const message = await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
          this.deleteBotMessages([message], 5000);
          return;
        } else if (Number(listHistory) < Number(amountHistory)) {
          await this.cacheManager.del(options.userId);
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
        this.processMessages.set(options.userId, message)
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
  async handleTransferByAddressAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.step === 1) {
      const address = options.text;
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
      await this.cacheManager.del(options.userId);
    }
    await this.deleteBotMessages(messages, 5000)

  }
  async handleSendMoneyAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.action === Action.SEND_MONEY_ADDRESS) {
      const money = options.text;
      if (!Number(money)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply(
          'Vui lòng thực hiện lại',
          this.handleStart(msg),
        )
        this.deleteBotMessage(message, 5000);
        return;
      }
      if (Number(money) && Number(money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.userId, data, 30000);
      }
      const receiver = data.receiver;
      const sender = await this.walletService.getAddressById(options.userId);
      const token = await this.walletService.getTokenSymbol();
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
        options.userId,
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
        const message = await msg.reply(`Chuyển tiền thành công`, this.handleStart(msg));
        messages.push(message);
        data.step = 1;
        data.action = '';
      } else if (checkStatus === WalletStatus.NOT_ENOUGH_FUND) {
        const message = await msg.reply(
          `Không đủ tiền trong tài khoản, vui lòng thử lại`,
          this.handleStart(msg),
        );
        messages.push(message);
        this.cacheManager.del(options.userId);
      } else if (checkStatus === WalletStatus.SELF) {
        const message = await msg.reply(
          `Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`, this.handleStart(msg)
        );
        messages.push(message);
        this.cacheManager.del(options.userId);
      } else {
        const message = await msg.replyWithHTML(`Lượng token PGX hiện tại không đủ để thực hiện giao dịch`);
        this.deleteBotMessage(message, 5000);
        messages.push(message);
        await this.transactionService.updateTransactionState(
          TransactionStatus.FAIL,
          transaction.id,
        );
        this.cacheManager.del(options.userId);
      }
    }
    for (const message of messages) {
      this.deleteBotMessage(message, 3000);
    }
  }
  //Button Handler
  async setCache(options: any, action: Action, step: number) {
    await this.cacheManager.set(
      options.userId,
      {
        action: action,
        step: step,
      },
      30000,
    );
  }
  async handleImportAccountButton(msg: any) {
    await msg.reply('Havent Implemented');
  }
  async handleReplaceWallet(msg: any) {
    await msg.reply('Havent Implemented');
  }
  async handleCreateAccountButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    const messages = [];
    if (data.action === '') {
      if (!checkUser) {
        const wallet = await this.walletService.generateNewWallet();
        const user = {
          userId: msg.chat.id,
          username: msg.chat.first_name,
        };
        messages.push(await msg.reply(`Tạo tài khoản cho user ${user.userId}...`));
        const data = await this.walletService.createWallet(
          {
            ...wallet,
            ...user,
          },
          wallet.address,
        );

        if (data) {
          messages.push(await msg.reply(
            `Tạo tài khoản thành công!`,
            this.handleStart(msg),
          ));
          await this.cacheManager.del(options.userId);
        }
      } else {
        await this.cacheManager.del(options.userId);
        messages.push(await msg.reply(
          'Bạn đã có tài khoản vui lòng thực hiện chức năng khác',
          this.handleStart(msg),
        ));
        return;
      }
    } else {
      await this.cacheManager.del(options.userId);
    }
    await this.deleteBotMessages(messages, 5000);
  }
  async handleDepositButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.DEPOSIT, 1);
      const finalMessage = await msg.reply('Bạn muốn nạp bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.DEPOSIT, 1);
      const message = await msg.reply('Bạn muốn nạp bao nhiêu tiền');
      this.deleteBotMessage(message, 10000)
    }
  }
  async handleWithDrawButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.WITHDRAW, 1);
      const finalMessage = await msg.reply('Bạn muốn rút bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)

    } else {
      // const finalMessage = await msg.reply(`Canceling ${data.action}`);
      // this.deleteBotMessage(finalMessage,1000)
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.WITHDRAW, 1);
      const finalMessage = await msg.reply('Bạn muốn rút bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)

    }
  }
  async handleHistoryButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    const address = await this.walletService.checkAddress(options.userId);

    const listHistory = await this.transactionService.getListHistory(address);
    if (Number(listHistory) === 0) {
      const finalMessage = await msg.reply('Bạn không có lịch sử giao dịch nào');
      return this.deleteBotMessage(finalMessage, 10000)
    }
    if (data.action === '') {
      this.setCache(options, Action.HISTORY, 1);
      const message = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(message, 5000)
    } else {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.HISTORY, 1);
      const message = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(message, 5000)
    }
  }
  async handleInformationButton(
    msg: any,
    options: any,
    data: any,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action !== '') {
      console.log(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.INFORMATION, 1);
    }
    // const info = await this.walletService.checkInformation(options.userId);
    const add = await this.walletService.getAddressById(options.userId);
    const balane = await this.walletService.getBalance(add);
    const message = await msg.replyWithHTML(`Balance:${balane} <b>${await this.walletService.getTokenSymbol()}</b>`, this.deleteButton);
    this.deleteBotMessage(message, 10000)
    await this.cacheManager.del(options.userId);
  }
  async handleWalletAddressButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.TRANSFER_BY_ADDRESS, 1);
      const finalMessage = await msg.reply('Điền địa chỉ người nhận');
      await this.deleteBotMessage(finalMessage, 10000)
    } else {
      // await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.TRANSFER_BY_ADDRESS, 1);
      const finalMessage = await msg.reply('Điền địa chỉ người nhận');
      await this.deleteBotMessage(finalMessage, 10000)
    }
  }
  async handleTransferButton(msg: any, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    await msg.reply(
      'Bạn muốn chuyển tiền bằng phương thức gì',
      this.keyTransferMethod,
    );
  }
  async handleCancelButton(msg: any, options: any, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    await this.cacheManager.del(options.userId);
    const finalMessage = await msg.reply('Hủy giao dịch thành công', this.keyboardMarkup);
    this.deleteBotMessage(finalMessage, 30000)
  }
  async handleDeleteButton(userId: any) {
    const message = this.processMessages.get(userId)
    await this.deleteBotMessage(message, 0);
  }
  async deleteBotMessage(message: any, delay: number) {
    if (message?.chat) {
      const chatId = message.chat.id;
      const messageId = message.message_id;
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
  async deleteHistory(msg: any) {
    const userId = msg.update.message.from.id;
    try {
      this.startInstances.delete(userId);
      await this.cacheManager.del(userId);
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
      const message = await msg.reply(`History deleted successfully at ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`, this.handleStart(msg));
      this.deleteBotMessage(message, 3000);
    }
    catch (err) {
      console.error(err);
      await msg.reply(`Some thing went wrong`);
    }
  }
  async getAllChatIds() {
    const client = await this.telegramClient();
    const result = await client.invoke(
      new Api.messages.GetChats({
      })
    );
    console.log(result); // prints the result
  }
}

