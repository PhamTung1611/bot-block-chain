import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert } from 'typeorm';
import { v4 as uuid } from 'uuid';
@Entity()
export class WalletEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    id_user:string;

    @Column()
    user_name: string;

    @Column()
    address: string

    @Column()
    privateKey: string;

    @Column()
    publicKey: string;

    @Column({default:0})
    balance: string;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
    create_date: Date;

    @BeforeInsert()
    generateUUID() {
      this.id = uuid();
    }
}