import { TokenEntity } from 'src/token/token.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
@Entity()
@Index(['userId'])
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  userId: string;

  @Column('text')
  username: string;

  @Column('text')
  password: string;

  @Column('text')
  address: string;

  @Column('text')
  privateKey: string;

  @Column('text')
  iv: string;

  @Column('text')
  currentSelectToken: string;

  @ManyToMany(() => TokenEntity, (token) => token.wallets, { eager: true })
  @JoinTable({
    name: 'wallet_token',
    joinColumn: {
      name: 'wallet_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'token_id',
      referencedColumnName: 'id',
    },
  })
  tokens: TokenEntity[];

  @CreateDateColumn()
  createdDate: Date;

}
