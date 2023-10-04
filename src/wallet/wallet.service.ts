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
}
