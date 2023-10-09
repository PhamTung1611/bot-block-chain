import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from './transaction.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TransactionService {
    constructor(@InjectRepository(TransactionEntity) private readonly transactionRepository: Repository<TransactionEntity>) { }

    async createTransaction(jsonData: any) {
        const transaction = this.transactionRepository.create(jsonData);
        const saveTransaction = await this.transactionRepository.save(transaction);
        if (saveTransaction) {
            return true;
        } else {
            return false;
        }
    }

    async getListHistory(address: string) {
        const query = await this.transactionRepository
            .createQueryBuilder('entity')
            .where('entity.senderAddress = :address OR entity.receiverAddress = :address', { address })
            .getCount();
        return String(query);
    }

    async getAmountHistory(limit: number, address: string): Promise<TransactionEntity[]> {
        const query = await this.transactionRepository
            .createQueryBuilder('entity')
            .where(
                'entity.senderAddress = :address or entity.receiverAddress = :address',
                { address },
            )
            .orderBy('entity.create_date', 'DESC')
            .limit(limit)
            .getMany();
        return query;
    }
}
