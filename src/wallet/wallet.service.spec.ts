import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { ConfigService } from '@nestjs/config';
import { Wallet } from 'ethers';
import { WalletStatus } from './enum/wallet.status.enum';
import { ethers } from 'ethers';
import { HUSD } from '../constants/abis/husd.abi';
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Wallet: jest.fn(),
  Contract: jest.fn(),
}));
describe('WalletService', () => {
  let walletService: WalletService;
  let walletRepository: Repository<WalletEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        ConfigService,
        {
          provide: getRepositoryToken(WalletEntity),
          useClass: Repository,
        },
      ],
    }).compile();

    walletService = module.get<WalletService>(WalletService);
    walletRepository = module.get<Repository<WalletEntity>>(getRepositoryToken(WalletEntity));
  });

  it('should be defined', () => {
    expect(walletService).toBeDefined();
  });

  describe('find user by id', () => {
    it('should return false when wallet not found', async () => {
      const userId = 'user123';
      jest.spyOn(walletRepository, 'findOne').mockResolvedValueOnce(undefined);
      const result = await walletService.findOneUser(userId);
      expect(result).toBe(undefined);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { userId: userId } });
    });
    it('should return true if wallet found', async () => {
      const userId = 'user123';
      const existWallet = { id: '1', userId: 'user123', username: 'Hoang' } as Partial<WalletEntity>;
      jest.spyOn(walletRepository, 'findOne').mockResolvedValueOnce(existWallet as WalletEntity);
      const result = await walletService.findOneUser(userId);
      expect(result).toBe(existWallet);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { userId: userId } });
    })
  });
  describe('Check Wallet Address by userId', () => {
    it('should return undefined if wallet not found', async () => {
      const userId = 'user123';
      jest.spyOn(walletRepository, 'findOne').mockRejectedValueOnce(undefined);
      const result = await walletService.checkAddress(userId);
      expect(result).toBe(undefined);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { userId: userId } });
    })
    it('should return wallet address if wallet is found', async () => {
      const userId = 'user123';
      const existWallet = { id: '1', userId: 'user123', username: 'Hoang', address: '12345', privateKey: '123', currentSelectToken: 'HUSD', iv: '123', password: '123' } as WalletEntity;
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);
      const result = await walletService.checkAddress(userId);
      expect(result).toEqual(existWallet.address);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { userId: userId } });
    })
  })
  describe('Check Wallet by Address', () => {
    it('should return not found if wallet not found', async () => {
      const address = '123';
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(undefined);
      const result = await walletService.checkWalletByAddress(address);
      expect(result).toBe(WalletStatus.NOT_FOUND);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { address: address } });
    })
    it('should return  found if wallet found', async () => {
      const address = '123';
      const existWallet = { id: '1', userId: 'user123', username: 'Hoang', address: '123', privateKey: '123', currentSelectToken: 'HUSD', iv: '123', password: '123' } as WalletEntity;
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);
      const result = await walletService.checkWalletByAddress(address);
      expect(result).toBe(WalletStatus.FOUND);
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { address: address } });
    })
  })
  describe('mint', () => {
    it('should mint tokens successfully', async () => {
      // Mocking data
      const address = 'user123';
      const amount = 100;
      const existWallet = { id: '1', userId: 'user123', username: 'Hoang', address: '123', privateKey: '123', currentSelectToken: 'HUSD', iv: '123', password: '123' } as WalletEntity;
      const userToken = {
        contractAddress: {
          token: 'HUSD',
          address: '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09',
          description: 'Hien Tokens USD'
        }, abi: HUSD
      };
      const txResponse = { hash: 'transactionHash' };

      // Mocking wallet repository
      jest.spyOn(walletRepository, 'findOne').mockResolvedValueOnce(existWallet);

      // Mocking getTokenContract method
      jest.spyOn(walletService, 'getTokenContract').mockReturnValueOnce(userToken);

      const result = await walletService.mint(address, amount.toString());

      // Assertions
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { address } });
      expect(walletService.getTokenContract).toHaveBeenCalledWith(existWallet.currentSelectToken);
      expect(result).toEqual({ status: true, txhash: txResponse.hash });
    });

    it('should return false if minting fails', async () => {
      // Mocking data
      const address = 'user123';
      const amount = 100;
      const existWallet = { id: '1', userId: 'user123', username: 'Hoang', address: '123', privateKey: '123', currentSelectToken: 'HUSD', iv: '123', password: '123' } as WalletEntity;
      const userToken = {
        contractAddress: {
          token: 'HUSD',
          address: '0xc1D60AEe7247d9E3F6BF985D32d02f7b6c719D09',
          description: 'Hien Tokens USD'
        }, abi: HUSD
      };

      // Mocking wallet repository
      jest.spyOn(walletRepository, 'findOne').mockResolvedValueOnce(existWallet);

      // Mocking getTokenContract method
      jest.spyOn(walletService, 'getTokenContract').mockReturnValueOnce(userToken);

      // Mocking ethers.Contract and mint method to simulate failure
      (ethers.Contract as jest.Mock).mockImplementationOnce(() => ({
        mint: jest.fn().mockRejectedValue(new Error('Minting failed')),
      }));

      // Execute the mint function
      const result = await walletService.mint(address, amount.toString());

      // Assertions
      expect(result).toBe(false);
    });
  });
});
