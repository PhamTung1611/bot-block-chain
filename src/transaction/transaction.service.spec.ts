import { Repository, SelectQueryBuilder } from "typeorm";
import { TransactionEntity } from "./transaction.entity";
import { TransactionService } from "./transaction.service";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TransactionStatus } from "./enum/transaction.enum";

describe('Transaction Service', () => {
    let transactionService: TransactionService;
    let transactionRepository: Repository<TransactionEntity>;
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TransactionService,
                {
                    provide: getRepositoryToken(TransactionEntity),
                    useClass: Repository,
                }]
        }).compile();

        transactionService = module.get<TransactionService>(TransactionService);
        transactionRepository = module.get<Repository<TransactionEntity>>(getRepositoryToken(TransactionEntity));
    })

    it('should be defined', () => {
        expect(transactionService).toBeDefined();
        expect(transactionRepository).toBeDefined();
    });
    describe('create Transaction', () => {
        it('should return transaction if created', async () => {
            // Arrange
            const jsonData = {
                id: '1',
                transactionHash: '123',
                token: 'HUSD',
                senderAddress: '123',
                receiverAddress: '123',
                balance: '1000',
                type: 'test',
                status: 'created',
            } as TransactionEntity

            // Mock the create and save methods of the repository
            jest.spyOn(transactionRepository, 'create').mockReturnValue(jsonData);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(jsonData);

            // Act
            const result = await transactionService.createTransaction(jsonData);

            // Assert
            expect(result).toEqual(jsonData);
            expect(transactionRepository.create).toHaveBeenCalledWith(jsonData);
            expect(transactionRepository.save).toHaveBeenCalledWith(jsonData);
        })
        it('should return undefined if it failed to create', async () => {
            // Arrange
            const jsonData = {
                id: '1',
                transactionHash: '123',
                token: 'HUSD',
                senderAddress: '123',
                receiverAddress: '123',
                balance: '1000',
                type: 'test',
                status: 'created',
            } as TransactionEntity

            // Mock the create and save methods of the repository
            jest.spyOn(transactionRepository, 'create').mockReturnValue(undefined);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(undefined);

            // Act
            const result = await transactionService.createTransaction(jsonData);

            // Assert
            expect(result).toEqual(undefined);
            expect(transactionRepository.create).toHaveBeenCalledWith(jsonData);
        })
    })
    describe('updateTransactionState', () => {
        it('should update the transaction state and return true', async () => {
            // Arrange
            const statusToUpdate = TransactionStatus.SUCCESS; // Replace with the desired status
            const transactionId = 'your-transaction-id'; // Replace with the actual transaction ID
            const existingTransaction = {
                id: transactionId,
                // other properties...
            } as TransactionEntity;

            // Mock the findTransactionById and save methods
            jest.spyOn(transactionService, 'findTransactionById').mockResolvedValue(existingTransaction);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(existingTransaction);

            // Act
            const result = await transactionService.updateTransactionState(statusToUpdate, transactionId);

            // Assert
            expect(result).toBe(true);
            expect(transactionService.findTransactionById).toHaveBeenCalledWith(transactionId);
            expect(transactionRepository.save).toHaveBeenCalledWith({
                ...existingTransaction,
                status: statusToUpdate,
            });
        });

        it('should return false if the transaction update fails', async () => {
            // Arrange
            const statusToUpdate = TransactionStatus.FAIL; // Replace with the desired status
            const transactionId = 'your-transaction-id'; // Replace with the actual transaction ID
            const existingTransaction = {
                id: transactionId,
                // other properties...
            } as TransactionEntity;

            // Mock the findTransactionById and save methods
            jest.spyOn(transactionService, 'findTransactionById').mockResolvedValue(existingTransaction);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(undefined);

            // Act
            const result = await transactionService.updateTransactionState(statusToUpdate, transactionId);

            // Assert
            expect(result).toBe(false);
            expect(transactionService.findTransactionById).toHaveBeenCalledWith(transactionId);
            expect(transactionRepository.save).toHaveBeenCalledWith({
                ...existingTransaction,
                status: statusToUpdate,
            });
        });
    });
    describe('update Transaction Hash', () => {
        it('should return true if save transaction hash successfully', async () => {
            // Arrange
            const transactionHash = 'new Hash'; // Replace with the desired status
            const transactionId = 'your-transaction-id'; // Replace with the actual transaction ID
            const existingTransaction = {
                id: transactionId,
                // other properties...
            } as TransactionEntity;
            jest.spyOn(transactionService, 'findTransactionById').mockResolvedValue(existingTransaction);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(existingTransaction);
            // Act
            const result = await transactionService.updateTransactionHash(transactionHash, transactionId);

            // Assert
            expect(result).toBe(true);
            expect(transactionService.findTransactionById).toHaveBeenCalledWith(transactionId);
            expect(transactionRepository.save).toHaveBeenCalledWith(existingTransaction);
        })
        it('should return false if save transaction hash fail', async () => {
            // Arrange
            const transactionHash = 'new Hash'; // Replace with the desired status
            const transactionId = 'your-transaction-id'; // Replace with the actual transaction ID
            const existingTransaction = {
                id: transactionId,
                // other properties...
            } as TransactionEntity;
            jest.spyOn(transactionService, 'findTransactionById').mockResolvedValue(existingTransaction);
            jest.spyOn(transactionRepository, 'save').mockResolvedValue(undefined);
            // Act
            const result = await transactionService.updateTransactionHash(transactionHash, transactionId);

            // Assert
            expect(result).toBe(false);
            expect(transactionService.findTransactionById).toHaveBeenCalledWith(transactionId);
            expect(transactionRepository.save).toHaveBeenCalledWith(existingTransaction);
        })
        describe('get transaction history', () => {
            it('should return the amount history of the specified address', async () => {
                const limit = 10;
                const address = '0xAddress';

                const transactionEntities: TransactionEntity[] = [
                    {
                        id: '1',
                        transactionHash: '123',
                        balance: '1000',
                        receiverAddress: '123',
                        senderAddress: '123',
                        status: TransactionStatus.FAIL,
                        token: 'HUSD'
                    } as TransactionEntity
                ];

                jest.spyOn(transactionRepository, 'createQueryBuilder').mockReturnValue({
                    where: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    getMany: jest.fn().mockResolvedValue(transactionEntities),
                } as any);

                const result = await transactionService.getAmountHistory(limit, address);
                expect(result).toEqual(transactionEntities);
            })
        })
    });

})