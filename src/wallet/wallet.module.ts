import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity]),
  ConfigModule.forRoot(),
  CacheModule.register()],
  providers: [WalletService],
})
export class WalletModule { }
