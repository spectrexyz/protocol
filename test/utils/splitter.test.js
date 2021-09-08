const { expect } = require("chai");
const { initialize, setup } = require("../helpers");

describe("Splitter", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    before(async () => {
      await setup.splitter(this);
    });

    it("# it sets up permissions", async () => {
      expect(await this.splitter.hasRole(this.constants.splitter.DEFAULT_ADMIN_ROLE, this.signers.splitter.admin.address)).to.equal(true);
      expect(await this.splitter.hasRole(this.constants.splitter.REGISTER_ROLE, this.signers.splitter.registrar.address)).to.equal(true);
    });
  });

  describe("# register", () => {
    describe("» sender has REGISTER_ROLE", () => {
      describe("» and beneficiaries and shares arrays have the same length", () => {
        describe("» and no beneficiary is the zero address", () => {
          describe("» and no share is worth zero", () => {
            describe("» and shares add up to 100%", () => {
              before(async () => {
                await setup.splitter(this);
                await this.splitter.register();
                this.data.split = await this.splitter.stateOf(this.sERC20.address);
              });

              it("it registers split", async () => {
                expect(this.data.split.received).to.equal(0);
                expect(this.data.split.totalWithdrawn).to.equal(0);

                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(
                  this.params.splitter.shares[0]
                );
                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(
                  this.params.splitter.shares[1]
                );
                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[2].address)).to.equal(
                  this.params.splitter.shares[2]
                );
              });

              it("it emits a Register event", async () => {
                await expect(this.data.tx)
                  .to.emit(this.splitter.contract, "Register")
                  .withArgs(
                    this.sERC20.address,
                    this.signers.splitter.beneficiaries.map((beneficiary) => beneficiary.address),
                    this.params.splitter.shares
                  );
              });
            });

            describe("» but shares do not add up 100%", () => {
              before(async () => {
                await setup.splitter(this);
              });

              it("it reverts", async () => {
                await expect(
                  this.splitter.register({
                    shares: [this.params.splitter.shares[0], this.params.splitter.shares[1], "10"],
                  })
                ).to.be.revertedWith("Splitter: shares must add up to 100%");
              });
            });
          });

          describe("» but one share is worth zero", () => {
            before(async () => {
              await setup.splitter(this);
            });

            it("it reverts", async () => {
              await expect(
                this.splitter.register({
                  shares: [this.params.splitter.shares[0], this.params.splitter.shares[1], 0],
                })
              ).to.be.revertedWith("Splitter: share cannot be worth zero");
            });
          });
        });

        describe("» but one beneficiary is the zero address", () => {
          before(async () => {
            await setup.splitter(this);
          });

          it("it reverts", async () => {
            await expect(
              this.splitter.register({
                beneficiaries: [this.signers.splitter.beneficiaries[0], this.signers.splitter.beneficiaries[1], { address: ethers.constants.AddressZero }],
              })
            ).to.be.revertedWith("Splitter: beneficiary cannot be the zero address");
          });
        });
      });

      describe("» but beneficiaries and shares arrays do not have the same length", () => {
        before(async () => {
          await setup.splitter(this);
        });

        it("it reverts", async () => {
          await expect(
            this.splitter.register({
              shares: [this.params.splitter.shares[0], this.params.splitter.shares[1]],
            })
          ).to.be.revertedWith("Splitter: beneficiaries and shares length mismatch");
        });
      });
    });

    describe("» sender does not have REGISTER_ROLE", () => {
      before(async () => {
        await setup.splitter(this);
      });

      it("it reverts", async () => {
        await expect(this.splitter.register({ from: this.signers.others[0] })).to.be.revertedWith("Splitter: must have REGISTER_ROLE to register");
      });
    });
  });

  describe("# withdraw", () => {
    describe("» sERC20 is registered", () => {
      describe("» and there is something to withdraw", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.register();
          await this.sERC20.mint();
        });

        it("it updates split state", async () => {
          await this.sERC20.transfer({ amount: "1000" });
          const split1 = await this.splitter.stateOf(this.sERC20.address);
          expect(split1.received).to.equal(1000);
          expect(split1.totalWithdrawn).to.equal(0);

          await this.splitter.withdraw();
          const split2 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split2.received).to.equal(1000);
          expect(split2.totalWithdrawn).to.equal(300);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(300);

          await this.sERC20.transfer({ amount: "5000" });
          const split3 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split3.received).to.equal(6000);
          expect(split3.totalWithdrawn).to.equal(300);

          await this.splitter.withdraw({
            from: this.signers.splitter.beneficiaries[1],
          });
          const split4 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split4.received).to.equal(6000);
          expect(split4.totalWithdrawn).to.equal(900);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(600);

          await this.sERC20.transfer({ amount: "6000" });
          const split5 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split5.received).to.equal(12000);
          expect(split5.totalWithdrawn).to.equal(900);

          await this.splitter.withdraw({
            from: this.signers.splitter.beneficiaries[0],
          });
          await this.splitter.withdraw({
            from: this.signers.splitter.beneficiaries[1],
          });
          await this.splitter.withdraw({
            from: this.signers.splitter.beneficiaries[2],
          });
          const split6 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split6.received).to.equal(12000);
          expect(split6.totalWithdrawn).to.equal(12000);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(3600);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(1200);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[2].address)).to.equal(7200);
        });

        it("it transfers sERC20s", async () => {
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(3600);
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[1].address)).to.equal(1200);
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[2].address)).to.equal(7200);
        });

        it("it emits a Withdraw event", async () => {
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.sERC20.address, this.signers.splitter.beneficiaries[2].address, 7200);
        });
      });

      describe("» but there is nothing to withdraw", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: "1000" });
          await this.splitter.withdraw();
        });

        it("it reverts", async () => {
          await expect(this.splitter.withdraw()).to.be.revertedWith("Splitter: nothing to withdraw");
        });
      });
    });

    describe("» sERC20 is not registered", () => {
      before(async () => {
        await setup.splitter(this);
      });

      it("it reverts", async () => {
        await expect(this.splitter.withdraw()).to.be.revertedWith("Splitter: nothing to withdraw");
      });
    });
  });

  describe("# withdrawBatch", () => {
    describe("» all sERC20s are registered", () => {
      describe("» and there is something to withdraw for all sERC20s", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: "1000" });
          this.data.sERC201 = this.contracts.sERC20;

          await this.sERC721.mint();
          await this.vault.fractionalize();
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: "2000" });
          this.data.sERC202 = this.contracts.sERC20;

          await this.splitter.withdrawBatch();
        });

        it("it updates split state", async () => {
          const split1 = await this.splitter.stateOf(this.data.sERC201.address);
          const split2 = await this.splitter.stateOf(this.data.sERC202.address);

          expect(split1.received).to.equal(1000);
          expect(split1.totalWithdrawn).to.equal(300);

          expect(split2.received).to.equal(2000);
          expect(split2.totalWithdrawn).to.equal(600);

          expect(await this.splitter.withdrawnBy(this.data.sERC201.address, this.signers.splitter.beneficiaries[0].address)).to.equal(300);
          expect(await this.splitter.withdrawnBy(this.data.sERC202.address, this.signers.splitter.beneficiaries[0].address)).to.equal(600);
        });

        it("it transfers sERC20s", async () => {
          expect(await this.data.sERC201.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(300);
          expect(await this.data.sERC202.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(600);
        });

        it("it emits Withdraw events", async () => {
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.data.sERC201.address, this.signers.splitter.beneficiaries[0].address, 300);
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.data.sERC202.address, this.signers.splitter.beneficiaries[0].address, 600);
        });
      });

      describe("» but there is nothing to withdraw for one sERC20", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: "1000" });
          this.data.sERC201 = this.contracts.sERC20;

          await this.sERC721.mint();
          await this.vault.fractionalize();
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: "2000" });
          this.data.sERC202 = this.contracts.sERC20;

          await this.splitter.withdraw();
        });

        it("it reverts", async () => {
          await expect(this.splitter.withdrawBatch()).to.be.revertedWith("Splitter: nothing to withdraw");
        });
      });
    });

    describe("» one sERC20 is not registered", () => {
      before(async () => {
        await setup.splitter(this);
        await this.splitter.register();
        await this.sERC20.mint();
        await this.sERC20.transfer({ amount: "1000" });
        this.data.sERC201 = this.contracts.sERC20;

        await this.sERC721.mint();
        await this.vault.fractionalize();
        await this.sERC20.mint();
        await this.sERC20.transfer({ amount: "2000" });
        this.data.sERC202 = this.contracts.sERC20;
      });

      it("it reverts", async () => {
        await expect(this.splitter.withdrawBatch()).to.be.revertedWith("Splitter: nothing to withdraw");
      });
    });
  });
});