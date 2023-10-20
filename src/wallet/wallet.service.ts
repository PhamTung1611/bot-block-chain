import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './wallet.status.enum';
import { Contract, ethers, Wallet } from 'ethers';
import { Uint256 } from 'web3';
import { TransactionStatus } from 'src/transaction/enum/transaction.enum';
import { abiChain } from 'src/constants/abis/abichain';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly contractAddress: string;
  private readonly adminWallet: any;
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    private configService: ConfigService,
  ) {
    this.provider = new ethers.JsonRpcProvider(configService.get('RPC'));
    this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09';
    this.adminWallet = new Wallet(
      configService.get('adminPrivateKey'),
      this.provider,
    );
  }

  async createWallet(jsonData: any, address: string) {
    await this.sendToken(address);
    const wallet = this.walletRepository.create(jsonData);
    const createWallet = await this.walletRepository.save(wallet);
    if (createWallet) {
      return true;
    } else {
      return false;
    }
  }

  async sendToken(toAddress: string) {
    const signer = await this.adminWallet;
    await signer.sendTransaction({
      to: toAddress,
      value: ethers.parseUnits('0.01', 'ether'),
    });
  }

  async mint(address: string, amount: Uint256) {
    const sourceWallet = new Wallet(
      this.configService.get('adminPrivateKey'),
      this.provider,
    );
    const contract = new Contract(this.contractAddress, abiChain, sourceWallet);
    const txResponse = await contract.mint(address, amount);
    if (txResponse) {
      return true;
    } else {
      return false;
    }
  }

  async addAuthorizedOwner(newOwner: string) {
    const adminWallet = this.adminWallet;
    const contract = new Contract(this.contractAddress, abiChain, adminWallet);
    const tx = await contract.addAuthorizedOwner(newOwner);
    await tx.wait();
  }
  async getBalance(address: string) {
    const contract = new ethers.Contract(
      this.contractAddress,
      abiChain,
      this.provider,
    );
    const balance = await contract.balanceOf(address);
    return Number(ethers.formatEther(balance));
  }

  async burn(amount: Uint256, privateKey: string) {
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(
        this.contractAddress,
        abiChain,
        sourceWallet,
      );
      const tx = await contract.burn(this.convertToEther(Number(amount)));
      await tx.wait();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  async transfer(toAddress: string, amount: number, privateKey: string) {
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
  async generateNewWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.privateKey);

    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
    };
  }
  convertToEther(amount: number) {
    return ethers.parseUnits(amount.toString(), 'ether');
  }
  async findOneUser(userId: string) {
    const User = await this.walletRepository.findOne({
      where: { userId: userId },
    });
    if (User) {
      return true;
    } else {
      return false;
    }
  }
  async deposit(toAddress: string, amount: number) {
    const contract = new ethers.Contract(
      this.contractAddress,
      abiChain,
      this.adminWallet,
    );
    const tx = await contract.mint(toAddress, amount);

    const a = await tx.wait();

    console.log(a);
  }
  async sendMoneybyAddress(
    userId: string,
    receiverAddress: string,
    money: number,
  ) {
    const sender = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });
    const receiver = await this.walletRepository.findOne({
      where: {
        address: receiverAddress,
      },
    });
    if (sender.userId === receiver.userId) {
      return WalletStatus.SELF;
    }
    if (!sender || !receiver) {
      return WalletStatus.NOT_FOUND;
    }
    const balance = await this.getBalance(sender.address);
    if (balance < money) {
      return WalletStatus.NOT_ENOUGH_FUND;
    }
    const privateKey = await this.checkPrivateKeyByID(userId);
    const checkTransaction = await this.transfer(
      receiver.address,
      Number(money),
      privateKey,
    );
    console.log(checkTransaction);
    if (!checkTransaction) {
      return TransactionStatus.FAIL;
    }
    return TransactionStatus.SUCCESS;
  }
  async withdrawn(userId: string, money: number) {
    const user = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });
    const balance = await this.getBalance(user.address);

    if (!user) {
      return WalletStatus.NOT_FOUND;
    }
    if (money > Number(balance)) {
      return WalletStatus.NOT_ENOUGH_FUND;
    }
    return WalletStatus.SUCCESS;
  }

  async checkAddress(userId: string) {
    const checkUser = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });

    return checkUser.address;
  }

  async checkWalletByAddress(address: string) {
    const check = await this.walletRepository.findOne({
      where: { address: address },
    });
    if (!check) {
      return WalletStatus.NOT_FOUND;
    }
    return WalletStatus.FOUND;
  }
  async checkWalletByPublicKey(publicKey: string) {
    const check = await this.walletRepository.findOne({
      where: { publicKey: publicKey },
    });
    if (!check) {
      return WalletStatus.NOT_FOUND;
    }
    return WalletStatus.FOUND;
  }
  async getAddressById(userId: string) {
    const checkUser = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });
    if (!checkUser) {
      return WalletStatus.NOT_FOUND;
    }
    return checkUser.address;
  }
  async getAddressByPublicKey(publicKey: string) {
    const checkUser = await this.walletRepository.findOne({
      where: {
        publicKey: publicKey,
      },
    });
    if (!checkUser) {
      return WalletStatus.NOT_FOUND;
    }
    return checkUser.address;
  }
  async checkInformation(userId: string) {
    const user = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });
    return user;
  }
  async checkPrivateKeyByID(userId: string) {
    const checkUser = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });
    if (!checkUser) {
      return WalletStatus.NOT_FOUND;
    }
    return checkUser.privateKey;
  }
}
