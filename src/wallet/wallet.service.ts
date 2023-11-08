import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './wallet.status.enum';
import { Contract, ethers, Wallet } from 'ethers';
import Web3, { Uint256 } from 'web3';
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
    this.contractAddress = HUSDContractAddress;
    this.abi = HUSD;
    this.adminWallet = new Wallet(
      configService.get('adminPrivateKey'),
      this.provider,
    );
    // Listen for new blocks, and retrieve all transactions in each block
    this.provider.on("block", async (blockNumber) => {
      const block = await this.provider.getBlock(blockNumber);
      console.log("Transactions:", block.transactions);
    });
  }
  async changeToken(token: string, userId: string) {
    const wallet = await this.findOneUser(userId);
    wallet.currentSelectToken = token;
    const saveTransaction = await this.walletRepository.save(wallet);
    if (saveTransaction) {
      return true;
    } else {
      return false;
    }
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
    const user = await this.walletRepository.findOne({
      where: {
        address: address,
      },
    });
    const userToken = this.getTokenContract(user.currentSelectToken);
    const contractAddress = Object(userToken).contractAddress.address;
    const contractAbi = Object(userToken).abi;
    const sourceWallet = new Wallet(
      this.configService.get('adminPrivateKey'),
      this.provider,
    );
    const contract = new ethers.Contract(contractAddress, contractAbi, sourceWallet);
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
  async getPrivateKey(address: string) {
    const wallet = await this.walletRepository.findOne({
      where: {
        address: address,
      },
    });
    if (wallet) {
      return wallet.privateKey.toString();
    }
    return false;
  }
  async getBalance(address: string) {
    const user = await this.walletRepository.findOne({
      where: {
        address: address,
      },
    });
    const userToken = this.getTokenContract(user.currentSelectToken);
    const contractAddress = Object(userToken).contractAddress.address;
    const contractAbi = Object(userToken).abi;
    const contract = new ethers.Contract(
      contractAddress,
      contractAbi,
      this.provider,
    );
    const balance = await contract.balanceOf(address);
    return Number(ethers.formatEther(balance));
  }

  async burn(amount: Uint256, privateKey: string) {
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
  async generateWalletFromPrivateKey(privateKey: any) {
    const checkPk = await this.checkPrivateKey(privateKey);
    if (!checkPk) {
      return undefined;
    }
    const wallet = new ethers.Wallet(privateKey, this.provider);
    return wallet.address;
  }
  async generateNewWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.privateKey);

    return {
      privateKey: wallet.privateKey,
      address: wallet.address,
      currentSelectToken: HUSDContractAddress.token
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

  async sendMoneybyAddress(userId: string, receiverAddress1: string, money: Uint256,) {
    const receiverAddress = receiverAddress1.toLowerCase();
    if (!ethers.isAddress(receiverAddress)) {
      return WalletStatus.INVALID;
    }
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
  async checkPrivateKey(pk: string) {
    const isPrivateKeyValid = ethers.isHexString(pk);
    if (!isPrivateKeyValid) {
      return false;
    } else {
      return true;
    }
  }
  async updateAddress(userId: any, privateKey: any) {
    const addressNew = await this.generateAddress(privateKey);
    const checkPk = await this.walletRepository.findOne({
      where: { privateKey: privateKey },
    });
    if(!checkPk){
      const user = await this.findOneUser(userId);
      user.privateKey = privateKey;
      user.address = addressNew;
      const saveUser = await this.walletRepository.save(user);
      if (!saveUser) {
        return false
      } else {
        return true
      }
    }else{
      return false
    }
   
  }
  async generateAddress(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;
    return address;
  }
}
