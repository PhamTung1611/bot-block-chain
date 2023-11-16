import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TokenEntity } from './token.entity';
import { TokenService } from './token.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { WalletService } from 'src/wallet/wallet.service';
import { WalletEntity } from 'src/wallet/wallet.entity';
@Module({
    imports: [TypeOrmModule.forFeature([TokenEntity,WalletEntity]), ConfigModule],
    providers: [TokenService],
    exports: [TokenService],
})
export class TokenModule { }
