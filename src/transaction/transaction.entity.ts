import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionStatus } from './enum/transaction.enum';

@Entity()
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  senderAddress: string;

  @Column()
  receiverAddress: string;

  @Column()
  balance: string;

  @Column()
  type: string;

  @Column()
  status: TransactionStatus;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  create_date: Date;
}
