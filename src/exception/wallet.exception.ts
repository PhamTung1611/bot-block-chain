import { HttpException, HttpStatus } from "@nestjs/common";

export class WalletNotFoundException extends HttpException {
    constructor() {
        super('Wallet not found', HttpStatus.BAD_REQUEST);
    }
}
export class WalletNotHaveEnoughFundsException extends HttpException {
    constructor() {
        super('not have enough fund', HttpStatus.BAD_REQUEST);
    }
}