const chai = require('chai');
const { expect } = require('chai');
const { initialize, setup } = require('@spectrexyz/protocol-helpers');
const { near } = require('@spectrexyz/protocol-helpers/chai');
const { advanceTime, currentTimestamp } = require('@spectrexyz/protocol-helpers/time');

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe('sBootstrappingPool', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    describe('» start weight is valid', () => {
      describe('» and end weight is valid', () => {
        describe('» and swap fee is valid', () => {
          before(async () => {
            await setup(this, { balancer: true, mint: false });
          });

          it('it sets the pool name', async () => {
            expect(await this.sBootstrappingPool.name()).to.equal(this.params.sBootstrappingPool.name);
          });

          it('it sets the pool symbol', async () => {
            expect(await this.sBootstrappingPool.symbol()).to.equal(this.params.sBootstrappingPool.symbol);
          });

          it('it sets the pool decimals', async () => {
            expect(await this.sBootstrappingPool.decimals()).to.equal(18);
          });

          it('it sets the vault', async () => {
            expect(await this.sBootstrappingPool.getVault()).to.equal(this.contracts.Vault.address);
          });

          it('it sets the swap fee', async () => {
            expect(await this.sBootstrappingPool.getSwapFeePercentage()).to.equal(this.params.sBootstrappingPool.swapFeePercentage);
          });

          it('it sets the authorizer', async () => {
            expect(await this.sBootstrappingPool.getAuthorizer()).to.equal(this.contracts.Authorizer.address);
          });

          it('it sets no owner', async () => {
            expect(await this.sBootstrappingPool.getOwner()).to.equal('0x0000000000000000000000000000000000000000');
          });

          it('it starts with no BPT', async () => {
            expect(await this.sBootstrappingPool.totalSupply()).to.equal(0);
          });

          it('it initializes tokens weights', async () => {
            const weights = await this.sBootstrappingPool.getNormalizedWeights();

            expect(weights[0]).to.equal(this.constants.sBootstrappingPool.ONE.sub(this.params.sBootstrappingPool.normalizedStartWeight));
            expect(weights[1]).to.equal(this.params.sBootstrappingPool.normalizedStartWeight);
            expect(await this.sBootstrappingPool.maxWeightTokenIndex()).to.equal(this.sBootstrappingPool.sERC20IsToken0 ? 1 : 0);
          });

          it('it registers the pool in the vault', async () => {
            const pool = await this.contracts.Vault.getPool(this.data.poolId);

            expect(pool[0]).to.equal(this.sBootstrappingPool.contract.address);
            expect(pool[1]).to.equal(this.constants.sBootstrappingPool.TWO_TOKEN_POOL);
          });

          it('it registers tokens in the vault', async () => {
            const { tokens, balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);

            expect(tokens[0]).to.equal(this.contracts.WETH.address);
            expect(tokens[1]).to.equal(this.contracts.sERC20.address);
            expect(balances[0]).to.equal(0);
            expect(balances[1]).to.equal(0);
          });

          it('it enables the oracle', async () => {
            expect((await this.sBootstrappingPool.getMiscData()).oracleEnabled).to.equal(true);
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

        describe('» but swap fee is invalid', () => {
          it('it reverts [swap fee too big]', async () => {
            await expect(setup(this, { balancer: true, mint: false, invalidSwapFee: true, tooBig: true })).to.be.revertedWith('BAL#202');
          });

          it('it reverts [swap fee too small]', async () => {
            await expect(setup(this, { balancer: true, mint: false, invalidSwapFee: true })).to.be.revertedWith('BAL#203');
          });
        });
      });

      describe('» but end weight is invalid', () => {
        it('it reverts [sERC20EndWeight too big]', async () => {
          await expect(setup(this, { balancer: true, mint: false, invalidEndWeight: true, tooBig: true })).to.be.revertedWith('BAL#302');
        });

        it('it reverts [sERC20EndWeight too small]', async () => {
          await expect(setup(this, { balancer: true, mint: false, invalidEndWeight: true })).to.be.revertedWith(
            'sBootstrappingPool: sERC20 max weigth must be superior to sERC20 min weight'
          );
        });
      });
    });

    describe('» but start weight is invalid', () => {
      it('it reverts [sERC20StartWeight too big]', async () => {
        await expect(setup(this, { balancer: true, mint: false, invalidStartWeight: true, tooBig: true })).to.be.revertedWith('BAL#302');
      });

      it('it reverts [sERC20StartWeight too small]', async () => {
        await expect(setup(this, { balancer: true, mint: false, invalidStartWeight: true })).to.be.revertedWith('BAL#302');
      });
    });
  });

  describe('# pokeWeights', () => {
    describe('» oracle', () => {
      before(async () => {
        await setup(this, { balancer: true });
        await this.sBootstrappingPool.join({ init: true });
        await this.sBootstrappingPool.join();

        this.data.previousPoolData = await this.sBootstrappingPool.getMiscData();
        this.data.previousInvariant = await this.sBootstrappingPool.getInvariant();
        this.data.previousPairPrice = await this.sBootstrappingPool.pairPrice();
        this.data.previousBTPPrice = await this.sBootstrappingPool.BTPPrice();

        // move time forward to create a new oracle sample
        await advanceTime(ethers.BigNumber.from('180'));
        await this.sERC20.mint(this, { amount: this.params.sERC20.cap });
        await this.sBootstrappingPool.pokeWeights();
        this.data.currentTimestamp = await currentTimestamp();

        this.data.latestCachedPairPrice = await this.sBootstrappingPool.getLatest(this.constants.sBootstrappingPool.ORACLE_VARIABLE.PAIR_PRICE);
        this.data.latestCachedBPTPrice = await this.sBootstrappingPool.getLatest(this.constants.sBootstrappingPool.ORACLE_VARIABLE.BPT_PRICE);
        this.data.latestCachedInvariant = await this.sBootstrappingPool.getLatest(this.constants.sBootstrappingPool.ORACLE_VARIABLE.INVARIANT);
        this.data.latestInvariant = await this.sBootstrappingPool.getLastInvariant();
        this.data.latestPoolData = await this.sBootstrappingPool.getMiscData();
        this.data.currentInvariant = await this.sBootstrappingPool.getInvariant();
      });

      it('it updates the oracle index and timestamp', async () => {
        expect(this.data.latestPoolData.oracleIndex).to.equal(this.data.previousPoolData.oracleIndex.add(1));
        expect(this.data.latestPoolData.oracleSampleCreationTimestamp).to.equal(this.data.currentTimestamp);
      });

      it('stores the pre-poke spot price', async () => {
        expect(this.data.latestCachedPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
      });

      it('stores the pre-poke BTP price', async () => {
        expect(this.data.latestCachedBPTPrice).to.be.near(this.data.previousBTPPrice, MAX_RELATIVE_ERROR * 2);
      });

      it('stores the pre-poke invariant', async () => {
        expect(this.data.latestCachedInvariant).to.be.near(this.data.previousInvariant, MAX_RELATIVE_ERROR);
      });

      it('it caches the current invariant', async () => {
        expect(this.data.latestInvariant).to.equal(this.data.currentInvariant);
        expect(await this.contracts.OracleMock.fromLowResLog(this.data.latestPoolData.logInvariant)).to.be.near(this.data.currentInvariant, MAX_RELATIVE_ERROR);
      });

      it('it caches the current supply', async () => {
        expect(await this.contracts.OracleMock.fromLowResLog(this.data.latestPoolData.logTotalSupply)).to.be.near(
          await this.sBootstrappingPool.totalSupply(),
          MAX_RELATIVE_ERROR
        );
      });
    });

    describe('» math', () => {
      describe('» sERC20 supply is 0% of its cap', () => {
        before(async () => {
          await setup(this, { balancer: true, mint: false });
          await this.sBootstrappingPool.pokeWeights();

          this.data.weights = await this.sBootstrappingPool.getNormalizedWeights();
          this.data.expectedWeights = await this.sBootstrappingPool.expectedWeights();
        });

        it('it updates weights accordingly', async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });

        it('it updates maxWeightTokenIndex accordingly', async () => {
          expect(await this.sBootstrappingPool.maxWeightTokenIndex()).to.equal(await this.sBootstrappingPool.expectedMaxWeightTokenIndex());
        });
      });

      describe('» sERC20 supply is 50% of the its cap', () => {
        before(async () => {
          await setup(this, { balancer: true, mint: false });

          await this.sERC20.mint({ amount: this.params.sERC20.cap.div(ethers.BigNumber.from('2')) });
          await this.sBootstrappingPool.pokeWeights();

          this.data.weights = await this.sBootstrappingPool.getNormalizedWeights();
          this.data.expectedWeights = await this.sBootstrappingPool.expectedWeights();
        });

        it('it updates weights accordingly', async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });

        it('it updates maxWeightTokenIndex accordingly', async () => {
          expect(await this.sBootstrappingPool.maxWeightTokenIndex()).to.equal(await this.sBootstrappingPool.expectedMaxWeightTokenIndex());
        });
      });

      describe('» sERC20 supply is 100% of the its cap', () => {
        before(async () => {
          await setup(this, { balancer: true, mint: false });

          await this.sERC20.mint({ amount: this.params.sERC20.cap });
          await this.sBootstrappingPool.pokeWeights();

          this.data.weights = await this.sBootstrappingPool.getNormalizedWeights();
          this.data.expectedWeights = await this.sBootstrappingPool.expectedWeights();
        });

        it('it updates weights accordingly', async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });

        it('it updates maxWeightTokenIndex accordingly', async () => {
          expect(await this.sBootstrappingPool.maxWeightTokenIndex()).to.equal(await this.sBootstrappingPool.expectedMaxWeightTokenIndex());
        });
      });
    });
  });

  describe.only('# join ⇌ reward', () => {
    before(async () => {
      await setup(this, { balancer: true });
      await this.sBootstrappingPool.join({ init: true });
      await this.sBootstrappingPool.join();

      this.data.previousTotalSupply = await this.sBootstrappingPool.totalSupply();
      this.data.previousBalances = (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances;
      this.data.previousBTPPrice = await this.sBootstrappingPool.BTPPrice();

      await this.sBootstrappingPool.join({ reward: true });
      this.data.latestTotalSupply = await this.sBootstrappingPool.totalSupply();
      this.data.latestBalances = (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances;
      this.data.latestBTPPrice = await this.sBootstrappingPool.BTPPrice();
    });

    it('it sets the pool name', async () => {
      console.log(this.data.previousTotalSupply.toString());
      console.log((await this.sBootstrappingPool.totalSupply()).toString());

      console.log(this.data.previousBalances[0].toString());
      console.log(this.data.previousBalances[1].toString());
      console.log(this.data.latestBalances[0].toString());
      console.log(this.data.latestBalances[1].toString());

      console.log(this.data.previousBTPPrice.toString());
      console.log(this.data.latestBTPPrice.toString());
    });
  });

  // describe.skip('# mint', () => {
  //   before(async () => {
  //     await setup(this, { balancer: true });
  //     await join(this, { init: true });

  //     const singleSwap = {
  //       poolId: this.data.poolId,
  //       kind: 0, // GIVEN_IN
  //       assetIn: ethers.constants.AddressZero,
  //       assetOut: this.contracts.sERC20.address,
  //       amount: ethers.BigNumber.from('10000000'),
  //       userData: '0x77', //ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
  //     };

  //     const fundManagement = {
  //       sender: this.signers.holders[0].address,
  //       fromInternalBalance: false,
  //       recipient: this.signers.holders[0].address,
  //       toInternalBalance: false,
  //     };

  //     const HOUR = ethers.BigNumber.from('3600');

  //     const timestamp = (await currentTimestamp()).add(HOUR);

  //     this.data.tx = await this.contracts.Vault.swap(singleSwap, fundManagement, 0, timestamp, { value: ethers.BigNumber.from('10000000') });
  //     this.data.receipt = await this.data.tx.wait();
  //   });

  //   it('it does something', () => {});
  // });

  // describe.skip('# join', () => {
  //   describe('» transaction initializes the pool', () => {
  //     before(async () => {
  //       await setup(this, { balancer: true });
  //       await join(this, { init: true });
  //     });
  //     itJoinsPoolLikeExpected(this, { init: true });
  //   });

  //   describe('» transaction does not initialize the pool', () => {
  //     describe('» and the last change block is an old block', () => {});
  //   });
  // });
});
