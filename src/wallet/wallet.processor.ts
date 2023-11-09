import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Contract, Wallet, ethers } from 'ethers';
import { WalletEntity } from './wallet.entity';
import { Repository } from 'typeorm';
import { HUSDContractAddress, MentosContractAddress } from 'src/constants/contractAdress/contract.address';
import { HUSD } from 'src/constants/abis/husd.abi';
import { Mentos } from 'src/constants/abis/mentos.abi';
import { TransactionService } from 'src/transaction/transaction.service';

@Processor('wallet:optimize', {
  concurrency: 50,
  limiter: {
    max: 5,
    duration: 30000,
  },
})
export class WalletProcessor extends WorkerHost {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly contractAddress: string;
  private readonly adminWallet: any;
  private logger = new Logger();
  constructor(private configService: ConfigService,
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    private transactionService: TransactionService,) {
    super();
    this.provider = new ethers.JsonRpcProvider(configService.get('RPC'));
    this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09';
    this.adminWallet = new Wallet(
      configService.get('adminPrivateKey'),
      this.provider,
    );
  }
  async process(job: Job<any, any, string>, _token?: string): Promise<any> {
    console.log('Process in Queue');
    switch (job.name) {
      case 'mint-token':
        const mintToken = await this.mintToken(job.data);
        return mintToken;
      case 'burn-token':
        const burnToken = await this.burnToken(job.data);
        return burnToken;
      case 'transfer':
        const transfer = await this.transfer(job.data);
        return transfer;
      default:
        throw new Error('No job name match');
    }
  }
  convertToEther(amount: number) {
    return ethers.parseUnits(amount.toString(), 'ether');
  }
  getTokenContract(token: string) {
    switch (token) {
      case 'HUSD':
        return {
          contractAddress: HUSDContractAddress,
          abi: HUSD,
        }
      case 'MTK':
        return {
          contractAddress: MentosContractAddress,
          abi: Mentos,
        }
      default:
        break;
    }
  }
  async mintToken(data: any) {
    const { transaction, amount } = data;
    console.log('Detecting new Transaction');
    console.log(transaction);
    // mint token
    const user = await this.walletRepository.findOne({
      where: {
        address:transaction.receiverAddress,
      },
    });
    const userToken =  this.getTokenContract(user.currentSelectToken);
    const contractAddress = Object(userToken).contractAddress.address;
    const contractAbi = Object(userToken).abi;
    const sourceWallet = new Wallet(
      this.configService.get('adminPrivateKey'),
      this.provider,
    );
    const contract = new ethers.Contract(contractAddress, contractAbi, sourceWallet);
    const txResponse = await contract.mint(
      transaction.receiverAddress,
      this.convertToEther(Number(amount)),
    )
    await this.transactionService.updateTransactionHash(txResponse.hash, transaction.id);
    if (txResponse) {
      return true;
    } else {
      return false;
    }
  }
  async burnToken(data: any) {
    const { amount, privateKey,transaction } = data;
    console.log('Detecting new Transaction');
    console.log(transaction);
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const user = await this.walletRepository.findOne({
        where: {
          address: sourceWallet.address,
        },
      });
      const userToken = this.getTokenContract(user.currentSelectToken);
      const contractAddress = Object(userToken).contractAddress.address;
      const contractAbi = Object(userToken).abi;
      const contract = new Contract(
        contractAddress,
        contractAbi,
        sourceWallet,
      );
      const txResponse = await contract.burn(this.convertToEther(Number(amount)));
      await this.transactionService.updateTransactionHash(txResponse.hash, transaction.id);
      return  true;
    } catch (error) {
      console.log('Not enough gas');
      return false;
    }
  }



  async transfer(data: any) {
    const { toAddress, amount, privateKey,transaction } = data;
    console.log('Detecting new Transaction');
    console.log(transaction);
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const user = await this.walletRepository.findOne({
        where: {
          address: sourceWallet.address,
        },
      });
      const userToken = this.getTokenContract(user.currentSelectToken);
      const contractAddress = Object(userToken).contractAddress.address;
      const contractAbi = Object(userToken).abi;
      const contract = new Contract(
        contractAddress,
        contractAbi,
        sourceWallet,
      );
      const tx = await contract.transfer(
        toAddress,
        this.convertToEther(Number(amount)),
      );
      tx.nonce++;
      await this.transactionService.updateTransactionHash(tx.hash, transaction.id);
      console.log(tx.hash);
      return {
        status: true,
        transaction: tx,
      };
    } catch (error) {
      console.log(error);
      console.log('Not enough gas');
      return false;
    }
  }
  @OnWorkerEvent('active')
  onQueueActive(job: Job) {
    this.logger.log(`Job has been started: ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onQueueComplete(job: Job, result: any) {
    this.logger.log(`Job has been finished: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onQueueFailed(job: Job, err: any) {
    this.logger.log(`Job has been failed: ${job.id}`);
    this.logger.log({ err });
  }

  @OnWorkerEvent('error')
  onQueueError(err: any) {
    this.logger.log(`Job has got error: `);
    this.logger.log({ err });
  }
}