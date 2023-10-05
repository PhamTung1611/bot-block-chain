import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Markup, Telegraf } from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import * as bcrypt from 'bcrypt';
import { WalletService } from 'src/wallet/wallet.service';

interface DataCache {
    action: string;
    step: number;
    money: string;
    receiver?: string;
}

@Injectable()
export class TelegramService {
    private bot: Telegraf;
    private keyboardMarkup = Markup.inlineKeyboard([
        [
            Markup.button.callback('Deposit', 'deposit'),
            Markup.button.callback('Withdraw', 'withdraw'),
        ], [
            Markup.button.callback('Transaction', 'transaction'),
        ], [
            Markup.button.callback('History', 'history'),
            Markup.button.callback('Information', 'information'),
        ]
    ]);

    private keyCreateAccount = Markup.inlineKeyboard([
        [
            Markup.button.callback('CreateAccount', 'create'),
        ]
    ])



    constructor(
        private transactionService: TransactionService,
        private wallerService: WalletService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache

    ) {
        this.bot = new Telegraf('6330110829:AAGF5ZD-7AVlHUt57g1K3AcnFc4dWBjzSyo');
        // this.bot.use(Telegraf.log());
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
            case 'deposit':
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
            case 'history':
                const address = await this.wallerService.checkAddress(options.idUser)

                const listHistory = await this.transactionService.getListHistory(address)
                if (data.step === 1) {
                    const amountHistory = options.text;
                    if (!Number(amountHistory)) {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
                    } else {
                        // console.log(typeof (listHistory), 'ahihi');
                        if (listHistory < amountHistory) {
                            await this.cacheManager.del(options.idUser);
                            return await msg.reply(`Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`, this.keyboardMarkup);
                        } else {
                            const selectHistory = await this.transactionService.getAmountHistory(amountHistory, address);
                            for (const item of selectHistory) {
                                await msg.reply(`Mã giao dịch:\n ${item?.id}\nSố tiền: ${item?.balance}\nKiểu: ${item?.type}\nTài khoản nguồn: ${item.senderAddress}\nTài khoản nhận: ${item.receiverAddress}`);
                            }
                            await this.cacheManager.del(options.idUser);
                            await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                        }
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
            case 'create':
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

            case 'deposit':
                if (!checkUser) {
                    return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                }
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: 'deposit',
                        step: 1,
                    }, 30000);
                    await msg.reply('Bạn muốn nạp bao nhiêu tiền');
                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
            case 'history':
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
                        action: 'history',
                        step: 1,
                    }, 15000);

                    await msg.reply(`Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`);

                } else {
                    await this.cacheManager.del(options.user_id);
                }
                break;
                case 'information':
                    if (!checkUser) {
                        return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                    }
                    const info = await this.wallerService.checkInformation(options.user_id);
                    await msg.reply(`Private Key:${info.privateKey} \n ID Address:${info.address} \n Username:${info.user_name} \n Balance:${info.balance}`)
                    await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
                    await this.cacheManager.del(options.user_id);
                    break;
            default:
                await this.cacheManager.del(options.user_id);
                await msg.reply(`Xin lỗi tôi không hiểu`,this.keyboardMarkup);
                break;
        }
    }



}
