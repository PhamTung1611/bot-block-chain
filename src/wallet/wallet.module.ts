import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletService } from './wallet.service';
import { ConfigModule } from '@nestjs/config';
import { TokenModule } from 'src/token/token.module';
@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity]), ConfigModule, TokenModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule { }
