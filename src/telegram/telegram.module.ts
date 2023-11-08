import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { TransactionModule } from 'src/transaction/transaction.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, WalletEntity]),
    BullModule.registerQueue({
      name: 'wallet:optimize',
      prefix: 'telegram-bot',
    }),
    CacheModule.register(),
    TransactionModule,
    WalletModule,
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
