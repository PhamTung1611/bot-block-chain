import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './wallet.status.enum';

let crypto = require("crypto");
let ethers = require('ethers');
let Wallet = require('ethereumjs-wallet').default
let EthUtil = require("ethereumjs-util");

@Injectable()
export class WalletService {
    constructor(@InjectRepository(WalletEntity) private readonly walletRepository: Repository<WalletEntity>) { }

    async createWallet(jsonData: any) {
        const wallet = this.walletRepository.create(jsonData);
        const createWallet = await this.walletRepository.save(wallet);
        if (createWallet) {
            return true;
        } else {
            return false;
        }
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

   async sendMoney(id_user: string, receiverAddress: string, money: number) {
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

    async withdrawn(id_user: string,money:number){
        const user = await this.walletRepository.findOne({
            where: {
                id_user: id_user
            }
        })
        if (!user) {
            return WalletStatus.NOT_FOUND;
        }
        if(money > (Number(user.balance))){
            return WalletStatus.NOT_ENOUGH_FUND;
        }
        const userBalance = Number(Number(user.balance) - Number(money));
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

    async checkInformation(id: string) {
        const user = await this.walletRepository.findOne({
            where: {
                id_user: id
            }
        })
        return user;
    }
}
