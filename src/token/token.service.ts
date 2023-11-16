import { Injectable } from "@nestjs/common";
import { TokenEntity } from "./token.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Wallet, ethers } from "ethers";
import { GenericAbi } from "src/constants/abis/generic.erc20.abi";
import { WalletEntity } from "src/wallet/wallet.entity";

@Injectable()
export class TokenService {
    private readonly provider: ethers.JsonRpcProvider;
    private readonly adminWallet: any;
    constructor(
        @InjectRepository(TokenEntity)
        private readonly tokenRepository: Repository<TokenEntity>,
        @InjectRepository(WalletEntity)
        private readonly walletRepository: Repository<WalletEntity>,
        private configService: ConfigService,
    ) {
        this.provider = new ethers.JsonRpcProvider(configService.get('RPC'));
        this.adminWallet = new Wallet(
            configService.get('adminPrivateKey'),
            this.provider,
        );
    }
    async getAllTokens() {
        return await this.tokenRepository.find();
    }
    async getContractByName(token: string) {
        const tokenFound = await this.tokenRepository.findOne({ where: { symbol: token } })
        return tokenFound;
    }
    async handleNewToken(tokenContractAddress: string, userId: string) {
        const checkExistToken = await this.tokenRepository.findOne({ where: { contractAddress: tokenContractAddress } }); 
        const wallet = await this.walletRepository.findOne({ where: { userId: userId } });
        if (checkExistToken) {
            if (!checkExistToken.wallets?.includes(wallet)) {
                checkExistToken.wallets.push(wallet);
                return await this.tokenRepository.save(checkExistToken);
            }
            return false;;
        }

        const contractAbi = GenericAbi;
        const sourceWallet = new Wallet(this.configService.get('adminPrivateKey'), this.provider);
        const contract = new ethers.Contract(tokenContractAddress, contractAbi, sourceWallet);
        const symbol = await contract.symbol();
        const name = await contract.name();
        const decimals = await contract.decimals();
        console.log(wallet);
        const createToken = {
            name: name || 'Unavailable',
            symbol: symbol || 'Unavailable',
            decimal: decimals.toString() || 'Unavailable',
            contractAddress: tokenContractAddress,
            wallets: [wallet]
        }
        const newToken = this.tokenRepository.create(createToken);
        const saveToken = await this.tokenRepository.save(newToken);
        if (!saveToken) {
            console.log('Error')
            return false;
        }
        return true;

    }
    arrayRemove(arr, value) {

        return arr.filter(function (ele) {
            return ele != value;
        });
    }

    async removeTokenFromList(token: string, userId: string) {
        const foundWallet = await this.walletRepository.findOne({ where: { userId: userId } });
        const tokens = foundWallet.tokens;
        const foundToken = await this.getContractByName(token);
        foundWallet.tokens = this.arrayRemove(tokens, foundToken);
        return await this.walletRepository.save(foundWallet);
    }

}
