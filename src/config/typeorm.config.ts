import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { config } from 'dotenv';
config();
// sử dụng config service
export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [TransactionEntity, WalletEntity],
  synchronize: true,
};
