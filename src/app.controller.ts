import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { WalletService } from './wallet/wallet.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private walletService:WalletService) {}

  @Get()
 async getHello() {
    return await this.walletService.generateNewWallet();
  }
}
