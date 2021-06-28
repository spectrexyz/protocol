const { expect } = require('chai');
const { initialize, computeInvariant, join, setup, itJoinsPoolLikeExpected } = require('@spectrexyz/protocol-helpers');
const { near } = require('@spectrexyz/protocol-helpers/chai');
const { advanceTime, currentTimestamp } = require('@spectrexyz/protocol-helpers/time');
const chai = require('chai');

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe('SpectralizationBootstrappingPool', () => {
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
      console.log('Join 1');
      await join(this, { init: true });
      console.log('Join 2');

      await join(this);

      console.log('joined');

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

      await (await this.contracts.SBP.pokeWeights()).wait();

      this.data.previousPairPrice = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE);
      this.data.previousBPTPrice = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.BPT_PRICE);
      this.data.previousInvariant = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.INVARIANT);
      this.data.previousPoolData = await this.contracts.SBP.getMiscData();

      const { balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);
      const weights = await this.contracts.SBP.getNormalizedWeights();
      this.data.previousExpectedInvariant = computeInvariant([balances[0], balances[1]], [weights[0], weights[1]]);
      /// take with from getInvariant instead

      // move time forward to create a new oracle sample
      await advanceTime(ethers.BigNumber.from('180'));

      await this.sERC20.mint(this, { amount: ethers.utils.parseEther('900') });
      await (await this.contracts.SBP.pokeWeights()).wait();
      this.data.currentTimestamp = await currentTimestamp();

      this.data.lastPairPrice = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE);
      this.data.lastBPTPrice = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.BPT_PRICE);
      this.data.lastInvariant = await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.INVARIANT);
      this.data.lastPoolData = await this.contracts.SBP.getMiscData();

      // await mint.sERC20(this, { amount: ethers.utils.parseEther('900') });
      // console.log('Cap: ' + (await this.contracts.sERC20.cap()).toString());
      // console.log('Supply: ' + (await this.contracts.sERC20.totalSupply()).toString());
      // console.log((await this.contracts.SBP.getNormalizedWeights())[0].toString());

      // console.log(this.data.lastPrice.toString());

      // this.data.sample = await this.contracts.SBP.getOracleSample();
    });

    it('it does something', async () => {
      // console.log((await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE)).toString());
      // await join(this);
      // console.log((await this.contracts.SBP.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE)).toString());
    });

    it('it updates the oracle data', async () => {
      expect(this.data.lastPoolData.oracleIndex).to.equal(this.data.previousPoolData.oracleIndex.add(1));
      expect(this.data.lastPoolData.oracleSampleCreationTimestamp).to.equal(this.data.currentTimestamp);
    });

    it('it caches the log of the last invariant', async () => {
      // const expectedPreviousInvariant =

      // const invariant = computeInvariant(
      //   [ctx.constants.pooledETH, ctx.constants.pooledSERC20],
      //   [ctx.constants.pool.ONE.sub(ctx.constants.pool.normalizedStartWeight), ctx.constants.pool.normalizedStartWeight]
      // );
      // expect(await ctx.contracts.SBP.getLastInvariant()).to.be.near(invariant, 100000);
      // 3182145935019611022;
      // 3182286615916142423;
      // const { balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);
      // const weights = await this.contracts.SBP.getNormalizedWeights();
      // const invariant = computeInvariant([balances[0], balances[1]], [weights[0], weights[1]]);

      // console.log('Invariant computed ' + invariant.toString());
      // console.log('Current invariant ' + this.data.currentInvariant.toString());
      // console.log('Misc data invariant  ' + this.data.currentPoolData.logInvariant.toString());

      // console.log('Previous invariant ' + this.data.lastInvariant.toString());

      // 3182286615916142423;
      // 3182286615916142423;
      // console.log((await this.contracts.SBP.getInvariant()).toString());
      // console.log((await this.contracts.SBP.getLastInvariant()).toString());
      console.log(this.data.lastInvariant.toString());
      console.log(this.data.previousExpectedInvariant.toString());
      expect(this.data.lastInvariant).to.be.near(this.data.previousExpectedInvariant, MAX_RELATIVE_ERROR);
      // expect(10000).to.be.near(10, 0.000000001);
    });

    it('it caches the total supply', async () => {});

    it('it updates pair price', async () => {});

    it('it updates BPT price', async () => {});
  });

  describe.skip('# mint', () => {
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
