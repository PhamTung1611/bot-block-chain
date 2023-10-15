import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ImageOptimizationProcessor } from './wallet.processor';
@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity]),
  ConfigModule.forRoot(),
  BullModule.registerQueue({
    name: 'wallet:optimize',
    prefix: 'telegram-bot'
  }),
  ],
  providers: [WalletService,ImageOptimizationProcessor],
  exports:[ConfigModule,BullModule]
})
export class WalletModule { }
