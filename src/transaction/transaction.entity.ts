import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { TransactionStatus } from './enum/transaction.enum';

@Entity()
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  senderAddress: string;

  @Column('text')
  receiverAddress: string;

  @Column('text')
  balance: string;

  @Column('text')
  type: string;

  @Column()
  status: TransactionStatus;

  @CreateDateColumn()
  createdDate: Date;
}
