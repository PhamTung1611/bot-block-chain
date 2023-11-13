import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
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
  @CreateDateColumn()
  createdDate: Date;

}
