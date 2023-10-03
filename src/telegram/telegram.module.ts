import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';
import { UsersService } from 'src/users/users.service';
import { CacheModule } from '@nestjs/cache-manager';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { TransactionService } from 'src/transaction/transaction.service';

@Module({
  imports:[
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([TransactionEntity]),
    CacheModule.register()
  ],
  providers: [TelegramService,UsersService,TransactionService]
})
export class TelegramModule {}
