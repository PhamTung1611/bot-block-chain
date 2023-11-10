import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
@Entity()
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column('text')
  userId: string;

  @Column('text')
  username: string;

  @Index({ unique: true })
  @Column('text')
  address: string;

  @Column('text')
  privateKey: string;

  @Column('text')
  currentSelectToken: string;

  @CreateDateColumn()
  createdDate: Date;
}
