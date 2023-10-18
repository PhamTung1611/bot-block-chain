import { Inject, Injectable } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletStatus } from 'src/wallet/wallet.status.enum';
import { Button } from './enum/button.enum';
import { Action } from './enum/action.enum';
import { TransactionStatus } from 'src/transaction/enum/transaction.enum';

interface DataCache {
  action: string;
  step: number;
  money: string;
  receiver?: string;
  sender?: string;
}

@Injectable()
export class TelegramService {
  private bot: Telegraf;
  private keyboardMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback('Deposit', Button.DEPOSIT),
      Markup.button.callback('Withdraw', Button.WITHDRAW),
    ],
    [
      Markup.button.callback('Transaction', Button.TRANSACTION),
      Markup.button.callback('Information', Button.INFORMATION),
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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.bot = new Telegraf('6205015883:AAED1q2wQ_s1c99RCjSMzfMuBivzrLFxCoI');
    this.bot.start(this.handleStart.bind(this));
    this.bot.on('text', this.handleMessage.bind(this));
    this.bot.action(/.*/, this.handleButton.bind(this));
    this.bot.launch();
  }

  async handleStart(ctx: any) {
    const options = {
      id: ctx.update.message.from.id,
      username: ctx.update.message.from.first_name,
    };
    const checkUser = await this.wallerService.findOneUser(options.id);

    if (!checkUser) {
      await ctx.reply(
        `Xin chào ${options.username}. Bạn chưa có tài khoản vui lòng tạo một tài khoản để tiếp tục`,
        this.keyCreateAccount,
      );
    } else {
      await ctx.reply(
        `Xin chào ${options.username}, tôi có thể giúp gì cho bạn!`,
        this.keyboardMarkup,
      );
    }
  }
  async handleMessage(msg: any) {
    const options = {
      idUser: msg.update.message.from.id,
      username: msg.update.message.from.first_name,
      text: msg.update.message.text,
    };
    const data: DataCache = await this.cacheManager.get(options.idUser);
    if (!data) {
      return await msg.reply(
        'Xin lỗi, tôi không hiểu. Vui lòng thử lại',
        this.keyboardMarkup,
      );
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
        await this.handleTransferByAddressAction(msg, options, data)
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
      user_id: msg.update.callback_query.from.id,
      user_name: msg.update.callback_query.from.first_name,
      data: msg.update.callback_query.data,
    };
    const data: DataCache = (await this.cacheManager.get(options.user_id)) || {
      action: '',
      step: 1,
      money: '',
    };
    const checkUser = await this.wallerService.findOneUser(options.user_id);
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
        await this.cacheManager.del(options.user_id);
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
    if (data.step === 1) {
      const Money = options.text;
      if (!Number(Money)) {
        await this.cacheManager.del(options.idUser);
        return await msg.reply(
          'Vui lòng thực hiện lại',
          this.keyboardMarkup,
        );
      }
      if (Number(Money) && Number(Money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.idUser, data, 30000);
      } else {
        await this.cacheManager.del(options.idUser);
        await msg.reply(`Vui lòng thực hiện lại`, this.keyboardMarkup);
      }
      if (data.step === 2) {
        await this.cacheManager.set(options.idUser, data, 30000);
        const addressWallet = await this.wallerService.getAddressById(
          options.idUser,
        );
        const address = await this.wallerService.checkAddress(
          options.idUser,
        );
        const createTransaction = {
          balance: String(data.money),
          type: String(data.action),
          senderAddress: address,
          receiverAddress: address,
          status: TransactionStatus.CREATED,
        };
        const transaction = await this.transactionService.createTransaction(createTransaction);

        await msg.reply(`processing...`);
        const mint = await this.wallerService.mint(
          addressWallet,
          Number(data.money),
        );
        await this.transactionService.updateTransactionState(
          TransactionStatus.PENDING, transaction.id
        );

        if (!mint) {
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL, transaction.id
          );
          await this.cacheManager.del(options.idUser);
          await msg.reply(`Nạp tiền thất bại`);
          await msg.reply(
            'Tôi có thể giúp gì tiếp cho bạn',
            this.keyboardMarkup,
          );
          return;
        } else {
          await this.transactionService.updateTransactionState(
            TransactionStatus.SUCCESS, transaction.id
          );
          await this.cacheManager.del(options.idUser);
          await msg.reply(`Nạp tiền thành công`);
          await msg.reply(
            'Tôi có thể giúp gì tiếp cho bạn',
            this.keyboardMarkup,
          );
          return;
        }
      }
    }
  }
  async handleWithDrawAction(msg: any, options: any, data: DataCache) {
    if (data.step === 1) {
      const Money = options.text;
      if (!Number(Money)) {
        await this.cacheManager.del(options.idUser);
        return await msg.reply(
          'Vui lòng thực hiện lại',
          this.keyboardMarkup,
        );
      }
      if (Number(Money) && Number(Money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.idUser, data, 30000);
      } else {
        await msg.reply(`Rút tiền thất bại, vui lòng thử lại`);
        await this.cacheManager.del(options.idUser);
        await msg.reply(
          'Tôi có thể giúp gì tiếp cho bạn',
          this.keyboardMarkup,
        );
      }
      if (data.step === 2) {
        await this.cacheManager.set(options.idUser, data, 30000);

        const address = await this.wallerService.checkAddress(
          options.idUser,
        );
        const createTransaction = {
          balance: String(data.money),
          type: String(data.action),
          senderAddress: address,
          receiverAddress: address,
          status: TransactionStatus.CREATED,
        };
        const transaction = await this.transactionService.createTransaction(createTransaction);
        const balance = await this.wallerService.getBalance(address);
        if (Number(balance) < Number(data.money)) {
          await this.cacheManager.del(options.idUser);
          await msg.reply(`Rút tiền thất bại`);
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL, transaction.id
          );
          await msg.reply(
            'Tôi có thể giúp gì tiếp cho bạn',
            this.keyboardMarkup,
          );
          return;
        }
        const privateKey = await this.wallerService.checkPrivateKeyByID(
          options.idUser,
        );
        await this.transactionService.updateTransactionState(
          TransactionStatus.PENDING, transaction.id
        );
        await msg.reply(`processing....`);

        const burn = await this.wallerService.burn(
          data.money,
          privateKey,
          address,
        );
        if (!burn) {
          await this.transactionService.updateTransactionState(
            TransactionStatus.FAIL, transaction.id
          );
          await msg.reply(`Rút tiền thất bại`);
          await msg.reply(
            'Tôi có thể giúp gì tiếp cho bạn',
            this.keyboardMarkup,
          );
          return;
        }
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS, transaction.id
        );
        await this.cacheManager.del(options.idUser);
        await msg.reply(`Rút tiền thành công`);
        await msg.reply(
          'Tôi có thể giúp gì tiếp cho bạn',
          this.keyboardMarkup,
        );
        return;
      }
    }
  }
  async handleHistoryAction(msg: any, options: any, data: DataCache) {
    const address = await this.wallerService.checkAddress(options.idUser);

    const listHistory =
      await this.transactionService.getListHistory(address);
    if (data.step === 1) {
      const amountHistory = options.text;
      if (!Number(amountHistory)) {
        await this.cacheManager.del(options.idUser);
        return await msg.reply(
          'Vui lòng thực hiện lại',
          this.keyboardMarkup,
        );
      } else if (Number(listHistory) < Number(amountHistory)) {
        await this.cacheManager.del(options.idUser);
        return await msg.reply(
          `Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`,
          this.keyboardMarkup,
        );
      } else {
        const selectHistory =
          await this.transactionService.getAmountHistory(
            Number(amountHistory),
            address,
          );
        for (const item of selectHistory) {
          await msg.reply(
            `Mã giao dịch:\n ${item?.id}\nSố tiền: ${item?.balance}\nKiểu: ${item?.type}\nTài khoản nguồn: ${item.senderAddress}\nTài khoản nhận: ${item.receiverAddress}\n Trạng thái: ${item.status}`,
          );
        }
        await this.cacheManager.del(options.idUser);
        await msg.reply(
          'Tôi có thể giúp gì tiếp cho bạn',
          this.keyboardMarkup,
        );
      }
    }
  }
  async handleTransferByAddressAction(msg: any, options: any, data: DataCache) {
    if (data.step === 1) {
      const address = options.text;
      data.step = 2;
      const checkAddress =
        await this.wallerService.checkWalletByAddress(address);
      if (checkAddress === WalletStatus.NOT_FOUND) {
        await msg.reply(`Địa chỉ người dùng không tồn tại`);
        await this.cacheManager.del(options.idUser);
        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
        return;
      }
      if (data.action === Action.TRANSFER_BY_ADDRESS) {
        data.action = Action.SEND_MONEY_ADDRESS;
        data.step = 3;
        data.receiver = address;
        await msg.reply('Bạn muốn chuyển bao nhiêu tiền');
        return;
      }
    } else {
      await msg.reply(`Có gì đó không ổn vui lòng thử lại`);
      await this.cacheManager.del(options.idUser);
    }
  }
  async handleSendMoneyAction(msg: any, options: any, data: DataCache) {
    if (data.action === Action.SEND_MONEY_ADDRESS) {
      const money = options.text;
      if (!Number(money)) {
        await this.cacheManager.del(options.idUser);
        return await msg.reply(
          'Vui lòng thực hiện lại',
          this.keyTransferMethod,
        );
      }
      if (Number(money) && Number(money) > 0) {
        data.money = options.text;
        data.step = 2;
        await this.cacheManager.set(options.idUser, data, 30000);
      }
      const receiver = data.receiver;
      const sender = await this.wallerService.getAddressById(
        options.idUser,
      );
      const createTransaction = {
        balance: String(data.money),
        type: Action.SEND_MONEY_ADDRESS,
        senderAddress: sender,
        receiverAddress: receiver,
        status: TransactionStatus.CREATED,
      };
      //initialize Transaction and save to db
      const transaction = await this.transactionService.createTransaction(createTransaction);
      await msg.reply(`processing...`);
      const checkStatus = await this.wallerService.sendMoneybyAddress(
        options.idUser,
        receiver,
        money,
      );
      await this.transactionService.updateTransactionState(
        TransactionStatus.PENDING, transaction.id
      );
      if (checkStatus === TransactionStatus.SUCCESS && data.step === 2) {
        await this.transactionService.updateTransactionState(
          TransactionStatus.SUCCESS, transaction.id
        );
        await msg.reply(`Chuyển tiền thành công`);
        data.step = 1;
        data.action = '';
        await msg.reply(
          'Tôi có thể giúp gì tiếp cho bạn',
          this.keyboardMarkup,
        );
      } else if (checkStatus === WalletStatus.NOT_ENOUGH_FUND) {
        await msg.reply(
          `Không đủ tiền trong tài khoản, vui lòng thử lại`,
          this.keyTransferMethod,
        );
        this.cacheManager.del(options.idUser);

      } else if (checkStatus === WalletStatus.SELF) {
        await msg.reply(
          `Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`,
        );
        this.cacheManager.del(options.idUser);
        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
      } else {
        await msg.reply(`Chuyển tiền thất bại`, this.keyTransferMethod);
        await this.transactionService.updateTransactionState(
          TransactionStatus.FAIL, transaction.id
        );
        this.cacheManager.del(options.idUser);

      }
    }
  }
  //Button Handler
  async setCache(options: any, action: Action, step: number) {
    await this.cacheManager.set(
      options.user_id,
      {
        action: action,
        step: step,
      },
      30000,
    );
  }
  async handleCreateAccountButton(msg: any, options: any, data: DataCache, checkUser: any) {
    if (data.action === '') {
      if (!checkUser) {
        const wallet = await this.wallerService.generateNewWallet();
        const user = {
          id_user: msg.chat.id,
          user_name: msg.chat.first_name,
        };
        await msg.reply(`Tạo tài khoản cho user ${user.id_user}`);
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
            `Xin chào ${options.user_name}, tôi có thể giúp gì cho bạn!`,
            this.keyboardMarkup,
          );
          await this.cacheManager.del(options.user_id);
        }
      } else {
        await this.cacheManager.del(options.user_id);
        return await msg.reply(
          'Bạn đã có tài khoản vui lòng thực hiện chức năng khác',
          this.keyboardMarkup,
        );
      }
    } else {
      await this.cacheManager.del(options.user_id);
    }
  }
  async handleDepositButton(msg: any, options: any, data: DataCache, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.DEPOSIT, 1);
      await msg.reply('Bạn muốn nạp bao nhiêu tiền');
    } else {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.DEPOSIT, 1);
      await msg.reply('Bạn muốn nạp bao nhiêu tiền');
    }
  }
  async handleWithDrawButton(msg: any, options: any, data: DataCache, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.WITHDRAW, 1);
      await msg.reply('Bạn muốn rút bao nhiêu tiền');
    } else {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.WITHDRAW, 1);
      await msg.reply('Bạn muốn rút bao nhiêu tiền');
    }
  }
  async handleHistoryButton(msg: any, options: any, data: DataCache, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    const address = await this.wallerService.checkAddress(options.user_id);

    const listHistory =
      await this.transactionService.getListHistory(address);
    if (Number(listHistory) === 0) {
      await msg.reply('Bạn không có lịch sử giao dịch nào');
      return await msg.reply(
        'Tôi có thể giúp gì tiếp cho bạn',
        this.keyboardMarkup,
      );
    }
    if (data.action === '') {
      this.setCache(options, Action.HISTORY, 1);
      await msg.reply(
        `Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`,
      );
    } else {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.HISTORY, 1);
    }
  }
  async handleInformationButton(msg: any, options: any, data: any, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action !== '') {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.INFORMATION, 1);
    }
    const info = await this.wallerService.checkInformation(options.user_id);
    await msg.reply(`Private Key:${info.privateKey}`);
    await msg.reply(`Public Key:${info.publicKey}`);
    await msg.reply(`Address:${info.address}`);
    const add = await this.wallerService.getAddressById(options.user_id);
    const balane = await this.wallerService.getBalance(add);
    await msg.reply(`Username:${info.user_name} \n Balance:${balane}`);
    await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
    await this.cacheManager.del(options.user_id);
  }
  async handleTransactionButton(msg: any, options: any, data: any, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if(data.action !==''){
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.TRANSACTION, 1);
    }
    await msg.reply('Phương thức chuyển tiền:', this.keyTransactionService);
  }
  async handleWalletAddressButton(msg: any, options: any, data: DataCache, checkUser: any) {
    if (!checkUser) {
      return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
    }
    if (data.action === '') {
      this.setCache(options, Action.TRANSFER_BY_ADDRESS, 1);
      await msg.reply('Điền địa chỉ người nhận');
    } else {
      await msg.reply(`Canceling ${data.action}`);
      await this.cacheManager.del(options.user_id);
      this.setCache(options, Action.TRANSFER_BY_ADDRESS, 1);
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
    await this.cacheManager.del(options.user_id);
    await msg.reply('Hủy giao dịch thành công', this.keyboardMarkup);
  }
}
