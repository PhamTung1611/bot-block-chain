import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class TransactionEntity{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column()
    senderAddress:string;

    @Column()
    receiverAddress:string;

    @Column()
    coin:string;

    @Column()
    type:string;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
    create_date: Date;
}