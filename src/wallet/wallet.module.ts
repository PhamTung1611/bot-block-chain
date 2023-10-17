import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { WalletProcessor } from './wallet.processor';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity]),
    ConfigModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'walletOptimize',
    }),
  ],
  providers: [WalletService,WalletProcessor],
  exports: [ConfigModule],
})
export class WalletModule { }
