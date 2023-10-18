import { TypeOrmModuleOptions, TypeOrmModule, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { ConfigService } from '@nestjs/config';
// import { config } from 'dotenv';
import { Injectable } from '@nestjs/common';
// config();


@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {

  constructor(private configService: ConfigService) { }

  createTypeOrmOptions(): Promise<TypeOrmModuleOptions> | TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host:this.configService.get('POSTGRES_HOST'),
      port: this.configService.get('POSTGRES_PORT'),
      username: this.configService.get('POSTGRES_USERNAME'),
      password: this.configService.get('POSTGRES_PASSWORD'),
      database: this.configService.get('POSTGRES_DATABASE'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
    };
  }

}

// export const typeOrmConfig: TypeOrmModuleOptions = {
//   type: 'postgres',
//   host: process.env.POSTGRES_HOST,
//   port: Number(process.env.POSTGRES_PORT),
//   username: process.env.POSTGRES_USERNAME,
//   password: process.env.POSTGRES_PASSWORD,
//   database: process.env.POSTGRES_DATABASE,
//   entities: [TransactionEntity, WalletEntity],
//   synchronize: true,
// };
