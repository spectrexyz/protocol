const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { Channeler } = require("../helpers/models");

describe.only("Channeler", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    describe("» vault is not the zero address", () => {
      describe("» and issuer is not the zero address", () => {
        describe("» and broker is not the zero address", () => {
          describe("» and splitter is not the zero address", () => {
            before(async () => {
              await setup.channeler(this);
            });

            it("it sets up channeler's vault", async () => {
              expect(await this.channeler.vault()).to.equal(this.vault.address);
            });

            it("it sets up channeler's issuer", async () => {
              expect(await this.channeler.issuer()).to.equal(this.issuer.address);
            });

            it("it sets up channeler's broker", async () => {
              expect(await this.channeler.broker()).to.equal(this.broker.address);
            });

            it("it sets up channeler's splitter", async () => {
              expect(await this.channeler.splitter()).to.equal(this.splitter.address);
            });

            it("it sets up channeler's permissions", async () => {
              expect(await this.channeler.hasRole(this.constants.channeler.DEFAULT_ADMIN_ROLE, this.signers.channeler.admin.address)).to.equal(true);
            });
          });

          describe("» but splitter is the zero address", () => {
            it("it reverts", async () => {
              await expect(Channeler.deploy(this, { splitter: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
                "Channeler: splitter cannot be the zero address"
              );
            });
          });
        });

        describe("» but broker is the zero address", () => {
          it("it reverts", async () => {
            await expect(Channeler.deploy(this, { broker: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              "Channeler: broker cannot be the zero address"
            );
          });
        });
      });

      describe("» but issuer is the zero address", () => {
        it("it reverts", async () => {
          await expect(Channeler.deploy(this, { issuer: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
            "Channeler: issuer cannot be the zero address"
          );
        });
      });
    });

    describe("» but vault is the zero address", () => {
      it("it reverts", async () => {
        await expect(Channeler.deploy(this, { vault: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
          "Channeler: vault cannot be the zero address"
        );
      });
    });
  });

  describe("# fractionalize", () => {
    describe("» channeler is not paused", () => {
      before(async () => {
        await setup.channeler(this);
        await this.channeler.fractionalize();
        this.data.issuance = await this.issuer.issuanceOf(this.sERC20.address);
        this.data.sale = await this.broker.saleOf(this.sERC20.address);
        this.data.normalizedShares = this.splitter.normalizedShares();
      });

      it("it fractionalizes ERC721", async () => {
        await expect(this.data.tx)
          .to.emit(this.vault.contract, "Fractionalize")
          .withArgs(this.sERC721.address, this.data.tokenId, this.data.id, this.sERC20.address, this.broker.address);
      });

      it("it registers sERC20 into broker", async () => {
        expect(this.data.sale.guardian).to.equal(this.signers.channeler.guardian.address);
        expect(this.data.sale.reserve).to.equal(this.params.broker.reserve);
        expect(this.data.sale.multiplier).to.equal(this.params.broker.multiplier);
        expect(this.data.sale.opening).to.equal(
          ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(this.params.broker.timelock)
        );
        expect(this.data.sale.flash).to.equal(false);
        expect(this.data.sale.escape).to.equal(true);
      });

      it("it registers sERC20 into issuer", async () => {
        expect(this.data.issuance.guardian).to.equal(this.signers.channeler.guardian.address);
        expect(this.data.issuance.reserve).to.equal(this.params.issuer.reserve);
        expect(this.data.issuance.allocation).to.equal(
          this.params.splitter.shares[0].add(this.params.splitter.shares[1]).add(this.params.splitter.shares[2]).add(this.params.splitter.fee)
        );
        expect(this.data.issuance.fee).to.equal(this.params.issuer.fee);
        expect(this.data.issuance.flash).to.equal(false);
      });

      it("it registers sERC20 into splitter", async () => {
        expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.normalizedShares[0]);
        expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(this.data.normalizedShares[1]);
        expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[2].address)).to.equal(this.data.normalizedShares[2]);
        expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.bank.address)).to.equal(this.data.normalizedShares[3]);
      });

      it("it sets up sERC20", async () => {
        expect(await this.sERC20.name()).to.equal(this.params.sERC20.name);
        expect(await this.sERC20.symbol()).to.equal(this.params.sERC20.symbol);
        expect(await this.sERC20.cap()).to.equal(this.params.sERC20.cap);
      });

      it("it grants MINT_ROLE to issuer over sERC20", async () => {
        expect(await this.sERC20.hasRole(this.constants.sERC20.MINT_ROLE, this.issuer.address)).to.equal(true);
      });
    });

    describe("» channeler is paused", () => {
      before(async () => {
        await setup.channeler(this);
        await this.channeler.pause();
      });

      it("it reverts", async () => {
        await expect(this.channeler.fractionalize()).to.be.revertedWith("Pausable: paused'");
      });
    });
  });

  describe("# pause", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and channeler is not already paused", () => {
        before(async () => {
          await setup.channeler(this);
          await this.channeler.pause();
        });

        it("it pauses channeler", async () => {
          expect(await this.channeler.paused()).to.equal(true);
        });
      });

      describe("» but channeler is already paused", () => {
        before(async () => {
          await setup.channeler(this);
          await this.channeler.pause();
        });

        it("it reverts", async () => {
          await expect(this.channeler.pause()).to.be.revertedWith("Pausable: paused");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.channeler(this);
      });

      it("it reverts", async () => {
        await expect(this.channeler.pause({ from: this.signers.others[0] })).to.be.revertedWith("Channeler: must have DEFAULT_ADMIN_ROLE to pause channeler");
      });
    });
  });

  describe("# unpause", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and channeler is paused", () => {
        before(async () => {
          await setup.channeler(this);
          await this.channeler.pause();
          await this.channeler.unpause();
        });

        it("it unpauses channeler", async () => {
          expect(await this.channeler.paused()).to.equal(false);
        });
      });

      describe("» but channeler is not paused", () => {
        before(async () => {
          await setup.channeler(this);
        });

        it("it reverts", async () => {
          await expect(this.channeler.unpause()).to.be.revertedWith("Pausable: not paused");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.channeler(this);
        await this.channeler.pause();
      });

      it("it reverts", async () => {
        await expect(this.channeler.unpause({ from: this.signers.others[0] })).to.be.revertedWith(
          "Channeler: must have DEFAULT_ADMIN_ROLE to unpause channeler"
        );
      });
    });
  });
});
