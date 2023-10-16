import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionStatus } from './enum/transaction.enum';

// Không khai báo kiểu dữ liệu của column
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

  // dùng typeorm CreatedDateColumn
  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  create_date: Date;
}
