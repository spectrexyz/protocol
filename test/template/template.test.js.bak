const { expect } = require("chai");
const { initialize, setup } = require("../helpers");

describe.only("Template", () => {
  before(async () => {
    await initialize(this);
  });

  describe("⇛ constructor", () => {
    describe("» vault is not the zero address", () => {
      describe("» and bank is not the zero address", () => {
        describe("» and splitter is not the zero address", () => {
          describe("» and protocol fee is inferior to 100%", () => {
            before(async () => {
              await setup(this, { template: true });
            });

            it("it initializes contract", async () => {
              expect(await this.template.sERC1155()).to.equal(
                this.contracts.sERC1155.address
              );
            });
          });
        });
      });
    });
  });
});
