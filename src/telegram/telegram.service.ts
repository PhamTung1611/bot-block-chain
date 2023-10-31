import { Inject, Injectable } from '@nestjs/common';
import {
  session, Markup, Telegraf, Context
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
interface MyContext<U extends Update = Update> extends Context<U> {
  session: {
    count: number
  },
};

import { format } from 'date-fns'
import { Api } from "telegram/tl"
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import { botCommand } from 'src/constants/commands/telegram.commands';
import { Update } from 'telegraf/typings/core/types/typegram';

@Injectable()
export class TelegramService {
  // Create an array to store messages for each user
  private messages: Map<number, string[]> = new Map();
  private apiId = 28122207;
  private apiHash = "bc03db1a7cbd350044d095a74410dfee";
  private stringSession = new StringSession("1BQANOTEuMTA4LjU2LjE1MQG7f/fCUm/Eb1mEXkGR6p01XvpAaZDEdi/xCMG6cQmzSPoqnRiuGdlkT7okaa7toAM7ar6MQJpfjtrKcOEHI8ncNZbc9roSYjRi9REHKfuUOr+nlTl+Ywkwb7VOTkDgCc1m/gUuHpRsWVInpm8uRXqt3kELEujO+ydYXNPnDsVMlnE8LGp1Bsxxt6a5TbNpGkE5vhc8ExX4gKKMOO5Dar55q6Lx66/EjbENLU1gShcRalGzMGdqXQqret+joFKC+5wIfuSLEHetI+5jIyiMDMm6jIJT4GVdnFfZw1hTBzHN/ZuhYJKPudZ0mGjBFpBKxzsqMqY2LCgoHOyikxTV06KJ3Q==");
  private bot = new Telegraf<MyContext>(this.configService.get('bot-token'));

  private keyboardMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback('Deposit', Button.DEPOSIT),
      Markup.button.callback('Withdraw', Button.WITHDRAW),
      Markup.button.callback('Transfer', Button.WALLET_ADDRESS),
    ],
    [
      Markup.button.callback('Transaction History', Button.HISTORY),
      Markup.button.callback('Balance', Button.INFORMATION),
    ],
    //  [
    //     Markup.button.callback('Test', Button.TEST)
    // ]
  ]);

  private keyCreateAccount = Markup.inlineKeyboard([
    [Markup.button.callback('CreateAccount', Button.CREATE)],
  ]);

  private keyTransactionService = Markup.inlineKeyboard([
    [
      Markup.button.callback('Transfer Money', Button.TRANSFER),
      Markup.button.callback('Transaction History', Button.HISTORY),
      // Markup.button.callback('Search', Button.SEARCH),
    ],
    [Markup.button.callback('Cancel', Button.CANCEL)],

  ]);
  private keyTransferMethod = Markup.inlineKeyboard([
    [Markup.button.callback('Wallet address', Button.WALLET_ADDRESS)],
    [Markup.button.callback('Cancel', Button.CANCEL)],
  ]);

  constructor(
    private transactionService: TransactionService,
    private wallerService: WalletService,
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

  async loginToTelegram() {
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
    console.log("connected to telegram api server");
    console.log(client.session.save()); // Save this string to avoid logging in again
    return client;
  }
  async handleStart(ctx: any) {
    const options = {
      userId: ctx.update.message.from.id,
      username: ctx.update.message.from.first_name,
    };
    const checkUser = await this.wallerService.findOneUser(options.userId);

    if (!checkUser) {
      await ctx.replyWithHTML(
        `Xin chào <a href="tg://user?id=${options.userId}">@${options.username}</a> ! Bạn chưa có tài khoản vui lòng tạo một tài khoản để tiếp tục`,
        this.keyCreateAccount,
      );
    } else {
      const nativeToken = await this.wallerService.getUserNativeToken(checkUser.address)
      const message = await ctx.replyWithHTML(`
    Xin chào <a href="tg://user?id=${options.userId}">@${options.username}</a>\nĐây là địa chỉ ví của bạn!\n<code>${checkUser.address}</code>\n
Hiện Tài khoản bạn đang có:<b> ${nativeToken} PGX </b>\n
Theo dõi giao dịch <a href="https://testnet.miraiscan.io/address/${checkUser.address}"><u>click here</u>!</a>\n 
Nạp thêm <b>PGX</b> <a href="https://faucet.miraichain.io/"><u>click here</u>!</a> 
` , this.keyboardMarkup);
      try {
        const userMessages = this.messages.get(options.userId) || [];
        console.log(userMessages.length);
        userMessages.push(message);
        if (userMessages.length > 1) {
          userMessages.reverse();
          await this.deleteBotMessage(userMessages[1], 0);
          userMessages.pop();
        }
        this.messages.set(options.userId, userMessages);
      }
      catch (err) {
        console.log('error here');
      }
    }
  }

  async handleMessage(msg: any) {
    const options = {
      userId: msg.update.message.from.id,
      username: msg.update.message.from.first_name,
      text: msg.update.message.text,
    };

    const data: DataCache = await this.cacheManager.get(options.userId);
    if (!data) {
      switch (options.text) {
        case '/clear':
          return await this.deleteHistory(msg);
        case '/info':
          return await msg.reply('havent implemented')
        case '/help':
          return await msg.reply('havent implemented')
        default:
          const finalMessage = await msg.reply('Xin lỗi, tôi không hiểu. Vui lòng thử lại');
          return this.deleteBotMessage(finalMessage, 1000)
      }
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
        await msg.reply('Xin lỗi, tôi không hiểu', this.keyboardMarkup);
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
    const checkUser = await this.wallerService.findOneUser(options.userId);
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
      case Button.TRANSACTION:
        await this.handleTransactionButton(msg, options, data, checkUser);
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
      default:
        await this.cacheManager.del(options.userId);
        await msg.reply(`Xin lỗi tôi không hiểu`);
        await msg.reply(
          'Tôi chỉ thực hiện được như bên dưới thôi!',
          this.keyboardMarkup,
        );
        break;
    }
  }
  //Action Handler
  async handleDepositAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.step === 1) {
      const Money = options.text;
      if (!Number(Money)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply('Vui lòng thực hiện lại');
        //this.deleteBotMessage(finalMessage, 1000)
        messages.push(message);
      }
      if (Number(Money) && Number(Money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.userId, data, 30000);
      } else {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply(`Vui lòng thực hiện lại`);
        // this.deleteBotMessage(finalMessage, 1000)
        messages.push(message);
      }
      if (data.step === 2) {
        await this.cacheManager.set(options.userId, data, 30000);
        const addressWallet = await this.wallerService.getAddressById(
          options.userId,
        );
        const address = await this.wallerService.checkAddress(options.userId);
        const createTransaction = {
          balance: String(data.money),
          type: String(data.action),
          senderAddress: address,
          receiverAddress: address,
          status: TransactionStatus.CREATED,
        };
        const transaction =
          await this.transactionService.createTransaction(createTransaction);
        const message = await msg.reply(`processing...`);
        messages.push(message);
        // this.deleteBotMessage(finalMessage, 2000)
        if (data.money.toString().length > 65) {
          const message = await msg.reply(`Số tiền quá lớn`);
          messages.push(message);
          // this.deleteBotMessage(finalMessage, 1000)
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          await this.cacheManager.del(options.userId);
          return;
        }
        const mint = await this.wallerService.mint(addressWallet, data.money);
        await this.transactionService.updateTransactionState(
          TransactionStatus.PENDING,
          transaction.id,
        );

        if (!mint) {
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          await this.cacheManager.del(options.userId);
          const message = await msg.reply(`Nạp tiền thất bại`);
          messages.push(message);
          //this.deleteBotMessage(finalMessage, 1000)
          return;
        } else {
          await this.transactionService.updateTransactionState(
            TransactionStatus.SUCCESS,
            transaction.id,
          );
          await this.cacheManager.del(options.userId);
          const message = await msg.reply(`Nạp tiền thành công`, this.handleStart(msg));
          messages.push(message);
          console.log(messages);
          for (const message of messages) {
            this.deleteBotMessage(message, 3000);
          }
          //this.deleteBotMessage(finalMessage, 1000)
          return;
        }
      }
    }
  }
  async handleWithDrawAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.step === 1) {
      const Money = options.text;
      if (!Number(Money)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply('Vui lòng thực hiện lại');
        messages.push(message);
        //this.deleteBotMessage(finalMessage, 1000)
      }
      if (Number(Money) && Number(Money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.userId, data, 30000);
      } else {
        const message = await msg.reply(`Rút tiền thất bại, vui lòng thử lại`);
        messages.push(message);
        // this.deleteBotMessage(finalMessage, 1000)
        await this.cacheManager.del(options.userId);
      }
      if (data.step === 2) {
        await this.cacheManager.set(options.userId, data, 30000);

        const address = await this.wallerService.checkAddress(options.userId);
        const createTransaction = {
          balance: String(data.money),
          type: String(data.action),
          senderAddress: address,
          receiverAddress: address,
          status: TransactionStatus.CREATED,
        };
        const transaction =
          await this.transactionService.createTransaction(createTransaction);
        const balance = await this.wallerService.getBalance(address);
        if (Number(balance) < Number(data.money)) {
          await this.cacheManager.del(options.userId);
          const message = await msg.reply(`Tài khoản không đủ tiền`);
          messages.push(message);
          //this.deleteBotMessage(finalMessage, 1000)
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          return;
        }
        const privateKey = await this.wallerService.checkPrivateKeyByID(
          options.userId,
        );
        await this.transactionService.updateTransactionState(
          TransactionStatus.PENDING,
          transaction.id,
        );
        const message = await msg.reply(`processing....`);
        messages.push(message);
        //   this.deleteBotMessage(finalMessage, 3000)

        const burn = await this.wallerService.burn(data.money, privateKey);
        if (!burn) {
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL,
            transaction.id,
          );
          const message = await msg.reply(`Rút tiền thất bại`);
          messages.push(message);
          // this.deleteBotMessage(finalMessage, 1000)
          return;
        }
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS,
          transaction.id,
        );
        await this.cacheManager.del(options.userId);
        const message1 = await msg.reply(`Rút tiền thành công`, this.handleStart(msg));
        messages.push(message1);
        // this.deleteBotMessage(finalMess, 1000)
        for (const message of messages) {
          this.deleteBotMessage(message, 3000);
        }
        return;
      }
    }
  }
  async handleHistoryAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    const address = await this.wallerService.checkAddress(options.userId);

    const listHistory = await this.transactionService.getListHistory(address);
    if (data.step === 1) {
      const amountHistory = options.text;
      if (!Number(amountHistory)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
        messages.push(message);
        //return this.deleteBotMessage(finalMessage, 1000)
      } else if (Number(listHistory) < Number(amountHistory)) {
        await this.cacheManager.del(options.userId);
        const message = await msg.reply(
          `Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`);
        messages.push(message);
        // this.deleteBotMessage(finalMessage, 1000)
      } else {
        const selectHistory = await this.transactionService.getAmountHistory(
          Number(amountHistory),
          address,
        );
        for (const item of selectHistory) {
          const message = await msg.reply(
            `Mã giao dịch:\n ${item?.id}\nSố tiền: ${item?.balance}\nKiểu: ${item?.type}\nTài khoản nguồn: ${item.senderAddress}\nTài khoản nhận: ${item.receiverAddress}\n Trạng thái: ${item.status}`,
          );
          messages.push(message);
          // this.deleteBotMessage(finalMessage, 10000)
        }
        const message = msg.replyWithHTML(`Bạn đang xem <b>${selectHistory.length} giao dịch </b>`, this.handleStart(msg));
        //    messages.push(message);
        await this.cacheManager.del(options.userId);
        for (const message of messages) {
          this.deleteBotMessage(message, 30000);
        }

      }
    }
  }
  async handleTransferByAddressAction(msg: any, options: any, data: DataCache) {
    if (data.step === 1) {
      const address = options.text;
      data.step = 2;
      const checkAddress =
        await this.wallerService.checkAddressContract(address);
      if (!checkAddress) {
        await msg.reply(`Địa chỉ người dùng không tồn tại`);
        await this.cacheManager.del(options.userId);
        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
        return;
      }
      if (data.action === Action.TRANSFER_BY_ADDRESS) {
        data.action = Action.SEND_MONEY_ADDRESS;
        data.step = 3;
        data.receiver = address;
        const message = await msg.reply('Bạn muốn chuyển bao nhiêu tiền');
        this.deleteBotMessage(message, 5000)
        return;
      }
    } else {
      await msg.reply(`Có gì đó không ổn vui lòng thử lại`);
      await this.cacheManager.del(options.userId);
    }
  }
  async handleSendMoneyAction(msg: any, options: any, data: DataCache) {
    const messages = [];
    if (data.action === Action.SEND_MONEY_ADDRESS) {
      const money = options.text;
      if (!Number(money)) {
        await this.cacheManager.del(options.userId);
        return await msg.reply(
          'Vui lòng thực hiện lại',
          this.keyTransferMethod,
        );
      }
      if (Number(money) && Number(money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.userId, data, 30000);
      }
      const receiver = data.receiver;
      const sender = await this.wallerService.getAddressById(options.userId);
      const createTransaction = {
        balance: String(data.money),
        type: Action.SEND_MONEY_ADDRESS,
        senderAddress: sender,
        receiverAddress: receiver,
        status: TransactionStatus.CREATED,
      };
      const transaction =
        await this.transactionService.createTransaction(createTransaction);
      const message = await msg.reply(`processing...`);
      messages.push(message);
      // this.deleteBotMessage(finalMessage, 1000)

      const checkStatus = await this.wallerService.sendMoneybyAddress(
        options.userId,
        receiver,
        money,
      );
      await this.transactionService.updateTransactionState(
        TransactionStatus.PENDING,
        transaction.id,
      );
      if (checkStatus === TransactionStatus.SUCCESS && data.step === 2) {
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS,
          transaction.id,
        );
        const message = await msg.reply(`Chuyển tiền thành công`, this.handleStart(msg));
        messages.push(message);
        // this.deleteBotMessage(finalMessage, 1000)
        data.step = 1;
        data.action = '';
      } else if (checkStatus === WalletStatus.NOT_ENOUGH_FUND) {
        const message = await msg.reply(
          `Không đủ tiền trong tài khoản, vui lòng thử lại`,
          this.handleStart(msg),
        );
        messages.push(message);
        //this.deleteBotMessage(finalMessage, 1000)
        this.cacheManager.del(options.userId);
      } else if (checkStatus === WalletStatus.SELF) {
        const message = await msg.reply(
          `Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`, this.handleStart(msg)
        );
        messages.push(message);
        //this.deleteBotMessage(finalMessage, 2000)

        this.cacheManager.del(options.userId);
      } else {
        const message = await msg.reply(`Chuyển tiền thất bại`, this.handleStart(msg));
        messages.push(message);
        // this.deleteBotMessage(finalMessage, 1000)
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
  async handleCreateAccountButton(
    msg: any,
    options: any,
    data: DataCache,
    checkUser: any,
  ) {
    if (data.action === '') {
      if (!checkUser) {
        const wallet = await this.wallerService.generateNewWallet();
        const user = {
          userId: msg.chat.id,
          username: msg.chat.first_name,
        };
        await msg.reply(`Tạo tài khoản cho user ${user.userId}`);
        const data = await this.wallerService.createWallet(
          {
            ...wallet,
            ...user,
          },
          wallet.address,
        );

        if (data) {
          await msg.reply(`Tạo tài khoản thành công`);
          await msg.reply(
            `Xin chào ${options.userId}, tôi có thể giúp gì cho bạn!`,
            this.keyboardMarkup,
          );
          await this.cacheManager.del(options.userId);
        }
      } else {
        await this.cacheManager.del(options.userId);
        return await msg.reply(
          'Bạn đã có tài khoản vui lòng thực hiện chức năng khác',
          this.keyboardMarkup,
        );
      }
    } else {
      await this.cacheManager.del(options.userId);
    }
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
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.DEPOSIT, 1);
      const finalMessage = await msg.reply('Bạn muốn nạp bao nhiêu tiền');
      this.deleteBotMessage(finalMessage, 10000)
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
    const address = await this.wallerService.checkAddress(options.userId);

    const listHistory = await this.transactionService.getListHistory(address);
    if (Number(listHistory) === 0) {
      const finalMessage = await msg.reply('Bạn không có lịch sử giao dịch nào');
      return this.deleteBotMessage(finalMessage, 10000)
    }
    if (data.action === '') {
      this.setCache(options, Action.HISTORY, 1);
      const finalMessage = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(finalMessage, 30000)
    } else {
      // await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.HISTORY, 1);
      const finalMessage = await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
      this.deleteBotMessage(finalMessage, 30000)
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
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.INFORMATION, 1);
    }
    // const info = await this.wallerService.checkInformation(options.userId);
    const add = await this.wallerService.getAddressById(options.userId);
    const balane = await this.wallerService.getBalance(add);
    const finalMessage = await msg.replyWithHTML(`Balance:${balane} <b>HUSD</b>`);
    this.deleteBotMessage(finalMessage, 30000)
    await this.cacheManager.del(options.userId);
  }
  async handleTransactionButton(
    msg: any,
    options: any,
    data: any,
    checkUser: any,
  ) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action !== '') {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.TRANSACTION, 1);
    }
    await msg.reply('Phương thức chuyển tiền:', this.keyTransactionService);
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
      this.deleteBotMessage(finalMessage, 30000)
    } else {
      // await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.userId);
      this.setCache(options, Action.TRANSFER_BY_ADDRESS, 1);
      const finalMessage = await msg.reply('Điền địa chỉ người nhận');
      this.deleteBotMessage(finalMessage, 30000)
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
  async deleteBotMessage(message: any, delay: number) {
    const chatId = message.chat.id;
    const messageId = message.message_id;
    setTimeout(() => {
      (async () => {
        await this.bot.telegram.deleteMessage(chatId, messageId);
      })();
    }, delay);
  }

  async deleteHistory(msg: any) {
    const userId = msg.update.message.from.id
    this.messages.delete(userId);
    await this.cacheManager.del(userId);
    const client = await this.loginToTelegram();
    const result = await client.invoke(
      new Api.messages.DeleteHistory({
        peer: this.configService.get('bot-url'),
        maxId: 0,
        justClear: true,
        revoke: true,
        minDate: 43,
      })
    );
    msg.reply(`History deleted successfully at ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`);
    //console.log(result); // prints the result
  }

}

