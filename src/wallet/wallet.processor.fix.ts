import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Contract, Wallet, ethers } from 'ethers';
import { abiChain } from 'src/constants/abis/abichain';

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
  constructor(private configService: ConfigService) {
    super();
    this.provider = new ethers.JsonRpcProvider(configService.get('RPC'));
    this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09';
    this.adminWallet = new Wallet(
      configService.get('adminPrivateKey'),
      this.provider,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(job: Job<any, any, string>, _token?: string): Promise<any> {
    switch (job.name) {
      case 'mint-token':
        const mintToken = await this.mintToken(job.data);
        console.log({ mintToken });
        return mintToken;
      case 'burn-token':
        const burnToken = await this.burnToken(job.data);
        console.log({ burnToken });
        return burnToken;
      case 'generate-wallet':
        break;
      case 'get-balance':
        const balance = await this.getBalance(job.data);
        console.log({ balance });
        console.log(job.returnvalue);
        return job.returnvalue;
      case 'transfer':
        const transfer = await this.transfer(job.data);
        console.log({ transfer });
        return transfer;

      default:
        throw new Error('No job name match');
    }
  }
  convertToEther(amount: number) {
    return ethers.parseUnits(amount.toString(), 'ether');
  }

  async mintToken(data: any) {
    const { address, amount } = data;
    // mint token
    const sourceWallet = new Wallet(
      this.configService.get('adminPrivateKey'),
      this.provider,
    );
    const contract = new Contract(this.contractAddress, abiChain, sourceWallet);
    const txResponse = await contract.mint(
      address,
      this.convertToEther(amount),
    );
    if (txResponse) {
      return true;
    } else {
      return false;
    }
  }

  async burnToken(data: any) {
    const { amount, privateKey } = data;
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(
        this.contractAddress,
        abiChain,
        sourceWallet,
      );
      await contract.burn(this.convertToEther(Number(amount)));
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateNewWallet(_job: any) {
    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.privateKey);

    return await new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            privateKey: wallet.privateKey,
            publicKey: wallet.publicKey,
            address: wallet.address,
          }),
        2000,
      ),
    );
  }

  async getBalance(data: any) {
    const { address } = data;
    const contract = new ethers.Contract(
      this.contractAddress,
      abiChain,
      this.provider,
    );
    const balance = Number(
      ethers.formatEther(await contract.balanceOf(address)),
    );
    return balance;
  }

  async transfer(data: any) {
    const { toAddress, amount, privateKey } = data;
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(
        this.contractAddress,
        abiChain,
        sourceWallet,
      );
      // Populate the transaction object with the incremented nonce value.
      const tx = await contract.transfer(
        toAddress,
        this.convertToEther(amount),
      );
      tx.nonce++;
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  async optimizeImage(image: unknown) {
    this.logger.log('Processing image....');
    return await new Promise((resolve) =>
      setTimeout(() => resolve(image), 30000),
    );
  }
  @OnWorkerEvent('active')
  onQueueActive(job: Job) {
    this.logger.log(`Job has been started: ${job.id}`);
  }

  @OnWorkerEvent('completed')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
