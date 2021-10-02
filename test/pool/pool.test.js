const chai = require("chai");
const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { near } = require("../helpers/chai");
const { advanceTime, currentTimestamp } = require("../helpers/time");

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe("FractionalizationBootstrappingPool", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    describe("» sERC20 minimum weight is valid", () => {
      describe("» and sERC20 maximum weight is valid", () => {
        describe("» and swap fee is valid", () => {
          before(async () => {
            await setup.pool(this);
          });

          it("it sets up the pool's name", async () => {
            expect(await this.pool.name()).to.equal(this.params.pool.name);
          });

          it("it sets up the pool's symbol", async () => {
            expect(await this.pool.symbol()).to.equal(this.params.pool.symbol);
          });

          it("it sets up the pool's decimals", async () => {
            expect(await this.pool.decimals()).to.equal(18);
          });

          it("it sets up the pool's authorizer", async () => {
            expect(await this.pool.getAuthorizer()).to.equal(this.contracts.authorizer.address);
          });

          it("it sets up the pool's owner", async () => {
            expect(await this.pool.getOwner()).to.equal(this.signers.pool.owner.address);
          });

          it("it sets up the pool's pausable data", async () => {
            const state = await this.pool.getPausedState();

            expect(state.paused).to.equal(false);
            expect(state.pauseWindowEndTime).to.equal(this.data.timestamp.add(this.params.pool.pauseWindowDuration));
            expect(state.bufferPeriodEndTime).to.equal(this.params.pool.bufferPeriodDuration.add(state.pauseWindowEndTime));
          });

          it("it sets up the pool's swap fee", async () => {
            expect(await this.pool.getSwapFeePercentage()).to.equal(this.params.pool.swapFeePercentage);
          });

          it("it sets up the pool's vault", async () => {
            expect(await this.pool.getVault()).to.equal(this.contracts.bVault.address);
          });

          it("it sets up the pool's tokens weights", async () => {
            const weights = await this.pool.getNormalizedWeights();

            if (this.pool.sERC20IsToken0) {
              expect(weights[0]).to.equal(this.params.pool.sMaxNormalizedWeight);
              expect(weights[1]).to.equal(this.constants.pool.ONE.sub(this.params.pool.sMaxNormalizedWeight));
            } else {
              expect(weights[0]).to.equal(this.constants.pool.ONE.sub(this.params.pool.sMaxNormalizedWeight));
              expect(weights[1]).to.equal(this.params.pool.sMaxNormalizedWeight);
            }
          });

          it("it registers the pool in the vault", async () => {
            const pool = await this.contracts.bVault.getPool(this.data.poolId);

            expect(pool[0]).to.equal(this.pool.contract.address);
            expect(pool[1]).to.equal(this.constants.pool.TWO_TOKEN_POOL);
          });

          it("it registers the pool's tokens in the vault", async () => {
            const { tokens, balances } = await this.contracts.bVault.getPoolTokens(this.data.poolId);

            expect(balances[0]).to.equal(0);
            expect(balances[1]).to.equal(0);

            if (this.pool.sERC20IsToken0) {
              expect(tokens[0]).to.equal(this.sERC20.address);
              expect(tokens[1]).to.equal(this.contracts.WETH.address);
            } else {
              expect(tokens[0]).to.equal(this.contracts.WETH.address);
              expect(tokens[1]).to.equal(this.sERC20.address);
            }
          });

          it("it registers the pool's tokens asset managers as the zero address", async () => {
            expect((await this.contracts.bVault.getPoolTokenInfo(this.data.poolId, this.contracts.WETH.address)).assetManager).to.equal(
              ethers.constants.AddressZero
            );
            expect((await this.contracts.bVault.getPoolTokenInfo(this.data.poolId, this.contracts.sERC20.address)).assetManager).to.equal(
              ethers.constants.AddressZero
            );
          });
        });

        describe("» but swap fee is invalid", () => {
          describe("» because swap fee is too big", () => {
            it("it reverts", async () => {
              await expect(
                setup.pool(this, { mint: false, swapFeePercentage: this.constants.pool.MAX_SWAP_FEE_PERCENTAGE.add(this.constants.ONE) })
              ).to.be.revertedWith("BAL#202");
            });
          });

          describe("» because swap fee is too small", () => {
            it("it reverts", async () => {
              await expect(
                setup.pool(this, { mint: false, swapFeePercentage: this.constants.pool.MIN_SWAP_FEE_PERCENTAGE.sub(this.constants.ONE) })
              ).to.be.revertedWith("BAL#203");
            });
          });
        });
      });

      describe("» but sERC20 maximum weight is invalid", () => {
        describe("» because sERC20 maximum weight is too big", () => {
          it("it reverts", async () => {
            await expect(setup.pool(this, { mint: false, sMaxNormalizedWeight: this.constants.pool.ONE })).to.be.revertedWith("BAL#302");
          });
        });

        describe("» because sERC20 maximum weight is smaller than sERC20 minimum weight", () => {
          it("it reverts", async () => {
            await expect(setup.pool(this, { mint: false, sMaxNormalizedWeight: this.params.pool.sMinNormalizedWeight })).to.be.revertedWith(
              "FractionalizationBootstrappingPool: sERC20 max weight must be superior to sERC20 min weight"
            );
          });
        });
      });
    });

    describe("» but sERC20 minimal weight is invalid", () => {
      describe("» because sERC20 minimal weight is too small", () => {
        it("it reverts", async () => {
          await expect(setup.pool(this, { mint: false, sMinNormalizedWeight: this.constants.pool.MIN_WEIGHT.sub(this.constants.ONE) })).to.be.revertedWith(
            "BAL#302"
          );
        });
      });

      describe("» because sERC20 minimal weight is bigger than sERC20 maximal weight", () => {
        it("it reverts", async () => {
          await expect(setup.pool(this, { mint: false, sMinNormalizedWeight: this.params.pool.sMaxNormalizedWeight })).to.be.revertedWith(
            "FractionalizationBootstrappingPool: sERC20 max weight must be superior to sERC20 min weight"
          );
        });
      });
    });
  });

  describe("# poke", () => {
    describe("» oracle", () => {
      before(async () => {
        await setup.pool(this, { mint: true });

        await this.pool.join({ init: true });
        await this.pool.join();

        this.data.previousPoolData = await this.pool.getMiscData();
        this.data.previousInvariant = await this.pool.getInvariant();
        this.data.previousPairPrice = await this.pool.pairPrice();
        this.data.previousBTPPrice = await this.pool.BTPPrice();

        // move time forward to create a new oracle sample
        await advanceTime(ethers.BigNumber.from("180"));
        await this.sERC20.mint(this, { amount: this.params.sERC20.cap });
        await this.pool.poke();

        this.data.currentTimestamp = await currentTimestamp();
        this.data.latestCachedPairPrice = await this.pool.getLatest(this.constants.pool.ORACLE_VARIABLE.PAIR_PRICE);
        this.data.latestCachedBPTPrice = await this.pool.getLatest(this.constants.pool.ORACLE_VARIABLE.BPT_PRICE);
        this.data.latestCachedInvariant = await this.pool.getLatest(this.constants.pool.ORACLE_VARIABLE.INVARIANT);
        this.data.latestInvariant = await this.pool.getLastInvariant();
        this.data.latestPoolData = await this.pool.getMiscData();
        this.data.currentInvariant = await this.pool.getInvariant();
      });

      it("it updates the oracle index and timestamp", async () => {
        expect(this.data.latestPoolData.oracleIndex).to.equal(this.data.previousPoolData.oracleIndex.add(1));
        expect(this.data.latestPoolData.oracleSampleCreationTimestamp).to.equal(this.data.currentTimestamp);
      });

      it("it caches the pre-poke spot price", async () => {
        expect(this.data.latestCachedPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
      });

      it("it caches the pre-poke BTP price", async () => {
        expect(this.data.latestCachedBPTPrice).to.be.near(this.data.previousBTPPrice, MAX_RELATIVE_ERROR * 2);
      });

      it("it caches the pre-poke invariant", async () => {
        expect(this.data.latestCachedInvariant).to.be.near(this.data.previousInvariant, MAX_RELATIVE_ERROR);
      });

      it("it caches the current invariant", async () => {
        expect(this.data.latestInvariant).to.equal(this.data.currentInvariant);
        expect(await this.contracts.oracleMock.fromLowResLog(this.data.latestPoolData.logInvariant)).to.be.near(this.data.currentInvariant, MAX_RELATIVE_ERROR);
      });

      it("it stores the current supply", async () => {
        expect(await this.contracts.oracleMock.fromLowResLog(this.data.latestPoolData.logTotalSupply)).to.be.near(
          await this.pool.totalSupply(),
          MAX_RELATIVE_ERROR
        );
      });
    });

    describe("» math", () => {
      describe("» sERC20 supply is 0% of its cap", () => {
        before(async () => {
          await setup.pool(this);

          await this.pool.poke();

          this.data.weights = await this.pool.getNormalizedWeights();
          this.data.expectedWeights = await this.pool.expectedWeights();
        });

        it("it updates tokens weights accordingly", async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });
      });

      describe("» sERC20 supply is 50% of the its cap", () => {
        before(async () => {
          await setup.pool(this);

          await this.sERC20.mint({ amount: this.params.sERC20.cap.div(ethers.BigNumber.from("2")) });
          await this.pool.poke();

          this.data.weights = await this.pool.getNormalizedWeights();
          this.data.expectedWeights = await this.pool.expectedWeights();
        });

        it("it updates tokens weights accordingly", async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });
      });

      describe("» sERC20 supply is 100% of the its cap", () => {
        before(async () => {
          await setup.pool(this);

          await this.sERC20.mint({ amount: this.params.sERC20.cap });
          await this.pool.poke();

          this.data.weights = await this.pool.getNormalizedWeights();
          this.data.expectedWeights = await this.pool.expectedWeights();
        });

        it("it updates tokens weights accordingly", async () => {
          expect(this.data.weights[0]).to.equal(this.data.expectedWeights[0]);
          expect(this.data.weights[1]).to.equal(this.data.expectedWeights[1]);
        });
      });
    });
  });

  describe("# join ⇌ reward", () => {
    before(async () => {
      await setup.pool(this, { mint: true });

      await this.pool.join({ init: true });
      await this.pool.join();

      this.data.previousTotalSupply = await this.pool.totalSupply();
      this.data.previousBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
      this.data.previousBTPPrice = await this.pool.BTPPrice({ sERC20: true });

      await this.pool.join({ reward: true });

      this.data.latestTotalSupply = await this.pool.totalSupply();
      this.data.latestBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
      this.data.latestBTPPrice = await this.pool.BTPPrice({ sERC20: true });
    });

    it("it mints no BPT", async () => {
      expect(await this.pool.totalSupply()).to.equal(this.data.previousTotalSupply);
    });

    it("it updates the pool's balances", async () => {
      expect(this.data.latestBalances[0]).to.equal(
        this.pool.sERC20IsToken0
          ? this.data.previousBalances[0].add(this.params.pool.pooled.sERC20)
          : this.data.previousBalances[0].add(this.params.pool.pooled.ETH)
      );
      expect(this.data.latestBalances[1]).to.equal(
        this.pool.sERC20IsToken0
          ? this.data.previousBalances[1].add(this.params.pool.pooled.ETH)
          : this.data.previousBalances[1].add(this.params.pool.pooled.sERC20)
      );
    });

    it("it updates BPT price", async () => {
      expect(this.data.latestBTPPrice).to.be.gt(this.data.previousBTPPrice);
    });
  });
});
