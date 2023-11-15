import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './enum/wallet.status.enum';
import { Contract, ethers, Wallet } from 'ethers';
import Web3, { Uint256 } from 'web3';
import { TransactionStatus } from '../transaction/enum/transaction.enum';
import { ConfigService } from '@nestjs/config';
import { HUSD } from '../constants/abis/husd.abi';
import { HUSDContractAddress, MentosContractAddress } from '../constants/contractAdress/contract.address';
import { Mentos } from '../constants/abis/mentos.abi';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import * as bcrypt from 'bcrypt';
import { WalletNotFoundException } from '../exception/wallet.exception';
interface WalletInfo {
  privateKey: number,
  iv: string,
  address: string,
  currentSelectToken: string,
  mnemonic: string,
  userId: string,
  username: string,
  password: string
}

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
  identify<Type>(arg: Type): Type {
    return arg;
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
  async createWallet(walletInfo: any, address: string) {
    await this.sendToken(address);
    const wallet = this.walletRepository.create(walletInfo);
    const createWallet = await this.walletRepository.save(wallet);
    if (createWallet) {
      console.log('successfully created wallet');
      return true;
    } else {
      return false;
    }
  }

  async sendToken(toAddress: string) {
    try {
      const signer = await this.adminWallet;
      await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseUnits('0.01', 'ether'),
      });
    } catch (err) {
      return;
    }
  }
  async mintTokens(address: string, amount: Uint256): Promise<string | undefined> {
    const user = await this.walletRepository.findOne({
      where: {
        address: address,
      },
    });
    const userToken = this.getTokenContract(user.currentSelectToken);
    const contractAddress = Object(userToken).contractAddress.address;
    const contractAbi = Object(userToken).abi;

    const sourceWallet = new Wallet(this.configService.get('adminPrivateKey'), this.provider);
    const contract = new ethers.Contract(contractAddress, contractAbi, sourceWallet);
    return await this.executeMint(contract, user.address, amount);
  }

  async executeMint(contract: ethers.Contract, address: string, amount: Uint256): Promise<string | undefined> {
    const txResponse = await contract.mint(address, this.convertToEther(Number(amount)))
    if (!txResponse) {
      return undefined;
    }
    return txResponse.hash
  }
  async checkTransactionFee(estimateGas: number) {
    console.log(this.identify(estimateGas));
    const gasprice = Number((await this.provider.getFeeData()).gasPrice);
    const piority = Number(((await this.provider.getFeeData()).maxPriorityFeePerGas));
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
      const decryptedPrivatekey = await this.decryptPrivateKey(
        this.configService.get('encryption_pass'),
        Buffer.from(wallet.iv, 'hex'), Buffer.from(wallet.privateKey, 'hex')
      );
      return decryptedPrivatekey;
    }
    return false;
  }


  async encryptPrivateKey(privateKey: string) {
    const iv = randomBytes(16);
    const password = this.configService.get('encryption_pass');
    const key = (await promisify(scrypt)(password, 'salt', 32)) as Buffer;
    const cipher = createCipheriv('aes-256-ctr', key, iv);

    const textToEncrypt = privateKey;
    const encryptedPrivateKey = Buffer.concat([cipher.update(textToEncrypt),
    cipher.final()]);
    return { encryptedPrivateKey, iv };
  }
  async decryptPrivateKey(password: string, iv: Buffer, encryptedText: any) {
    const key = (await promisify(scrypt)(password, 'salt', 32)) as Buffer;
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    const decryptedText = Buffer.concat([decipher.update(encryptedText),
    decipher.final()]
    )
    return decryptedText.toString();
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
    const sourceWallet = new Wallet(privateKey, this.provider);
    const sourceAddress = sourceWallet.address;
    const user = await this.walletRepository.findOne({
      where: {
        address: sourceAddress,
      },
    });
    //Get contract value based on token
    const userToken = this.getTokenContract(user.currentSelectToken);
    const contractAddress = Object(userToken).contractAddress.address;
    const contractAbi = Object(userToken).abi;
    const contract = new Contract(
      contractAddress,
      contractAbi,
      sourceWallet,
    );
    return await this.executeBurn(contract, amount);
  }
  //Execute burning token from source wallet set in contract
  async executeBurn(contract: ethers.Contract, amount: Uint256) {
    try {
      const tx = await contract.burn(this.convertToEther(Number(amount)));
      return tx.hash;
    } catch (error) {
      if (error.message.includes('insufficient funds for intrinsic transaction cost ')) {
        console.log('Not enough gas');
      } else {
        console.log(error);
      }
      return undefined;
    }
  }
  async transfer(toAddress: string, amount: Uint256, privateKey: string) {
    try {
      // Create a new Wallet instance for the source wallet
      const sourceWallet = new Wallet(privateKey, this.provider);

      // Find the user based on the source wallet's address
      const wallet = await this.walletRepository.findOne({
        where: {
          address: sourceWallet.address,
        },
      });
      // Check if the user exists
      if (!wallet) {
        console.log('wallet not found.');
        return undefined;
      }
      if (toAddress === wallet.address) {
        return WalletStatus.SELF;
      }
      // Get the token contract information
      const userToken = this.getTokenContract(wallet.currentSelectToken);
      const contractAddress = userToken.contractAddress.address;
      const contractAbi = userToken.abi;

      // Create a Contract instance for the token
      const contract = new Contract(contractAddress, contractAbi, sourceWallet);

      // Perform the token transfer
      const tx = await contract.transfer(
        toAddress,
        this.convertToEther(Number(amount)),
      );
      // Log the transaction hash
      console.log(tx.hash);
      return tx.hash;
    } catch (error) {
      if (error.message.includes('insufficient funds for intrinsic transaction cost ')) {
        console.log('Not enough gas');
      }
      else {
        console.log(error);
      }
      return undefined;
    }
  }
  async generateWalletFromPrivateKey(privateKey: string) {
    const checkPk = await this.checkPrivateKey(privateKey);
    const checkPkExist = await this.walletRepository.findOne({
      where: { privateKey: privateKey },
    });
    if (!checkPk || checkPkExist) {
      return undefined;
    }
    const wallet = new ethers.Wallet(privateKey, this.provider);
    return wallet.address;
  }
  async generateNewWallet() {
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = await this.encryptPrivateKey(wallet.privateKey);
    return {
      privateKey: encryptedPrivateKey.encryptedPrivateKey.toString('hex'),
      iv: encryptedPrivateKey.iv.toString('hex'),
      address: wallet.address,
      currentSelectToken: HUSDContractAddress.token,
      mnemonic: wallet.mnemonic.phrase
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
  async sendMoneybyAddress(userId: string, receiverAddress: string, money: Uint256): Promise<TransactionStatus | WalletStatus | Object> {
    try {
      if (!ethers.isAddress(receiverAddress)) {
        return WalletStatus.INVALID;
      }
      // Check the sender's private key
      const privateKey = await this.checkPrivateKeyByID(userId);
      // Transfer money to the receiver
      const checkTransaction = await this.transfer(receiverAddress, money, privateKey);
      // Find the sender based on the user ID
      const sender = await this.walletRepository.findOne({
        where: {
          userId: userId,
        },
      });
      // Get the sender's balance
      const balance = await this.getBalance(sender.address);
      // Check for different conditions and return the appropriate status
      if (checkTransaction === WalletStatus.SELF) {
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
        txHash: checkTransaction,
      };
    } catch (error) {
      console.error(error);
      return TransactionStatus.FAIL;
    }
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
    try {
      const checkUser = await this.walletRepository.findOne({
        where: {
          userId: userId,
        },
      });
      return checkUser.address;
    } catch (error) {
      return undefined;
    }
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
      return undefined;
    }
    const privateKey = await this.decryptPrivateKey(this.configService.get('encryption_pass'), Buffer.from(checkUser.iv, 'hex'), Buffer.from(checkUser.privateKey, 'hex'))
    return privateKey;
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
  async updateAddress(userId: string, privateKey: string) {
    const addressNew = await this.generateAddress(privateKey);
    const checkAccount = await this.walletRepository.findOne({
      where: { address: addressNew },
    });
    if (!checkAccount) {
      const user = await this.findOneUser(userId);
      const encryptedPrivateKey = await this.encryptPrivateKey(privateKey);
      user.privateKey = encryptedPrivateKey.encryptedPrivateKey.toString('hex');
      user.iv = encryptedPrivateKey.iv.toString('hex');
      user.address = addressNew;
      const saveUser = await this.walletRepository.save(user);
      if (!saveUser) {
        return false
      } else {
        return true
      }
    } else {
      return false
    }
  }
  async verifyBackupPhrase(mnemonic: string, address: string) {
    try {
      const wallet = Wallet.fromPhrase(mnemonic);
      if (wallet.address === address) {
        console.log('address matched')
        return true;
      }
      return false;
    } catch (err) {
      console.log('wrong mnemic format')
      return false;
    }
  }
  async generateAddress(privateKey: string) {
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;
    return address;
  }
  async hashPassword(password: string) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }
  async verifyPassword(password: string, hash: string) {
    const isMatch = await bcrypt.compare(password, hash);
    console.log('Password match ' + isMatch);
    return isMatch;
  }
  async updatePassword(password: string, userId: string) {
    const wallet = await this.findOneUser(userId);
    wallet.password = await this.hashPassword(password);
    const saveWallet = await this.walletRepository.save(wallet);
    if (saveWallet) {
      return true;
    } else {
      console.log('something wrong')
      return false;
    }
  }
}
