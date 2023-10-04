import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert } from 'typeorm';
import { v4 as uuid } from 'uuid';
@Entity()
export class WalletEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    address: string

    @Column()
    privateKey: string;

    @Column()
    publickey: string;

    @Column()
    balance: string;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
    create_date: Date;

    @BeforeInsert()
    generateUUID() {
      this.id = uuid();
    }
}