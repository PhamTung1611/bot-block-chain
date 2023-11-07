import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
@Entity()
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  userId: string;

  @Column('text')
  username: string;

  @Column('text')
  address: string;

  @Column('text')
  privateKey: string;

  @Column('text')
  publicKey: string;

  @Column('text')
  currentSelectToken: string;

  @CreateDateColumn()
  createdDate: Date;
}
