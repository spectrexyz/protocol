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
    before(async () => {
      await setup(this, { broker: true });
      await this.broker.register();
      this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
    });

    it("# it registers sale", async () => {
      expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.PENDING);
      expect(this.data.sale.pool).to.equal(this.signers.others[1].address);
      expect(this.data.sale.multiplier).to.equal(this.params.broker.multiplier);
      expect(this.data.sale.flash).to.equal(true);
    });
  });
});
