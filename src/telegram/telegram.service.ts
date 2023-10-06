import { Inject, Injectable } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletStatus } from 'src/wallet/wallet.status.enum';
import { Button } from './enum/button.enum';
import { Action } from './enum/action.enum';

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
        ], [
            Markup.button.callback('Transaction', Button.TRANSACTION),
            Markup.button.callback('Information', Button.INFORMATION),
        ]
    ]);

    private keyCreateAccount = Markup.inlineKeyboard([
        [
            Markup.button.callback('CreateAccount', Button.CREATE),
        ]
    ])

    private keyTransactionService = Markup.inlineKeyboard([
        [
            Markup.button.callback('Transfer Money', Button.TRANSFER),
            Markup.button.callback('Transaction History', Button.HISTORY),
        ],
        [
            Markup.button.callback('Cancel', Button.CANCEL)
        ]
    ])
    private keyTransferMethod = Markup.inlineKeyboard([
        [
            Markup.button.callback('Wallet address', Button.WALLET_ADDRESS),
            Markup.button.callback('Wallet publickey', Button.PUBLICKEY),
        ],
        [
            Markup.button.callback('Cancel', Button.CANCEL)
        ]

    ])

    constructor(
        private transactionService: TransactionService,
        private wallerService: WalletService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache

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
            await ctx.reply(`Xin chào ${options.username}. Bạn chưa có tài khoản vui lòng tạo một tài khoản để tiếp tục`, this.keyCreateAccount);
        } else {
            await ctx.reply(`Xin chào ${options.username}, tôi có thể giúp gì cho bạn!`, this.keyboardMarkup)
        }
        // await ctx.reply(`Xin chào ${options.username}, tôi có thể giúp gì cho bạn!`, this.keyboardMarkup);
    }

    async handleMessage(msg: any) {
        const options = {
            idUser: msg.update.message.from.id,
            username: msg.update.message.from.first_name,
            text: msg.update.message.text,
        }
        const data: DataCache = (await this.cacheManager.get(options.idUser)) as DataCache;
        if (!data) {
            return await msg.reply(
                'Xin lỗi, tôi không hiểu. Vui lòng thử lại', this.keyboardMarkup,
            );
        }
        switch (data.action) {
            case Action.DEPOSIT:
                if (data.step === 1) {
                    const Money = options.text;
                    if (!Number(Money)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
                    }
                    if (Number(Money) && Number(Money) > 0) {
                        data.money = options.text;
                        data.step = 2;
                        await this.cacheManager.set(options.idUser, data, 30000);
                    }
                    if (data.step === 2) {
                        await this.cacheManager.set(options.idUser, data, 30000);
                        await this.wallerService.updateMoney(options.idUser, Number(data.money));
                        const address = await this.wallerService.checkAddress(options.idUser)
                        const createTransaction = {
                            balance: String(data.money),
                            type: String(data.action),
                            senderAddress: address,
                            receiverAddress: address
                        }
                        await this.transactionService.createTransaction(createTransaction);
                        await this.cacheManager.del(options.idUser);
                        await msg.reply(`Nạp tiền thành công`);
                        await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                    }
                }
                break;
            case Action.WITHDRAW:
                if (data.step === 1) {
                    const Money = options.text;
                    if (!Number(Money)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
                    }
                    if (Number(Money) && Number(Money) > 0) {
                        data.money = options.text;
                        data.step = 2;
                        await this.cacheManager.set(options.idUser, data, 30000);
                    }
                    if (data.step === 2) {
                        await this.cacheManager.set(options.idUser, data, 30000);
                        await this.wallerService.withdrawn(options.idUser, Number(data.money));
                        const address = await this.wallerService.checkAddress(options.idUser)
                        const createTransaction = {
                            balance: String(data.money),
                            type: String(data.action),
                            senderAddress: address,
                            receiverAddress: address
                        }
                        await this.transactionService.createTransaction(createTransaction);
                        await this.cacheManager.del(options.idUser);
                        await msg.reply(`Rút tiền thành công`);
                        await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                    }
                }
                break;
            case Action.HISTORY:
                const address = await this.wallerService.checkAddress(options.idUser)

                const listHistory = await this.transactionService.getListHistory(address)
                if (data.step === 1) {
                    const amountHistory = options.text;
                    if (!Number(amountHistory)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
                    } else {
                        if (Number(listHistory) < Number(amountHistory)) {
                            await this.cacheManager.del(options.idUser);
                            return await msg.reply(`Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`, this.keyboardMarkup);
                        } else {
                            const selectHistory = await this.transactionService.getAmountHistory(Number(amountHistory), address);
                            for (const item of selectHistory) {
                                await msg.reply(`Mã giao dịch:\n ${item?.id}\nSố tiền: ${item?.balance}\nKiểu: ${item?.type}\nTài khoản nguồn: ${item.senderAddress}\nTài khoản nhận: ${item.receiverAddress}`);
                            }
                            await this.cacheManager.del(options.idUser);
                            await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                        }
                    }
                }
                break;
            case Action.TRANSFER_BY_ADDRESS:
                if (data.step === 1) {
                    const address = options.text;
                    data.step = 2;
                    const checkAddress = await this.wallerService.checkWalletByAddress(address);
                    if (checkAddress === WalletStatus.NOT_FOUND) {
                        await msg.reply(`Địa chỉ người dùng không tồn tại`);
                        data.step = 1;
                        data.action = '';
                        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
                        break;
                    }
                    if (data.action === Action.TRANSFER_BY_ADDRESS) {
                        data.action = Action.SEND_MONEY_ADRESS;
                        data.step = 3;
                        data.receiver = address;
                        await msg.reply('Bạn muốn nạp bao nhiêu tiền');
                    }
                }
                break;
            case Action.TRANFER_BY_PUBLIC_KEY:
                if (data.step === 1) {
                    const publicKey = options.text;
                    data.step = 2;
                    const checkPublicKey = await this.wallerService.checkWalletByPublicKey(publicKey);
                    if (checkPublicKey === WalletStatus.NOT_FOUND) {
                        await msg.reply(`Mã khóa người dùng không tồn tại`);
                        data.step = 1;
                        data.action = '';
                        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
                        break;
                    }
                    if (data.action === Action.TRANFER_BY_PUBLIC_KEY) {
                        data.action = Action.SEND_MONEY_PUBLIC_KEY;
                        data.step = 3;
                        data.receiver = publicKey;
                        await msg.reply('Bạn muốn nạp bao nhiêu tiền');
                    }
                }
                break;
            case Action.SEND_MONEY_ADRESS:
                if (data.action === Action.SEND_MONEY_ADRESS) {
                    const money = options.text;
                    if (!Number(money)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyTransferMethod);
                    }
                    if (Number(money) && Number(money) > 0) {
                        data.money = options.text;
                        data.step = 2;
                        await this.cacheManager.set(options.idUser, data, 30000);
                    }
                    const receiver = data.receiver;
                    const sender = await this.wallerService.getAddressById(options.idUser);
                    const checkStatus = await this.wallerService.sendMoneybyAddress(options.idUser, receiver, money);
                    if (checkStatus === WalletStatus.SUCCESS && data.step === 2) {
                        await msg.reply(`Chuyển tiền thành công`);
                        data.step = 1;
                        data.action = '';
                        const createTransaction = {
                            balance: String(data.money),
                            type: Action.SEND_MONEY_ADRESS,
                            senderAddress: sender,
                            receiverAddress: receiver
                        }
                        const saveTransaction = await this.transactionService.createTransaction(createTransaction);
                        if (saveTransaction) {
                            await msg.reply('Giao dịch đã được lưu');
                            await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                        }
                        else{
                            await msg.reply('Giao dịch chưa được lưu');
                        }      
                    }
                    else if (checkStatus === WalletStatus.SELF) {
                        await msg.reply(`Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`);
                        data.step = 1;
                        data.action = '';
                        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
                    }
                    else {
                        await msg.reply(`Chuyển tiền thất bại`);
                    }
                }
                break;
            case Action.SEND_MONEY_PUBLIC_KEY:
                if (data.action = 'sendMoneyPublicKey') {
                    const money = options.text;
                    if (!Number(money)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyTransferMethod);
                    }
                    if (Number(money) && Number(money) > 0) {
                        data.money = options.text;
                        data.step = 2;
                        await this.cacheManager.set(options.idUser, data, 30000);
                    }
                    const publicKey = data.receiver;
                    const receiver= await this.wallerService.getAddressByPublicKey(publicKey);
                    const sender = await this.wallerService.getAddressById(options.idUser);
                    const checkStatus = await this.wallerService.sendMoneybyPublicKey(options.idUser, publicKey, money);
                    if (checkStatus === WalletStatus.SUCCESS &&  data.step === 2) {
                        await msg.reply(`Chuyển tiền thành công`);
                        data.step = 1;
                        data.action = '';
                        const createTransaction = {
                            balance: String(data.money),
                            type: Action.SEND_MONEY_PUBLIC_KEY,
                            senderAddress: sender,
                            receiverAddress: receiver
                        }
                        const saveTransaction = await this.transactionService.createTransaction(createTransaction);
                        if (saveTransaction) {
                            await msg.reply('Giao dịch đã được lưu');
                            await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                        }
                        else{
                            await msg.reply('Giao dịch chưa được lưu');
                        }  
                    }
                    else if (checkStatus === WalletStatus.SELF) {
                        await msg.reply(`Không thể chuyển tiền cho bản thân, để nạp tiền dùng Deposit`);
                        data.step = 1;
                        data.action = '';
                        await msg.reply('Vui lòng thử lại', this.keyTransferMethod);
                    }
                    else {
                        await msg.reply(`Chuyển tiền thất bại`);
                    }
                }
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
            data: msg.update.callback_query.data
        }
        const data: DataCache = ((await this.cacheManager.get(options.user_id)) as DataCache) || {
            action: '',
            step: 1,
            money: '',
        };
        const checkUser = await this.wallerService.findOneUser(options.user_id);
        switch (options.data) {
            case Button.CREATE:
                if (data.action === '') {
                    if (!checkUser) {
                        const wallet = await this.wallerService.generateNewWallet();
                        const user = {
                            id_user: msg.chat.id,
                            user_name: msg.chat.first_name,
                        }
                        const data = await this.wallerService.createWallet({ ...wallet, ...user })
                        if (data) {
                            await msg.reply(`Tạo tài khoản thành công`);
                            await msg.reply(`Xin chào ${options.user_name}, tôi có thể giúp gì cho bạn!`, this.keyboardMarkup)
                            await this.cacheManager.del(options.user_id);
                        }
                    } else {
                        await this.cacheManager.del(options.user_id)
                        return await msg.reply('Bạn đã có tài khoản vui lòng thực hiện chức năng khác', this.keyboardMarkup)
                    }
                } else {
                    await this.cacheManager.del(options.user_id)
                }
                break;
            case Button.DEPOSIT:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: Action.DEPOSIT,
                        step: 1,
                    }, 30000);
                    await msg.reply('Bạn muốn nạp bao nhiêu tiền');
                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case Button.HISTORY:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                const address = await this.wallerService.checkAddress(options.user_id)

                const listHistory = await this.transactionService.getListHistory(address)
                if (Number(listHistory) === 0) {
                    await msg.reply('Bạn không có lịch sử giao dịch nào');
                    return await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: Action.HISTORY,
                        step: 1,
                    }, 15000);

                    await msg.reply(`Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`);

                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case Button.INFORMATION:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                const info = await this.wallerService.checkInformation(options.user_id);
                await msg.reply(`Private Key:${info.privateKey} \n ID Address:${info.address} \n Username:${info.user_name} \n Balance:${info.balance}`)
                await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                await this.cacheManager.del(options.user_id);
                break;
            case Button.TRANSACTION:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                await msg.reply('Phương thức chuyển tiền:', this.keyTransactionService);
                break;
            case Button.WALLET_ADDRESS:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: Action.TRANSFER_BY_ADDRESS,
                        step: 1,
                    }, 30000);
                    await msg.reply('Điền địa chỉ người nhận');
                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case Button.PUBLICKEY:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: Action.TRANFER_BY_PUBLIC_KEY,
                        step: 1,
                    }, 30000);
                    await msg.reply('Điền mã khóa người nhận');
                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case Button.TRANSFER:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                await msg.reply('Bạn muốn chuyển tiền bằng phương thức gì', this.keyTransferMethod);
                break;
            case Button.WITHDRAW:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: Action.WITHDRAW,
                        step: 1,
                    }, 30000);
                    await msg.reply('Bạn muốn rút bao nhiêu tiền');
                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case Button.CANCEL:
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                return await msg.reply('Hủy giao dịch thành công', this.keyboardMarkup)
            default:
                await this.cacheManager.del(options.user_id);
                await msg.reply(`Xin lỗi tôi không hiểu`);
                await msg.reply('Tôi chỉ thực hiện được như bên dưới thôi!', this.keyboardMarkup);
                break;
        }
    }

}
