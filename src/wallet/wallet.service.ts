import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
let ellipticcurve = require("starkbank-ecdsa");
const keccak256 = require('keccak256')
let Ecdsa = ellipticcurve.Ecdsa;
let PrivateKey = ellipticcurve.PrivateKey;
@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(WalletEntity) private readonly walletRepository: Repository<WalletEntity>,
    ) { }
    async generateNewWallet(): Promise<any> {
        let privateKey = new PrivateKey().toString();
        let publicKey = privateKey.publicKey().toString();
        let address = keccak256(publicKey).toString('hex')
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
}
