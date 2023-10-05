import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';
import { UsersService } from 'src/users/users.service';
import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletEntity } from 'src/wallet/wallet.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([TransactionEntity]),
    TypeOrmModule.forFeature([WalletEntity]),
    CacheModule.register()
  ],
  providers: [TelegramService,UsersService,TransactionService,WalletService]
})
export class TelegramModule {}
