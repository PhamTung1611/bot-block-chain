// import { Process, Processor } from '@nestjs/bull';
// import { ConfigService } from '@nestjs/config';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Contract, Wallet, ethers } from 'ethers';
// import { abiChain } from 'src/constants/abis/abichain';

// @Processor('wallet:optimize')
// export class WalletProcessor {
//     private readonly provider: ethers.JsonRpcProvider;
//     private readonly contractAddress: string;
//     private readonly adminWallet: any;
//     constructor(
//         private configService: ConfigService,
//     ) {
//         this.provider = new ethers.JsonRpcProvider(
//             configService.get('RPC')
//         );
//         this.contractAddress = '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09'
//         this.adminWallet = new Wallet(configService.get('adminPrivateKey'), this.provider);
//     }
//     convertToEther(amount: number) {
//         return ethers.parseUnits(amount.toString(), 'ether');
//     }
//     @Process('mint-token')
//     async mintToken(job: any) {
//         const { address, amount } = job.data;
//         // mint token
//         const sourceWallet = new Wallet(this.configService.get('adminPrivateKey'), this.provider);
//         const contract = new Contract(this.contractAddress, abiChain, sourceWallet);
//         const txResponse = await contract.mint(address,
//             this.convertToEther(amount))
//         if (txResponse) {
//             return true;
//         } else {
//             return false;
//         }
//     }
//     @Process('burn-token')
//     async burnToken(job: any) {
//         const { amount, privateKey } = job.data;
//         try {
//             const sourceWallet = new Wallet(privateKey, this.provider);
//             const contract = new Contract(
//                 this.contractAddress,
//                 abiChain,
//                 sourceWallet,
//             );
//             await contract.burn(this.convertToEther(Number(amount)));
//             return true;
//         } catch (error) {
//             console.log(error);
//             return false;
//         }
//     }
//     @Process('generate-wallet')
//     async generateNewWallet(job: any) {
//         const wallet = ethers.Wallet.createRandom();
//         console.log(wallet.privateKey);

//         return {
//             privateKey: wallet.privateKey,
//             publicKey: wallet.publicKey,
//             address: wallet.address,
//         };
//     }
//     @Process('get-balance')
//     async getBalance(job: any) {
//         const { address } = job.data;
//         const contract = new ethers.Contract(
//             this.contractAddress,
//             abiChain,
//             this.provider,
//         );
//         const balance = Number(ethers.formatEther(await contract.balanceOf(address))).toString();
//         return balance;
//     }
//     @Process('transfer')
//     async transfer(job: any) {
//         const { toAddress, amount, privateKey } = job.data;
//         try {
//             const sourceWallet = new Wallet(privateKey, this.provider);
//             const contract = new Contract(
//                 this.contractAddress,
//                 abiChain,
//                 sourceWallet,
//             );

//             // Populate the transaction object with the incremented nonce value.
//             const tx = await contract.transfer(
//                 toAddress,
//                 this.convertToEther(amount),
//             );
//             tx.nonce++;
//             return true;
//         } catch (error) {
//             console.log(error);
//             return false;
//         }
//     }
// }