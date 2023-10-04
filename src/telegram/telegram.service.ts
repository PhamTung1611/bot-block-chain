import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Markup, Telegraf } from 'telegraf';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TransactionService } from 'src/transaction/transaction.service';
import * as bcrypt from 'bcrypt';

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

    private keyRetype = Markup.inlineKeyboard([
        [
            Markup.button.callback('Retype Password', 'retype'),
            Markup.button.callback('Exit', 'exit'),
        ]
    ])


    constructor(
        private usersService: UsersService,
        private transactionService: TransactionService,
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
        const checkUser = await this.usersService.findOneUser(options.id);
        // console.log(123,checkUser);

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

        // const listHistory = await this.transactionService.getListHistory(options.address)


        switch (data.action) {
            case 'create':
                if (data.step === 1) {
                    const text = options.text;
                    // console.log(text.length);

                    if (text.length >= 6 && text.length <= 15) {
                        const hashPassword = await this.hashPassword(text);
                        console.log(123,hashPassword);
                        
                        const dataUser = {
                            id_user: msg.chat.id,
                            user_name: msg.chat.first_name,
                            password: hashPassword
                        }
                        // console.log(dataUser);

                        await this.usersService.createUser(dataUser)
                        await msg.reply(`Tạo tài khoản thành công`);
                        await msg.reply(`Xin chào ${options.username}, tôi có thể giúp gì cho bạn!`, this.keyboardMarkup)
                        await this.cacheManager.del(options.idUser);
                    } else {
                        await this.cacheManager.del(options.idUser);
                        return await msg.reply(
                            'Ký tự password đảm bảo từ 6-15 ký tự', this.keyRetype,
                        );

                    }
                }

                break;
            // case 'deposit':
            //     if (data.step === 1) {
            //         const Money = options.text;
            //         if (!Number(Money)) {
            //             await this.cacheManager.del(options.address);
            //             return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
            //         }
            //         if (Number(Money) && Number(Money) > 0) {
            //             data.money = options.text;
            //             data.step = 2;
            //             await this.cacheManager.set(options.address, data, 30000);
            //         }
            //         if (data.step === 2) {
            //             await this.cacheManager.set(options.address, data, 30000);
            //             await this.usersService.updateMoney(options.address, Number(data.money));
            //             const createTransaction = {
            //                 coin: String(data.money),
            //                 type: String(data.action),
            //                 sourceAccount: options.address,
            //                 destinationAccount: options.address
            //             }

            //             await this.transactionService.createTransaction(createTransaction);
            //             await this.cacheManager.del(options.address);
            //             await msg.reply(`Nạp tiền thành công`);
            //             await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
            //         }
            //     }
            //     break;
            // case 'history':
            //     if (data.step === 1) {
            //         const amountHistory = options.text;
            //         if (!Number(amountHistory)) {
            //             await this.cacheManager.del(options.address);
            //             return await msg.reply('Vui lòng thực hiện lại', this.keyboardMarkup);
            //         } else {
            //             // console.log(typeof (listHistory), 'ahihi');
            //             if (listHistory < amountHistory) {
            //                 await this.cacheManager.del(options.address);
            //                 return await msg.reply(`Xin lỗi bạn chỉ có ${listHistory} giao dịch thôi`, this.keyboardMarkup);
            //             } else {
            //                 const selectHistory = await this.transactionService.getAmountHistory(amountHistory, options.address);
            //                 for (const item of selectHistory) {
            //                     await msg.reply(`Mã giao dịch:\n ${item?.id}\nSố tiền: ${item?.coin}\nKiểu: ${item?.type}\nTài khoản nguồn: ${item.sourceAccount}\nTài khoản nhận: ${item.destinationAccount}`);
            //                 }
            //                 await this.cacheManager.del(options.address);
            //                 await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
            //             }
            //         }
            //     }
            //     break;
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

        const checkUser = await this.usersService.findOneUser(options.user_id);

        // const listHistory = await this.transactionService.getListHistory(options.user_id)


        switch (options.data) {
            case 'create':
                // if (!checkUser) {
                //     return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
                // }
                if (data.action === '') {
                    if (!checkUser) {
                        await this.cacheManager.set(options.user_id, {
                            action: 'create',
                            step: 1,
                        }, 30000);
                        await msg.reply('Tạo password của bạn!')
                    } else {
                        await this.cacheManager.del(options.user_id)
                        return await msg.reply('Bạn đã có tài khoản vui lòng thực hiện chức năng khác', this.keyboardMarkup)
                    }
                } else {
                    await this.cacheManager.del(options.user_id)
                }
                break;
            case 'exit':
                console.log(1);
                if (data.action === '') {
                    await msg.reply(`Tạm biệt ${options.user_name}!`)
                    await this.cacheManager.del(options.user_id)
                }
                break;
            case 'retype':
                if (data.action === '') {
                    await this.cacheManager.set(options.user_id, {
                        action: 'create',
                        step: 1,
                    }, 30000);
                    await msg.reply('Vui lòng nhập password của bạn!')
                } else {
                    await this.cacheManager.del(options.user_id)
                }
                break;



            //     case 'deposit':
            //         if (!checkUser) {
            //             return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
            //         }
            //         if (data.action === '') {
            //             await this.cacheManager.set(options.address, {
            //                 action: 'deposit',
            //                 step: 1,
            //             }, 30000);
            //             await msg.reply('Bạn muốn nạp bao nhiêu tiền');
            //         } else {
            //             await this.cacheManager.del(options.address);
            //         }
            //         break;
            //     case 'withdraw':
            //         if (!checkUser) {
            //             return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
            //         }
            //         break;
            //     case 'transaction':
            //         if (!checkUser) {
            //             return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
            //         }
            //         break;
            //     case 'history':
            //         if (!checkUser) {
            //             return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
            //         }
            //         if (listHistory === 0) {
            //             await msg.reply('Bạn không có lịch sử giao dịch nào');
            //             return await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
            //         }
            //         if (data.action === '') {
            //             await this.cacheManager.set(options.address, {
            //                 action: 'history',
            //                 step: 1,
            //             }, 15000);

            //             await msg.reply(`Bạn đang có ${listHistory} giao dịch bạn muốn xem bao nhiêu giao dịch?`);

            //         } else {
            //             await this.cacheManager.del(options.address);
            //         }
            //         break;
            //     case 'information':
            //         if (!checkUser) {
            //             return await msg.reply(`Vui lòng gõ '/start' để bắt đầu`);
            //         }
            //         const info = await this.usersService.checkInformation(options.address);
            //         await msg.reply(` ID Address:${info.address} \n Username:${info.user_name} \n Coin:${info.coin}`)
            //         await msg.reply('Tôi có thể giúp gì tiếp cho bạn', this.keyboardMarkup);
            //         await this.cacheManager.del(options.address);
            //         break;
            default:
                await this.cacheManager.del(options.user_id);
                await msg.reply(`Xin lỗi tôi không hiểu`);
                await msg.reply('Tôi chỉ thực hiện được như bên dưới thôi!', this.keyboardMarkup);
                break;
        }
    }

    private async hashPassword(password: string) {
        const saltRound = 10;
        const salt = await bcrypt.genSalt(saltRound);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    }

    

}
