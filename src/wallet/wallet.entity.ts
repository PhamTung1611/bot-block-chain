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
  userName: string;

  @Column('text')
  address: string;

  @Column('text')
  privateKey: string;

  @Column('text')
  publicKey: string;

  @CreateDateColumn()
  createdDate: Date;
}
