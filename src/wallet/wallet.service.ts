import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';

@Injectable()
export class WalletService {
    constructor(@InjectRepository(WalletEntity) private readonly walletRepository: Repository<WalletEntity>) { }

    async createWallet(jsonData:any){
        const wallet = this.walletRepository.create(jsonData);
        const createWallet = await this.walletRepository.save(wallet);
        if (createWallet) {
            return true;
        } else {
            return false;
        }
    }

}
