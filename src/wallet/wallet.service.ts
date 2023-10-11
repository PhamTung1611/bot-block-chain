import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletStatus } from './wallet.status.enum';
import { Contract, ethers, Wallet } from 'ethers';
import { Uint256 } from 'web3';

// const contract = new ethers.Contract(contractAddress,abi,provider);
@Injectable()
export class WalletService {
	private readonly provider: ethers.JsonRpcProvider;
	private readonly contractAddress: string;
	private readonly abi: any
	private readonly adminWallet: any

	constructor(
		@InjectRepository(WalletEntity) private readonly walletRepository: Repository<WalletEntity>,
	) {
		this.provider = new ethers.JsonRpcProvider('https://rpc1-testnet.miraichain.io/');
		this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09';
		this.abi = [
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "newOwner",
						"type": "address"
					}
				],
				"name": "addAuthorizedOwner",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [],
				"stateMutability": "nonpayable",
				"type": "constructor"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "address",
						"name": "owner",
						"type": "address"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "spender",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "value",
						"type": "uint256"
					}
				],
				"name": "Approval",
				"type": "event"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "spender",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "value",
						"type": "uint256"
					}
				],
				"name": "approve",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					}
				],
				"name": "burn",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "account",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					}
				],
				"name": "mint",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "ownerToRemove",
						"type": "address"
					}
				],
				"name": "removeAuthorizedOwner",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "to",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "value",
						"type": "uint256"
					}
				],
				"name": "transfer",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "address",
						"name": "from",
						"type": "address"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "to",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "value",
						"type": "uint256"
					}
				],
				"name": "Transfer",
				"type": "event"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "from",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "to",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "value",
						"type": "uint256"
					}
				],
				"name": "transferFrom",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					}
				],
				"name": "allowance",
				"outputs": [
					{
						"internalType": "uint256",
						"name": "",
						"type": "uint256"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					}
				],
				"name": "authorizedOwners",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					}
				],
				"name": "balanceOf",
				"outputs": [
					{
						"internalType": "uint256",
						"name": "",
						"type": "uint256"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "decimals",
				"outputs": [
					{
						"internalType": "uint8",
						"name": "",
						"type": "uint8"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "name",
				"outputs": [
					{
						"internalType": "string",
						"name": "",
						"type": "string"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "owner",
				"outputs": [
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "symbol",
				"outputs": [
					{
						"internalType": "string",
						"name": "",
						"type": "string"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "totalSupply",
				"outputs": [
					{
						"internalType": "uint256",
						"name": "",
						"type": "uint256"
					}
				],
				"stateMutability": "view",
				"type": "function"
			}
		]
		this.adminWallet = new Wallet('0xdeae541d05d7e16328faec8a81740a3adb6231b5c88876f87079fa11d34b65df', this.provider);


	}
	
	async createWallet(jsonData: any) {
		const wallet = this.walletRepository.create(jsonData);
		const createWallet = await this.walletRepository.save(wallet);
		if (createWallet) {
			return true;
		} else {
			return false;
		}
	}
	async mint(address: string, amount: number, privateKey: string) {
		
		const nguonWallet = this.adminWallet
		// console.log(nguonWallet);

		const contract = new Contract(this.contractAddress, this.abi, nguonWallet);

		const txResponse = await contract.mint(address, amount);
		// console.log('Giao dịch đã được gửi, mã giao dịch:', txResponse.hash);
		if (txResponse) {
			return true;
		} else {
			return false;
		}
	}
	async addAuthorizedOwner(newOwner:string){
		
			const nguonWallet =this.adminWallet
		// console.log(nguonWallet);

		const contract = new Contract(this.contractAddress, this.abi, nguonWallet);
			// Gọi hàm addAuthorizedOwner trên hợp đồng thông minh
			const tx = await contract.addAuthorizedOwner(newOwner);
			// console.log(await contract.authorizedOwners(newOwner));
			// Đợi giao dịch được xác nhận
			await tx.wait();

	}
	async burn(amount: Uint256, privateKey) {
		try {
			const nguonWallet = new Wallet(privateKey, this.provider);

			const contract = new Contract(this.contractAddress, this.abi, nguonWallet);

			const tx = await contract.burn(amount);
			await tx.wait();
			return true;
		} catch (error) {
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


	async findOneUser(id_user: string) {
		const User = await this.walletRepository.findOne({
			where: { id_user: id_user }
		});
		if (User) {
			return true;
		} else {
			return false;
		}
	}

	async updateMoney(id_user: string, money: number) {
		const checkUser = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		if (checkUser && Number(money) > 0) {
			const coin = Number(Number(checkUser.balance) + Number(money));
			await this.walletRepository.update(checkUser.id, { balance: String(coin) });
			return true;
		} else {
			return false;
		}
	}

	async sendMoneybyAddress(id_user: string, receiverAddress: string, money: number) {
		const sender = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		const receiver = await this.walletRepository.findOne({
			where: {
				address: receiverAddress,
			}
		})
		if (sender.user_name === receiver.user_name) {
			return WalletStatus.SELF;
		}
		if (!sender || !receiver) {
			return WalletStatus.NOT_FOUND;
		}
		if (Number(sender.balance) === 0 || Number(money) > Number(sender.balance)) {
			return WalletStatus.NOT_ENOUGH_FUND
		}
		const senderBalance = Number(Number(sender.balance) - Number(money));
		const receiverBalance = Number(Number(receiver.balance) + Number(money));
		await this.walletRepository.update(sender.id, { balance: String(senderBalance) });
		await this.walletRepository.update(receiver.id, { balance: String(receiverBalance) });
		return WalletStatus.SUCCESS;
	}
	async sendMoneybyPublicKey(id_user: string, publicKey: string, money: number) {
		const sender = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		const receiver = await this.walletRepository.findOne({
			where: {
				publicKey: publicKey,
			}
		})
		if (sender.user_name === receiver.user_name) {
			return WalletStatus.SELF;
		}
		if (!sender || !receiver) {
			return WalletStatus.NOT_FOUND;
		}
		if (Number(sender.balance) === 0 || Number(money) > Number(sender.balance)) {
			return WalletStatus.NOT_ENOUGH_FUND
		}
		const senderBalance = Number(Number(sender.balance) - Number(money));
		const receiverBalance = Number(Number(receiver.balance) + Number(money));
		await this.walletRepository.update(sender.id, { balance: String(senderBalance) });
		await this.walletRepository.update(receiver.id, { balance: String(receiverBalance) });
		return WalletStatus.SUCCESS;
	}

	async withdrawn(id_user: string, money: number) {
		const user = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		if (!user) {
			return WalletStatus.NOT_FOUND;
		}
		if (money > (Number(user.balance))) {
			return WalletStatus.NOT_ENOUGH_FUND;
		}
		const userBalance = Number(user.balance) - Number(money);
		await this.walletRepository.update(user.id, { balance: String(userBalance) });
		return WalletStatus.SUCCESS;
	}

	async checkAddress(id_user: string) {
		const checkUser = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})

		return checkUser.address;
	}

	async checkWalletByAddress(address: string) {
		const check = await this.walletRepository.findOne({ where: { address: address } })
		if (!check) {
			return WalletStatus.NOT_FOUND;
		}
		return WalletStatus.FOUND

	}
	async checkWalletByPublicKey(publicKey: string) {
		const check = await this.walletRepository.findOne({ where: { publicKey: publicKey } })
		if (!check) {
			return WalletStatus.NOT_FOUND;
		}
		return WalletStatus.FOUND

	}
	async getAddressById(id_user: string) {
		const checkUser = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		if (!checkUser) {
			return WalletStatus.NOT_FOUND;
		}
		return checkUser.address;
	}
	async getAddressByPublicKey(publicKey: string) {
		const checkUser = await this.walletRepository.findOne({
			where: {
				publicKey: publicKey
			}
		})
		if (!checkUser) {
			return WalletStatus.NOT_FOUND;
		}
		return checkUser.address;
	}
	async checkInformation(id: string) {
		const user = await this.walletRepository.findOne({
			where: {
				id_user: id
			}
		})
		return user;
	}
	async checkPrivateKeyByID(id_user: string) {
		const checkUser = await this.walletRepository.findOne({
			where: {
				id_user: id_user
			}
		})
		if (!checkUser) {
			return WalletStatus.NOT_FOUND;
		}
		return checkUser.privateKey;
	}
}
