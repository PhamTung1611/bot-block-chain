import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert, CreateDateColumn } from 'typeorm';
import { v4 as uuid } from 'uuid';
@Entity()
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  id_user: string;

  @Column('text')
  user_name: string;

  @Column('text')
  address: string;

  @Column('text')
  privateKey: string;

  @Column('text')
  publicKey: string;

  @CreateDateColumn()
  createdDate: Date;

  @BeforeInsert()
  generateUUID() {
    this.id = uuid();
  }
}
