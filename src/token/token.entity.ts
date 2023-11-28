import { WalletEntity } from 'src/wallet/wallet.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
@Entity()
@Index(['name'])
export class TokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  symbol: string;

  @Column('text')
  decimal: string;

  @Column('text')
  contractAddress: string;

  @ManyToMany(() => WalletEntity, (wallet) => wallet.tokens, { eager: false })
  wallets: WalletEntity[];

  @CreateDateColumn()
  createdDate: Date;
}
