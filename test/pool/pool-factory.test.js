const { expect } = require("chai");
const { initialize, setup } = require("../helpers");

describe("FractionalizationBootstrappingPoolFactory", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    before(async () => {
      await setup.poolFactory(this);
    });

    it("it sets up the factory's vault", async () => {
      expect(await this.poolFactory.getVault()).to.equal(this.contracts.bVault.address);
    });

    it("it sets up the factory's admin", async () => {
      expect(await this.poolFactory.admin()).to.equal(this.signers.poolFactory.admin.address);
    });
  });

  describe("# setIssuer", () => {
    describe("» caller is factory's admin", () => {
      before(async () => {
        await setup.poolFactory(this);
        await this.poolFactory.setIssuer();
      });

      it("it sets factory's issuer", async () => {
        await expect(await this.poolFactory.issuer()).to.equal(this.signers.pool.issuer.address);
      });
    });

    describe("» caller is not factory's admin", () => {
      before(async () => {
        await setup.poolFactory(this);
      });

      it("it reverts", async () => {
        await expect(this.poolFactory.setIssuer({ from: this.signers.others[0] })).to.be.revertedWith("FBPFactory: must be admin to set issuer");
      });
    });
  });

  describe("# create", () => {
    before(async () => {
      await setup.poolFactory(this);
      await this.poolFactory.setIssuer();
      await this.poolFactory.create(this);
    });

    it("it emits a CreatePool event", async () => {
      await expect(this.data.tx).to.emit(this.poolFactory.contract, "CreatePool").withArgs(this.pool.address);
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

    it("it sets up the pool's issuer", async () => {
      expect(await this.pool.issuer()).to.equal(this.signers.pool.issuer.address);
    });

    it("it sets up the pool's owner to the zero address", async () => {
      expect(await this.pool.getOwner()).to.equal(ethers.constants.AddressZero);
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

    it("it registers the pool's tokens asset managers as zero addresses", async () => {
      expect((await this.contracts.bVault.getPoolTokenInfo(this.data.poolId, this.contracts.WETH.address)).assetManager).to.equal(ethers.constants.AddressZero);
      expect((await this.contracts.bVault.getPoolTokenInfo(this.data.poolId, this.contracts.sERC20.address)).assetManager).to.equal(
        ethers.constants.AddressZero
      );
    });
  });
});
