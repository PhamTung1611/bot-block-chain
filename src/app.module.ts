import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { TelegramModule } from './telegram/telegram.module';
import { TransactionModule } from './transaction/transaction.module';
import { UserEntity } from './users/users.entity';
import { TransactionEntity } from './transaction/transaction.entity';
import { WalletService } from './wallet/wallet.service';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'postgres',
    host: 'localhost', // Địa chỉ máy chủ PostgreSQL
    port: 5432,         // Cổng mặc định của PostgreSQL
    username: 'postgres', // Tên người dùng PostgreSQL
    password: 'Convitcon12', // Mật khẩu PostgreSQL
    database: 'BlockChainBot', // Tên cơ sở dữ liệu PostgreSQL
    // entities: [__dirname + '/**/*.entity{.ts,.js}'],
    entities: [UserEntity,TransactionEntity],
    synchronize: true, // Đồng bộ hóa cơ sở dữ liệu với các entity
  }), UsersModule, TelegramModule, TransactionModule, WalletModule],
  controllers: [AppController],
  providers: [AppService, WalletService],
})
export class AppModule {}