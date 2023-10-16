import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { BullModule } from '@nestjs/bull';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    // khai báo entity dùng 1 dòng
    TypeOrmModule.forFeature([TransactionEntity]),
    TypeOrmModule.forFeature([WalletEntity]),
    CacheModule.register(),
    WalletModule,
    // sử dụng env
    BullModule.registerQueue({
      name: 'telegram:optimize',
      prefix: 'telegram-bot',
    }),
  ],
  // sử dụng sai chức năng module của nestjs
  providers: [TelegramService, TransactionService, WalletService],
})
export class TelegramModule {}
