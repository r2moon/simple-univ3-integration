import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export const getCurrentTime = async (): Promise<BigNumber> =>
  BigNumber.from(
    (await ethers.provider.getBlock(await ethers.provider.getBlockNumber()))
      .timestamp,
  );
