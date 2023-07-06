import { expect } from 'chai';
import { ethers } from 'hardhat';
import { utils, constants } from 'ethers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MultiSwap, IERC20, IWETH9 } from '../typechain';
import { getCurrentTime } from './utils';
import {
  SWAP_ROUTER_ADDR,
  USDC,
  USDC_USDT_FEE,
  USDT,
  WETH,
  WETH_USDC_FEE,
  WETH_USDT_FEE,
} from './constants';

describe('MultiSwap', () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let multiSwap: MultiSwap;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();

    const MultiSwapFactory = await ethers.getContractFactory('MultiSwap');
    multiSwap = <MultiSwap>(
      await MultiSwapFactory.deploy(SWAP_ROUTER_ADDR, WETH)
    );

    weth = await ethers.getContractAt('IWETH9', WETH);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);

    const amount = utils.parseEther('50');

    await multiSwap.connect(bob).singleSwap(
      {
        tokens: [constants.AddressZero, USDC],
        fees: [WETH_USDC_FEE],
        amountIn: amount,
        minAmountOut: 0,
        deadline: 7777777777,
      },
      {
        value: amount,
      },
    );
  });

  describe('Check constructor and initial values', () => {
    it('check inital values', async () => {
      expect(await multiSwap.swapRouter()).to.be.equal(SWAP_ROUTER_ADDR);
    });

    it('it reverts if swap router is zero', async () => {
      const MultiSwapFactory = await ethers.getContractFactory('MultiSwap');

      await expect(
        MultiSwapFactory.deploy(constants.AddressZero, WETH),
      ).to.be.revertedWith('zero addr');
    });

    it('it reverts if weth is zero', async () => {
      const MultiSwapFactory = await ethers.getContractFactory('MultiSwap');

      await expect(
        MultiSwapFactory.deploy(SWAP_ROUTER_ADDR, constants.AddressZero),
      ).to.be.revertedWith('zero addr');
    });
  });

  describe('#singleSwap', () => {
    const ethAmount = utils.parseEther('4');
    const stableAmount = utils.parseUnits('100', 6);

    it('reverts if tokens.length is less than 2', async () => {
      await expect(
        multiSwap.connect(alice).singleSwap(
          {
            tokens: [constants.AddressZero],
            fees: [],
            amountIn: ethAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            value: ethAmount,
          },
        ),
      ).to.be.revertedWith('invalid tokens');
    });

    it('reverts if fee.length is not tokens.length - 1', async () => {
      await expect(
        multiSwap.connect(alice).singleSwap(
          {
            tokens: [constants.AddressZero, USDC],
            fees: [WETH_USDC_FEE, WETH_USDT_FEE],
            amountIn: ethAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            value: ethAmount,
          },
        ),
      ).to.be.revertedWith('invalid fees');
    });

    it('reverts if amountIn is zero', async () => {
      await expect(
        multiSwap.connect(alice).singleSwap({
          tokens: [constants.AddressZero, USDC],
          fees: [WETH_USDC_FEE],
          amountIn: 0,
          minAmountOut: 0,
          deadline: 7777777777,
        }),
      ).to.be.revertedWith('zero');
    });

    it('reverts if deadline is less than block time', async () => {
      const currentTime = await getCurrentTime();

      await expect(
        multiSwap.connect(alice).singleSwap(
          {
            tokens: [constants.AddressZero, USDC],
            fees: [WETH_USDC_FEE],
            amountIn: ethAmount,
            minAmountOut: 0,
            deadline: currentTime,
          },
          {
            value: ethAmount,
          },
        ),
      ).to.be.revertedWith('expired');
    });

    it('reverts if ETH remain after swap', async () => {
      await usdc.connect(bob).approve(multiSwap.address, stableAmount);

      await expect(
        multiSwap.connect(bob).singleSwap(
          {
            tokens: [USDC, USDT],
            fees: [USDC_USDT_FEE],
            amountIn: stableAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            value: stableAmount,
          },
        ),
      ).to.be.revertedWith('invalid value sent');

      await expect(
        multiSwap.connect(alice).singleSwap(
          {
            tokens: [constants.AddressZero, USDC],
            fees: [WETH_USDC_FEE],
            amountIn: ethAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            value: ethAmount.add(1),
          },
        ),
      ).to.be.revertedWith('invalid value');
    });

    it('swap ETH to ERC20 with single path', async () => {
      await multiSwap.connect(alice).singleSwap(
        {
          tokens: [constants.AddressZero, USDC],
          fees: [WETH_USDC_FEE],
          amountIn: ethAmount,
          minAmountOut: 0,
          deadline: 7777777777,
        },
        {
          value: ethAmount,
        },
      );

      const usdcBal = await usdc.balanceOf(alice.address);
      expect(usdcBal.gt(0)).to.be.true;
    });

    it('swap ETH to ERC20 with multi path', async () => {
      await multiSwap.connect(alice).singleSwap(
        {
          tokens: [constants.AddressZero, USDC, USDT],
          fees: [WETH_USDC_FEE, USDC_USDT_FEE],
          amountIn: ethAmount,
          minAmountOut: 0,
          deadline: 7777777777,
        },
        { value: ethAmount },
      );

      const usdtBal = await usdt.balanceOf(alice.address);
      expect(usdtBal.gt(0)).to.be.true;
    });

    it('swap ERC20 to ERC20 with single path', async () => {
      await usdc.connect(bob).approve(multiSwap.address, stableAmount);
      await multiSwap.connect(bob).singleSwap({
        tokens: [USDC, USDT],
        fees: [USDC_USDT_FEE],
        amountIn: stableAmount,
        minAmountOut: 0,
        deadline: 7777777777,
      });

      const usdtBal = await usdt.balanceOf(bob.address);
      expect(usdtBal.gt(0)).to.be.true;
    });

    it('swap ERC20 to ERC20 with multi path', async () => {
      await usdc.connect(bob).approve(multiSwap.address, stableAmount);
      await multiSwap.connect(bob).singleSwap({
        tokens: [USDC, USDT, WETH],
        fees: [USDC_USDT_FEE, WETH_USDT_FEE],
        amountIn: stableAmount,
        minAmountOut: 0,
        deadline: 7777777777,
      });

      const wethBal = await weth.balanceOf(bob.address);
      expect(wethBal.gt(0)).to.be.true;
    });

    it('swap ERC20 to ETH with single path', async () => {
      const ethBefore = await bob.getBalance();
      await usdc.connect(bob).approve(multiSwap.address, stableAmount);
      await multiSwap.connect(bob).singleSwap({
        tokens: [USDC, constants.AddressZero],
        fees: [WETH_USDC_FEE],
        amountIn: stableAmount,
        minAmountOut: 0,
        deadline: 7777777777,
      });

      const ethAfter = await bob.getBalance();
      expect(ethAfter.gt(ethBefore)).to.be.true;
    });

    it('swap ERC20 to ETH with multi path', async () => {
      const ethBefore = await bob.getBalance();
      await usdc.connect(bob).approve(multiSwap.address, stableAmount);
      await multiSwap.connect(bob).singleSwap({
        tokens: [USDC, USDT, constants.AddressZero],
        fees: [USDC_USDT_FEE, WETH_USDT_FEE],
        amountIn: stableAmount,
        minAmountOut: 0,
        deadline: 7777777777,
      });

      const ethAfter = await bob.getBalance();
      expect(ethAfter.gt(ethBefore)).to.be.true;
    });
  });

  describe('#multiSwap', () => {
    const ethAmount = utils.parseEther('4');
    const stableAmount = utils.parseUnits('100', 6);

    it('reverts if ETH remain after swap', async () => {
      await usdc.connect(bob).approve(multiSwap.address, stableAmount.mul(2));

      await expect(
        multiSwap.connect(bob).multiSwap(
          [
            {
              tokens: [constants.AddressZero, USDT],
              fees: [WETH_USDT_FEE],
              amountIn: ethAmount,
              minAmountOut: 0,
              deadline: 7777777777,
            },
            {
              tokens: [USDC, WETH],
              fees: [WETH_USDC_FEE],
              amountIn: stableAmount,
              minAmountOut: 0,
              deadline: 7777777777,
            },
            {
              tokens: [USDC, constants.AddressZero],
              fees: [WETH_USDC_FEE],
              amountIn: stableAmount,
              minAmountOut: 0,
              deadline: 7777777777,
            },
          ],
          {
            value: ethAmount.add(1),
          },
        ),
      ).to.be.revertedWith('invalid value sent');
    });

    it('swap multiple tokens', async () => {
      await usdc.connect(bob).approve(multiSwap.address, stableAmount.mul(4));

      const ethBefore = await bob.getBalance();

      await multiSwap.connect(bob).multiSwap(
        [
          {
            tokens: [constants.AddressZero, USDT],
            fees: [WETH_USDT_FEE],
            amountIn: ethAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            tokens: [USDC, WETH],
            fees: [WETH_USDC_FEE],
            amountIn: stableAmount,
            minAmountOut: 0,
            deadline: 7777777777,
          },
          {
            tokens: [USDC, constants.AddressZero],
            fees: [WETH_USDC_FEE],
            amountIn: stableAmount.mul(3),
            minAmountOut: 0,
            deadline: 7777777777,
          },
        ],
        {
          value: ethAmount,
        },
      );

      const ethAfter = await bob.getBalance();
      expect(ethAfter.gt(ethBefore.sub(ethAmount))).to.be.true;

      const usdtBal = await usdt.balanceOf(bob.address);
      expect(usdtBal.gt(0)).to.be.true;

      const wethBal = await weth.balanceOf(bob.address);
      expect(wethBal.gt(0)).to.be.true;
    });
  });
});
