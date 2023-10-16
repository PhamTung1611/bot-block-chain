import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from './transaction.entity';
import { Repository } from 'typeorm';
import { TransactionStatus } from './enum/transaction.enum';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  async createTransaction(jsonData: any) {
    const transaction = this.transactionRepository.create(jsonData);
    const saveTransaction = await this.transactionRepository.save(transaction);
    if (saveTransaction) {
      return true;
    } else {
      return false;
    }
  }
  async updateTransactionState(status: TransactionStatus): Promise<boolean> {
    const lastetTransaction = await this.findLatestTransaction();
    lastetTransaction.status = status;
    const saveTransaction =
      await this.transactionRepository.save(lastetTransaction);
    if (saveTransaction) {
      return true;
    } else {
      return false;
    }
  }
  async findLatestTransaction(): Promise<TransactionEntity | undefined> {
    const transactions = await this.transactionRepository.find({
      order: { create_date: 'DESC' },
      take: 1,
    });

    return transactions[0];
  }
  async getListHistory(address: string) {
    const query = await this.transactionRepository
      .createQueryBuilder('entity')
      .where(
        'entity.senderAddress = :address OR entity.receiverAddress = :address',
        { address },
      )
      .getCount();
    return String(query);
  }

  async getAmountHistory(
    limit: number,
    address: string,
  ): Promise<TransactionEntity[]> {
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
