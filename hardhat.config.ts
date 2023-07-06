import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-deploy';
import 'solidity-coverage';

export default {
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: '1000000000000000000000000',
      },
      allowUnlimitedContractSize: true,
      timeout: 6000000,
      forking: {
        url: `https://eth.llamarpc.com`,
      },
    },
    localnet: {
      url: 'http://127.0.0.1:8545',
      chainid: 1,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
      },
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 2000000,
  },
};
