import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { TransactionModule } from 'src/transaction/transaction.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { BullModule } from '@nestjs/bullmq';
import { WalletService } from 'src/wallet/wallet.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, WalletEntity]),
    CacheModule.register(),
    TransactionModule,
    WalletModule,
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        token: configService.get('TELEGRAM_BOT_TOKEN'),
      }),
    }),
    BullModule.registerQueue({
      name: 'wallet:optimize',
      prefix: 'telegram-bot',
    }),
  ],
  providers: [TelegramService, WalletService],
  exports: [TelegramService],
})
export class TelegramModule {}
