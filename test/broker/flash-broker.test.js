const { expect } = require("chai");
const { initialize, setup } = require("../helpers");

describe("FlashBroker", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    before(async () => {
      await setup(this, { broker: true });
    });

    it("# it initializes FlashBroker", async () => {
      expect(await this.broker.sERC1155()).to.equal(this.sERC1155.contract.address);
    });
  });

  describe("# register", () => {
    describe("» sERC20 is not registered yet", () => {
      describe("» and sERC20 is pegged to a locked NFT", () => {
        describe("» and timelock period is valid", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
          });

          it("# it registers sale", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.PENDING);
            expect(this.data.sale.minimum).to.equal(this.params.broker.minimum);
            expect(this.data.sale.pool).to.equal(this.signers.others[1].address);
            expect(this.data.sale.multiplier).to.equal(this.params.broker.multiplier);
            expect(this.data.sale.opening).to.equal(
              ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(this.params.broker.timelock)
            );
            expect(this.data.sale.price).to.equal(0);
            expect(this.data.sale.nbOfProposals).to.equal(0);
            expect(this.data.sale.flash).to.equal(true);
          });
        });

        describe("» but timelock period is invalid", () => {
          before(async () => {
            await setup(this, { broker: true });
          });

          it("it reverts", async () => {
            await expect(this.broker.register({ timelock: "100" })).to.be.revertedWith("FlashBroker: invalid timelock");
          });
        });
      });

      describe("» but sERC20 is not pegged to a locked NFT", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.sERC1155.unlock();
        });

        it("it reverts", async () => {
          await expect(this.broker.register()).to.be.revertedWith("FlashBroker: invalid spectre state");
        });
      });
    });

    describe("» sERC20 is already registered", () => {
      before(async () => {
        await setup(this, { broker: true });
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.register()).to.be.revertedWith("FlashBroker: sERC20 already registered");
      });
    });
  });
});
