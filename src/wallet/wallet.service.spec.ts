import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { ConfigService } from '@nestjs/config';
import { WalletStatus } from './enum/wallet.status.enum';
import { ethers } from 'ethers';
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Wallet: jest.fn(),
  Contract: jest.fn(),
}));
// Mock dependencies
const providerMock = new ethers.JsonRpcProvider('https://rpc1-testnet.miraichain.io/');
const ethersMock = { Contract: jest.fn(), Wallet: jest.fn() };
const configServiceMock = {
  get: jest.fn(() => 'mockPrivateKey'),
};

const contractMock = {
  burn: jest.fn(),
};
const createWallet = (privateKey: string) => {
  const sourceWallet = new ethers.Wallet(privateKey, providerMock);
  // ... perform additional initialization or setup if needed
  return sourceWallet;
};

const executeBurnMock = jest.fn();
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
    }).overrideProvider(ethers.Wallet)
      .useValue(ethersMock.Wallet)
      .overrideProvider(ethers.Contract)
      .useValue(ethersMock.Contract)
      .compile();


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
    it('should mint tokens successfully assuming minting contract is successful', async () => {
      // Arrange
      const userId = 'user123';
      const amount = 100;
      const existWallet = {
        id: '1',
        userId: userId,
        username: 'Hoang',
        address: '123',
        privateKey: '123',
        currentSelectToken: 'HUSD',
        iv: '123',
        password: '123',
      } as WalletEntity;

      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);
      // Mock the contract instance and its methods
      ethersMock.Contract.mockReturnValue({
        mint: jest.fn().mockResolvedValue('mockedTxHash'),
      });
      // Mock the executeMint method success at minting token
      jest.spyOn(walletService, 'executeMint').mockResolvedValue('mockedTxHash');
      // Act
      const result = await walletService.mintTokens(existWallet.address, amount.toString());
      // Assert
      expect(result).toEqual('mockedTxHash');
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { address: existWallet.address } });
      expect(walletService.executeMint).toHaveBeenCalledWith(
        expect.any(Object), // Contract instance
        existWallet.address,
        amount.toString(),
      );
    });
    it('should fail to  mint tokens assuming minting contract is failed', async () => {

      // Arrange
      const userId = 'user123';
      const amount = 100;
      const existWallet = {
        id: '1',
        userId: userId,
        username: 'Hoang',
        address: '123',
        privateKey: '123',
        currentSelectToken: 'HUSD',
        iv: '123',
        password: '123',
      } as WalletEntity;
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);
      // Mock the executeMint method fail
      const executeMintError = new Error('Mocked minting error');
      jest.spyOn(walletService, 'executeMint').mockRejectedValue(executeMintError);
      // Act and Assert
      await expect(walletService.mintTokens(existWallet.address, amount.toString())).rejects.toThrowError('Mocked minting error');
      expect(walletRepository.findOne).toHaveBeenCalledWith({ where: { address: existWallet.address } });
    })
  });
  describe('burn token', () => {
    it('should successfully return transaction hash assumint minting is successfull', async () => {
      // Arrange
      const userId = 'user123';
      const amount = 100;
      const privateKey = '0x8736861a248663f0ed9a8d30e04fdd90645e3924d8a4b14593df3c92feb498e3';

      // Create a wallet with a valid address
      const sourceWalletMock = createWallet(privateKey);

      const existWallet = {
        id: '1',
        userId: userId,
        username: 'Hoang',
        address: sourceWalletMock.address, // Set the address from the created wallet
        privateKey: privateKey,
        currentSelectToken: 'HUSD',
        iv: '123',
        password: '123',
      } as WalletEntity;
      // Mock the findOne method to resolve with the existing wallet
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);

      ethersMock.Contract.mockReturnValue({
        burn: jest.fn().mockResolvedValue('mockedTxHash'),
      });

      // Mock the executeBurn method success at burning token
      jest.spyOn(walletService, 'executeBurn').mockResolvedValue('mockedTxHash');

      // Act
      const result = await walletService.burn(amount.toString(), existWallet.privateKey);

      // Assert
      expect(result).toEqual('mockedTxHash');
      expect(walletRepository.findOne).not.toEqual(undefined);
      expect(walletService.executeBurn).toHaveBeenCalledWith(
        expect.any(Object), // Contract instance
        amount.toString(),
      );
    })
    it('should return undefinded asumint burning tokens failed', async () => {
      // Arrange
      const userId = 'user123';
      const amount = 100;
      const privateKey = '0x8736861a248663f0ed9a8d30e04fdd90645e3924d8a4b14593df3c92feb498e3';

      // Create a wallet with a valid address
      const sourceWalletMock = createWallet(privateKey);

      const existWallet = {
        id: '1',
        userId: userId,
        username: 'Hoang',
        address: sourceWalletMock.address, // Set the address from the created wallet
        privateKey: privateKey,
        currentSelectToken: 'HUSD',
        iv: '123',
        password: '123',
      } as WalletEntity;
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(existWallet);
      const executeMintError = new Error('Mocked burning error');
      jest.spyOn(walletService, 'executeBurn').mockRejectedValue(executeMintError);
      // Act and Assert
      await expect(walletService.burn(amount.toString(), existWallet.privateKey)).rejects.toThrowError('Mocked burning error');
      expect(walletRepository.findOne).not.toEqual(undefined);
      expect(walletService.executeBurn).toHaveBeenCalledWith(
        expect.any(Object), // Contract instance
        amount.toString(),
      );
    })
  })
});
