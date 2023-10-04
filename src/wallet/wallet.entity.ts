import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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

}