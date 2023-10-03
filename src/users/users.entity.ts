import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UserEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    address: string

    @Column()
    user_name: string;

    @Column({ default: 0 })
    coin: string;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
    create_date: Date;

}