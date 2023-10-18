import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BullModule } from '@nestjs/bullmq';
import { WalletProcessor } from './wallet.processor.fix';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity]),
    ConfigModule.forRoot(),
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
      prefix: 'telegram-bot',
    }),
  ],
  providers: [WalletService,WalletProcessor],
  exports: [ConfigModule],
})
export class WalletModule { }
