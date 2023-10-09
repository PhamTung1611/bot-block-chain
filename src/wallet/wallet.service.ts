import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
let ellipticcurve = require("starkbank-ecdsa");
import keccak256 from 'keccak256';
let Ecdsa = ellipticcurve.Ecdsa;
let PrivateKey = ellipticcurve.PrivateKey;
@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(WalletEntity) private readonly walletRepository: Repository<WalletEntity>,
    ) { }
    async generateNewWallet(): Promise<any> {
        let privateKeyGen = new PrivateKey();
        let privateKey =privateKeyGen.toString('hex');
        let publicKey = privateKeyGen.publicKey().toString('hex');
        let address = keccak256(publicKey).toString('hex')
        console.log(privateKey)
        const wallet = new WalletEntity();
        wallet.privateKey = privateKey;
        wallet.address = address;
        wallet.publickey = publicKey;
        const createWallet = await this.walletRepository.save(wallet);
        if (createWallet) {
            return true
        }
        return false;
    }

    async generateNewWallet() {
        let id = crypto.randomBytes(32).toString('hex');
        let privateKey = "0x" + id;
        const privateKeyBuffer = EthUtil.toBuffer(privateKey);

        const wallet = Wallet.fromPrivateKey(privateKeyBuffer);

        const publicKeyBuffer = wallet.getPublicKey();

        const publicKey = EthUtil.bufferToHex(publicKeyBuffer);
        const address = wallet.getAddressString();

        const createWallet = {
            privateKey: privateKey,
            publicKey: publicKey,
            address: address,
        }

        return createWallet;

    }

    async findOneUser(id_user: string) {
        const User = await this.walletRepository.findOne({
            where: { id_user: id_user }
        });
        if (User) {
            return true;
        } else {
            return false;
        }
    }

    async updateMoney(id_user: string, money: number) {
        const checkUser = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        if (checkUser && Number(money) > 0) {
            const coin = Number(Number(checkUser.balance) + Number(money));
            await this.walletRepository.update(checkUser.id, { balance: String(coin) });
            return true;
        } else {
            return false;
        }
    }

    async sendMoneybyAddress(id_user: string, receiverAddress: string, money: number) {
        const sender = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        const receiver = await this.walletRepository.findOne({
            where: {
                address: receiverAddress,
            }
        })
        if(sender.user_name===receiver.user_name){
            return WalletStatus.SELF;
        }
        if (!sender || !receiver) {
            return WalletStatus.NOT_FOUND;
        }
        if (Number(sender.balance) === 0 || Number(money) > Number(sender.balance)) {
            return WalletStatus.NOT_ENOUGH_FUND
        }
        const senderBalance = Number(Number(sender.balance) - Number(money));
        const receiverBalance = Number(Number(receiver.balance) + Number(money));
        await this.walletRepository.update(sender.id, { balance: String(senderBalance) });
        await this.walletRepository.update(receiver.id, { balance: String(receiverBalance) });
        return WalletStatus.SUCCESS;
    }
    async sendMoneybyPublicKey(id_user: string, publicKey: string, money: number) {
        const sender = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        const receiver = await this.walletRepository.findOne({
            where: {
                publicKey: publicKey,
            }
        })
        if(sender.user_name===receiver.user_name){
            return WalletStatus.SELF;
        }
        if (!sender || !receiver) {
            return WalletStatus.NOT_FOUND;
        }
        if (Number(sender.balance) === 0 || Number(money) > Number(sender.balance)) {
            return WalletStatus.NOT_ENOUGH_FUND
        }
        const senderBalance = Number(Number(sender.balance) - Number(money));
        const receiverBalance = Number(Number(receiver.balance) + Number(money));
        await this.walletRepository.update(sender.id, { balance: String(senderBalance) });
        await this.walletRepository.update(receiver.id, { balance: String(receiverBalance) });
        return WalletStatus.SUCCESS;
    }

    async withdrawn(id_user: string, money: number) {
        const user = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        if (!user) {
            return WalletStatus.NOT_FOUND;
        }
        if (money > (Number(user.balance))) {
            return WalletStatus.NOT_ENOUGH_FUND;
        }
        const userBalance = Number(user.balance) - Number(money);
        await this.walletRepository.update(user.id, { balance: String(userBalance) });
        return WalletStatus.SUCCESS;
    }

    async checkAddress(id_user: string) {
        const checkUser = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })

        return checkUser.address;
    }

    async checkWalletByAddress(address: string) {
        const check = await this.walletRepository.findOne({ where: { address: address } })
        if (!check) {
            return WalletStatus.NOT_FOUND;
        }
        return WalletStatus.FOUND

    }
    async checkWalletByPublicKey(publicKey: string) {
        const check = await this.walletRepository.findOne({ where: { publicKey: publicKey } })
        if (!check) {
            return WalletStatus.NOT_FOUND;
        }
        return WalletStatus.FOUND

    }
    async getAddressById(id_user: string) {
        const checkUser = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        if(!checkUser){
            return WalletStatus.NOT_FOUND;
        }
        return checkUser.address;
    }
    async getAddressByPublicKey(publicKey: string) {
        const checkUser = await this.walletRepository.findOne({
            where: {
                publicKey: publicKey
            }
        })
        if(!checkUser){
            return WalletStatus.NOT_FOUND;
        }
        return checkUser.address;
    }
    async checkInformation(id: string) {
        const user = await this.walletRepository.findOne({
            where: {
                id_user: id
            }
        })
        return user;
    }
}
