import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './users.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
    constructor(@InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>) { }

    async createUser(jsonData: any) {
        const user = this.userRepository.create(jsonData);
        const createUser = await this.userRepository.save(user);
        if (createUser) {
            return true;
        } else {
            return false;
        }
    }

    async findOneUser(address: string) {
        const User = await this.userRepository.findOne({
            where: { address: address }
        });
        if (User) {
            return true;
        } else {
            return false;
        }
    }

    async updateMoney(address: string, money: number) {
        const checkUser = await this.userRepository.findOne({
            where: {
                address: address
            }
        })
        if (checkUser && Number(money) > 0) {
            const coin = Number(Number(checkUser.coin) + Number(money));
            await this.userRepository.update(checkUser.id, { coin: String(coin) });
            return true;
        } else {
            return false;
        }
    }

    async checkInformation(address:string):Promise<UserEntity>{
        return await this.userRepository.findOne({where:{
            address:address
        }});

    }

}
