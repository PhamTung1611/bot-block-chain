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
    if (transaction) {
      return Object(saveTransaction);
    } else {
      return undefined;
    }
  }
  async updateTransactionState(
    status: TransactionStatus,
    id: string,
  ): Promise<boolean> {
    const transaction = await this.findTransactionById(id);
    transaction.status = status;
    const saveTransaction = await this.transactionRepository.save(transaction);
    if (saveTransaction) {
      return true;
    } else {
      return false;
    }
  }
  async updateTransactionHash(txhash: string, id: string): Promise<boolean> {
    const transaction = await this.findTransactionById(id);
    transaction.transactionHash = txhash;
    const saveTransaction = await this.transactionRepository.save(transaction);
    if (saveTransaction) {
      return true;
    } else {
      return false;
    }
  }
  async findTransactionById(
    id: string,
  ): Promise<TransactionEntity | undefined> {
    const transaction = await this.transactionRepository.findOneBy({
      id: id,
    });

    return transaction;
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
      .orderBy('entity.createdDate', 'DESC')
      .limit(limit)
      .getMany();
    return query;
  }
}
