import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { BullModule } from '@nestjs/bullmq';
import { WalletProcessor } from './wallet.processor';
import { TransactionModule } from 'src/transaction/transaction.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity]),
    TransactionModule,
    BullModule.registerQueue({
      name: 'wallet:optimize',
      prefix: 'telegram-bot',
    }),
  ],
  providers: [WalletService, WalletProcessor],
  exports: [WalletService],
})
export class WalletModule {}
