import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './wallet.status.enum';
import { Contract, ethers, Wallet } from 'ethers';
import { Uint256 } from 'web3';
import { TransactionStatus } from 'src/transaction/enum/transaction.enum';
import { ConfigService } from '@nestjs/config';
import { HUSD } from 'src/constants/abis/husd.abi';
import { HUSDContractAddress, MentosContractAddress } from 'src/constants/contractAdress/contract.address';
import { Mentos } from 'src/constants/abis/mentos.abi';

@Injectable()
export class WalletService {
  private readonly provider: ethers.JsonRpcProvider;
  private contractAddress: any;
  private abi: any;
  private readonly adminWallet: any;
  private tokens: Map<string, any> = new Map();
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    private configService: ConfigService,
  ) {
    this.provider = new ethers.JsonRpcProvider(configService.get('RPC'));
    this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09';
    this.abi = HUSD;
    this.adminWallet = new Wallet(
      configService.get('adminPrivateKey'),
      this.provider,
    );
  }

  async changeToken(token: string) {
    let coin: string;
    switch (token) {
      case 'HUSD':
        this.contractAddress = HUSDContractAddress.address.toString();
        coin = HUSDContractAddress.token.toString();
        this.abi = HUSD;
        break;
      case 'MTK':
        this.contractAddress = MentosContractAddress.address.toString();
        coin = MentosContractAddress.token.toString();
        this.abi = Mentos;
        break;
      default:
        return false;
    }
    console.log('current using ' + coin);
    console.log('contract address ' + this.contractAddress);
  }
  async createWallet(jsonData: any, address: string) {
    await this.sendToken(address);
    const wallet = this.walletRepository.create(jsonData);
    const userId = Object(jsonData).userId.toString();
    console.log(userId);
    this.tokens.set(userId, {
      contractAddress: "0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09",
      abi: HUSD
    })
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
    const user = await this.walletRepository.findOne({
      where: {
        address: address,
      },
    });

    const userToken = Object(await this.tokens.get(user.userId));
    console.log(userToken);
    const contractAddress = Object(userToken).contractAddress || this.contractAddress;
    const contractAbi = Object(userToken).abi || this.abi;
    console.log(contractAddress + '--' + contractAbi);
    const sourceWallet = new Wallet(
      this.configService.get('adminPrivateKey'),
      this.provider,
    );

    const contract = new ethers.Contract(contractAddress, contractAbi, sourceWallet);
    const gasPrice = await this.provider.estimateGas(await contract.mint(
      address,
      this.convertToEther(Number(amount)),
    ))
    console.log(this.checkTransactionFee(gasPrice));
    if (Number(await this.getUserNativeToken(address)) <= Number(await this.checkTransactionFee(gasPrice))) {
      console.log('Not enough gas available');
      return WalletStatus.NOT_ENOUGH_GAS;
    }
    console.log('execute mint contract')
    const txResponse = await contract.mint(
      address,
      this.convertToEther(Number(amount)),
    )
    if (txResponse) {
      return {
        status: true,
        txhash: txResponse.hash
      };
    } else {
      return false;
    }
  }
  async checkTransactionFee(estimateGas: any) {
    const gasprice = (await this.provider.getFeeData()).gasPrice;
    const piority = ((await this.provider.getFeeData()).maxPriorityFeePerGas);
    const transactionFee = ethers.formatUnits((gasprice + piority) * estimateGas);
    console.log('transaction fee:' + transactionFee);
    return transactionFee;
  }
  async getUserNativeToken(address: string) {

    return ethers.formatUnits(await this.provider.getBalance(address))
  }
  async addAuthorizedOwner(newOwner: string) {
    const adminWallet = this.adminWallet;
    const contract = new Contract(this.contractAddress, this.abi, adminWallet);
    const tx = await contract.addAuthorizedOwner(newOwner);
    await tx.wait();
  }
  async getBalance(address: string) {
    const contract = new ethers.Contract(
      this.contractAddress,
      this.abi,
      this.provider,
    );
    const balance = await contract.balanceOf(address);
    return Number(ethers.formatEther(balance));
  }
  async getTokenSymbol() {
    const contract = new ethers.Contract(
      this.contractAddress,
      this.abi,
      this.provider,
    );
    const symbol = await contract.symbol();
    return symbol;
  }
  async burn(amount: Uint256, privateKey: string) {
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(
        this.contractAddress,
        this.abi,
        sourceWallet,
      );
      const tx = await contract.burn(this.convertToEther(Number(amount)));
      await tx.wait();
      return {
        status: true,
        txHash: tx.hash,
      };
    } catch (error) {
      console.log('Not enough gas');
      return false;
    }
  }
  async transfer(toAddress: string, amount: Uint256, privateKey: string) {
    try {
      const sourceWallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(
        this.contractAddress,
        this.abi,
        sourceWallet,
      );
      const tx = await contract.transfer(
        toAddress,
        this.convertToEther(Number(amount)),
      );
      tx.nonce++;
      console.log(tx.hash);
      return {
        status: true,
        transaction: tx,
      };
    } catch (error) {
      console.log('Not enough gas');
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
    const user = await this.walletRepository.findOne({
      where: { userId: userId },
    });
    if (user) {
      return user;
    } else {
      return undefined;
    }
  }

  async sendMoneybyAddress(userId: string, receiverAddress: string, money: Uint256,) {
    const sender = await this.walletRepository.findOne({
      where: {
        userId: userId,
      },
    });

    const balance = await this.getBalance(sender.address);
    if (balance < Number(money)) {
      return WalletStatus.NOT_ENOUGH_FUND;
    }
    const privateKey = await this.checkPrivateKeyByID(userId);
    const checkTransaction = await this.transfer(
      receiverAddress,
      money,
      privateKey,
    );
    if (!checkTransaction) {
      return TransactionStatus.FAIL;
    }
    if (sender.address == receiverAddress) {
      return WalletStatus.SELF;
    }
    if (balance < Number(money)) {
      return WalletStatus.NOT_ENOUGH_FUND;
    }
    if (!checkTransaction) {
      return TransactionStatus.FAIL;
    }
    return {
      status: TransactionStatus.SUCCESS,
      txHash: checkTransaction.transaction.hash,
    };
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
  async checkAddressContract(addressToCheck: string) {
    if (!/^(0x)?[0-9a-f]{40}$/i.test(addressToCheck)) {
      return false;
    }
    return true;
  }
}
