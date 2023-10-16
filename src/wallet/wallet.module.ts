import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ImageOptimizationProcessor } from './wallet.processor';

// Config Module dùng ỏ nhiều module nên phải khai báo global ở app.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity]),
    ConfigModule.forRoot(),
    BullModule.registerQueue({
      name: 'wallet:optimize',
      prefix: 'telegram-bot',
    }),
  ],
  providers: [WalletService, ImageOptimizationProcessor],
  exports: [ConfigModule, BullModule],
})
export class WalletModule {}
