const { expect } = require('chai');
const { ethers } = require('ethers');
const { deployContract } = require('ethereum-waffle');
const {
  initialize,
  mint,
  mock,
  safeBatchTransferFrom,
  safeTransferFrom,
  setApprovalForAll,
  setup,
  spectralize,
  unlock,
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

          it('# it registers pool', async () => {
            const pool = await this.contracts.Vault.getPool(this.data.poolId);

            expect(await this.contracts.SBP.getVault()).to.equal(this.contracts.Vault.address);
            expect(pool[0]).to.equal(this.contracts.SBP.address);
            expect(pool[1]).to.equal(2);
          });

          it('# it initializes pool token', async () => {
            expect(await this.contracts.SBP.name()).to.equal(this.constants.pool.name);
            expect(await this.contracts.SBP.symbol()).to.equal(this.constants.pool.symbol);
            // await console.log(await this.contracts.SBP.getMiscData());
          });

          it('# it registers swap fee', async () => {
            expect(await this.contracts.SBP.getSwapFeePercentage()).to.equal(this.constants.pool.swapFeePercentage);
          });

          it('it registers tokens', async () => {
            const tokens = await this.contracts.Vault.getPoolTokens(this.data.poolId);
            expect(tokens.tokens[0]).to.equal(this.contracts.WETH.address);
            expect(tokens.tokens[1]).to.equal(this.contracts.sERC20.address);
          });

          it('it initializes tokens weights', async () => {
            const weights = await this.contracts.SBP.getNormalizedWeights();

            expect(weights[0]).to.equal(ethers.BigNumber.from('1000000000000000000').sub(this.constants.pool.normalizedStartWeight));
            expect(weights[1]).to.equal(this.constants.pool.normalizedStartWeight);
          });
        });
      });
    });
  });
});
