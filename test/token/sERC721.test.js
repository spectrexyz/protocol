const { expect } = require("chai");
const { initialize, setup } = require("../helpers");

describe("sERC721", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    before(async () => {
      await setup.sERC721(this);
    });

    it("it sets up sERC721's name", async () => {
      expect(await this.sERC721.name()).to.equal(this.params.sERC721.name);
    });

    it("it sets up sERC721's symbol", async () => {
      expect(await this.sERC721.symbol()).to.equal(this.params.sERC721.symbol);
    });

    it("it sets up sERC721's permissions", async () => {
      expect(await this.sERC721.hasRole(this.constants.sERC721.DEFAULT_ADMIN_ROLE, this.signers.sERC721.admin.address)).to.equal(true);
    });
  });

  describe("# mint", () => {
    describe("» caller has MINT_ROLE", () => {
      describe("» and sERC721 is not paused", () => {
        before(async () => {
          await setup.sERC721(this);
          await this.sERC721.mint({ approve: false });
        });

        it("it mints token towards recipient", async () => {
          expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.sERC721.owners[0].address);
        });

        it("it emits a Transfer event", async () => {
          await expect(this.data.tx)
            .to.emit(this.sERC721.contract, "Transfer")
            .withArgs(ethers.constants.AddressZero, this.signers.sERC721.owners[0].address, this.data.tokenId);
        });
      });

      describe("» but sERC721 is paused", () => {
        before(async () => {
          await setup.sERC721(this);
          await this.sERC721.pause();
        });

        it("it reverts", async () => {
          await expect(this.sERC721.mint()).to.be.revertedWith("Pausable: paused");
        });
      });
    });

    describe("» caller does not have MINT_ROLE", () => {
      before(async () => {
        await setup.sERC721(this);
      });

      it("it reverts", async () => {
        await expect(this.sERC721.mint({ from: this.signers.others[0] })).to.be.revertedWith("sERC721: must have MINT_ROLE to mint");
      });
    });
  });

  describe("# pause", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and sERC721 is not already paused", () => {
        before(async () => {
          await setup.sERC721(this);
          await this.sERC721.pause();
        });

        it("it pauses sERC721", async () => {
          expect(await this.sERC721.paused()).to.equal(true);
        });
      });

      describe("» but sERC721 is already paused", () => {
        before(async () => {
          await setup.sERC721(this);
          await this.sERC721.pause();
        });

        it("it reverts", async () => {
          await expect(this.sERC721.pause()).to.be.revertedWith("Pausable: paused");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.sERC721(this);
      });

      it("it reverts", async () => {
        await expect(this.sERC721.pause({ from: this.signers.others[0] })).to.be.revertedWith("sERC721: must have DEFAULT_ADMIN_ROLE to pause");
      });
    });
  });

  describe("# unpause", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and sERC721 is paused", () => {
        before(async () => {
          await setup.sERC721(this);
          await this.sERC721.pause();
          await this.sERC721.unpause();
        });

        it("it unpauses sERC721", async () => {
          expect(await this.sERC721.paused()).to.equal(false);
        });
      });

      describe("» but sERC721 is not paused", () => {
        before(async () => {
          await setup.sERC721(this);
        });

        it("it reverts", async () => {
          await expect(this.sERC721.unpause()).to.be.revertedWith("Pausable: not paused");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.sERC721(this);
        await this.sERC721.pause();
      });

      it("it reverts", async () => {
        await expect(this.sERC721.unpause({ from: this.signers.others[0] })).to.be.revertedWith("sERC721: must have DEFAULT_ADMIN_ROLE to unpause");
      });
    });
  });

  describe("# tokenURI", () => {
    before(async () => {
      await setup.sERC721(this);
      await this.sERC721.mint({ approve: false });
    });

    it("it returns token's URI", async () => {
      expect(await this.sERC721.tokenURI(this.data.tokenId)).to.equal(this.params.sERC721.tokenURI);
    });
  });

  describe("# supportsInterface", () => {
    before(async () => {
      await setup.sERC721(this);
    });

    it("it supports ERC165 interface", async () => {
      expect(await this.sERC721.supportsInterface(0x01ffc9a7)).to.equal(true);
    });

    it("it supports AccessControlEnumerable interface", async () => {
      expect(await this.sERC721.supportsInterface(0x5a05180f)).to.equal(true);
    });

    it("it supports ERC721 interface", async () => {
      expect(await this.sERC721.supportsInterface(0x80ac58cd)).to.equal(true);
    });

    it("it supports ERC721Metadata interface", async () => {
      expect(await this.sERC721.supportsInterface(0x5b5e139f)).to.equal(true);
    });

    it("it supports ERC721Enumerable interface", async () => {
      expect(await this.sERC721.supportsInterface(0x780e9d63)).to.equal(true);
    });
  });
});
