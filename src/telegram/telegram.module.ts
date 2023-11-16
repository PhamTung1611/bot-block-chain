import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { WalletEntity } from 'src/wallet/wallet.entity';
import { TransactionModule } from 'src/transaction/transaction.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { TokenModule } from 'src/token/token.module';
import { TokenEntity } from 'src/token/token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, WalletEntity,TokenEntity]),
    CacheModule.register(),
    TransactionModule,
    WalletModule,
    TokenModule,
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
