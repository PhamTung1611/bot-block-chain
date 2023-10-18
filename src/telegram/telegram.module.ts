import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletEntity } from 'src/wallet/wallet.entity';

import { WalletModule } from 'src/wallet/wallet.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity,WalletEntity]),
    CacheModule.register(),
    WalletModule,
    BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				connection: {
					host: configService.get('REDIS_HOST'),
					port: configService.get('REDIS_PORT'),
				},
			}),
		}),
    BullModule.registerQueue({
      name: 'wallet:optimize',
      prefix: 'telegram-bot'
    }),
  ],
  providers: [TelegramService, TransactionService, WalletService],
})
export class TelegramModule {}
