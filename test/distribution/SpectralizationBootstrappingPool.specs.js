const { expect } = require('chai');
const { ethers } = require('ethers');
const { deployContract } = require('ethereum-waffle');
const {
  initialize,
  currentTimestamp,
  join,
  mint,
  mock,
  safeBatchTransferFrom,
  safeTransferFrom,
  setApprovalForAll,
  setup,
  spectralize,
  unlock,
  itJoinsPoolLikeExpected,

  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  itUnlocksLikeExpected,
  transfer,
} = require('../helpers');

describe.only('SpectralizationBootstrappingPool', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    describe('» start weight is valid', () => {
      describe('» and end weight is valid', () => {
        describe('» and swap fee is valid', () => {
          before(async () => {
            await setup(this, { balancer: true });
          });

          it('it sets the pool name', async () => {
            expect(await this.contracts.SBP.name()).to.equal(this.constants.pool.name);
          });

          it('it sets the pool symbol', async () => {
            expect(await this.contracts.SBP.symbol()).to.equal(this.constants.pool.symbol);
          });

          it('it sets the pool decimals', async () => {
            expect(await this.contracts.SBP.decimals()).to.equal(18);
          });

          it('it sets the vault', async () => {
            expect(await this.contracts.SBP.getVault()).to.equal(this.contracts.Vault.address);
          });

          it('# it set swap fee', async () => {
            expect(await this.contracts.SBP.getSwapFeePercentage()).to.equal(this.constants.pool.swapFeePercentage);
          });

          it('it starts with no BPT', async () => {
            expect(await this.contracts.SBP.totalSupply()).to.equal(0);
          });

          it('it initializes tokens weights', async () => {
            const weights = await this.contracts.SBP.getNormalizedWeights();

            expect(weights[0]).to.equal(ethers.BigNumber.from('1000000000000000000').sub(this.constants.pool.normalizedStartWeight));
            expect(weights[1]).to.equal(this.constants.pool.normalizedStartWeight);
          });

          it('it registers the pool in the vault', async () => {
            const pool = await this.contracts.Vault.getPool(this.data.poolId);

            expect(pool[0]).to.equal(this.contracts.SBP.address);
            expect(pool[1]).to.equal(this.constants.pool.TWO_TOKEN_POOL);
          });

          it('it registers tokens in the Vault', async () => {
            const { tokens, balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);

            expect(tokens[0]).to.equal(this.contracts.WETH.address);
            expect(tokens[1]).to.equal(this.contracts.sERC20.address);
            expect(balances[0]).to.equal(0);
            expect(balances[1]).to.equal(0);
          });

          it('it disable asset managers', async () => {
            expect((await this.contracts.Vault.getPoolTokenInfo(this.data.poolId, this.contracts.WETH.address)).assetManager).to.equal(
              ethers.constants.AddressZero
            );
            expect((await this.contracts.Vault.getPoolTokenInfo(this.data.poolId, this.contracts.sERC20.address)).assetManager).to.equal(
              ethers.constants.AddressZero
            );
          });
        });
      });
    });
  });

  describe.only('# pokeWeights', () => {
    before(async () => {
      await setup(this, { balancer: true });
      await join(this, { init: true });
      await join(this);

      // const singleSwap = {
      //   poolId: this.data.poolId,
      //   kind: 0, // GIVEN_IN
      //   assetIn: ethers.constants.AddressZero,
      //   assetOut: this.contracts.sERC20.address,
      //   amount: ethers.BigNumber.from('10000000'),
      //   userData: '0x77', //ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
      // };

      // const fundManagement = {
      //   sender: this.signers.holders[0].address,
      //   fromInternalBalance: false,
      //   recipient: this.signers.holders[0].address,
      //   toInternalBalance: false,
      // };

      // const HOUR = ethers.BigNumber.from('3600');

      // const timestamp = (await currentTimestamp()).add(HOUR);

      // this.data.tx = await this.contracts.Vault.swap(singleSwap, fundManagement, 0, timestamp, { value: ethers.BigNumber.from('10000000') });
      // this.data.receipt = await this.data.tx.wait();
      this.data.lastPrice = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE);
      console.log((await this.contracts.SBP.getNormalizedWeights())[0].toString());
      console.log('Supply: ' + (await this.contracts.sERC20.totalSupply()).toString());
      console.log('Cap: ' + (await this.contracts.sERC20.cap()).toString());
      console.log('Mint');
      await mint.sERC20(this, { amount: ethers.utils.parseEther('900') });
      console.log('Cap: ' + (await this.contracts.sERC20.cap()).toString());
      console.log('Supply: ' + (await this.contracts.sERC20.totalSupply()).toString());
      await this.contracts.SBP.pokeWeights();
      console.log((await this.contracts.SBP.getNormalizedWeights())[0].toString());

      console.log(this.data.lastPrice.toString());
    });

    it('it does something', async () => {
      console.log((await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE)).toString());

      await join(this);

      console.log((await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE)).toString());
    });
  });

  describe('# mint', () => {
    before(async () => {
      await setup(this, { balancer: true });
      await join(this, { init: true });

      const singleSwap = {
        poolId: this.data.poolId,
        kind: 0, // GIVEN_IN
        assetIn: ethers.constants.AddressZero,
        assetOut: this.contracts.sERC20.address,
        amount: ethers.BigNumber.from('10000000'),
        userData: '0x77', //ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
      };

      const fundManagement = {
        sender: this.signers.holders[0].address,
        fromInternalBalance: false,
        recipient: this.signers.holders[0].address,
        toInternalBalance: false,
      };

      const HOUR = ethers.BigNumber.from('3600');

      const timestamp = (await currentTimestamp()).add(HOUR);

      this.data.tx = await this.contracts.Vault.swap(singleSwap, fundManagement, 0, timestamp, { value: ethers.BigNumber.from('10000000') });
      this.data.receipt = await this.data.tx.wait();
    });

    it('it does something', () => {});
  });

  describe.skip('# join', () => {
    describe('» transaction initializes the pool', () => {
      before(async () => {
        await setup(this, { balancer: true });
        await join(this, { init: true });
      });
      itJoinsPoolLikeExpected(this, { init: true });
    });

    describe('» transaction does not initialize the pool', () => {
      describe('» and the last change block is an old block', () => {});
    });
  });
});
