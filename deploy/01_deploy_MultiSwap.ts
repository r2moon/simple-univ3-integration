import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  const SWAP_ROUTER_ADDR = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

  await deploy('MultiSwap', {
    from: deployer,
    args: [SWAP_ROUTER_ADDR, WETH],
    log: true,
  });
};

export default deploy;
deploy.tags = ['MultiSwap'];
