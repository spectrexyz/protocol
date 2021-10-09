const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { Splitter } = require("../helpers/models");

describe("Splitter", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    describe("» bank is not the zero address", () => {
      describe("» and fee is inferior to 100%", () => {
        before(async () => {
          await setup.splitter(this);
        });

        it("it sets up splitter's bank", async () => {
          expect(await this.splitter.bank()).to.equal(this.signers.splitter.bank.address);
        });

        it("it sets up splitter's fee", async () => {
          expect(await this.splitter.fee()).to.equal(this.params.splitter.fee);
        });

        it("it sets up splitter's permissions", async () => {
          expect(await this.splitter.hasRole(this.constants.splitter.DEFAULT_ADMIN_ROLE, this.signers.splitter.admin.address)).to.equal(true);
          expect(await this.splitter.hasRole(this.constants.splitter.REGISTER_ROLE, this.signers.splitter.registrar.address)).to.equal(true);
        });
      });

      describe("» but fee is superior or equal to 100%", () => {
        it("it reverts", async () => {
          await expect(
            Splitter.deploy(this, {
              fee: this.constants.splitter.HUNDRED.add(this.constants.ONE),
            })
          ).to.be.revertedWith("Splitter: fee must be inferior to 100%");
        });
      });
    });

    describe("» bank is the zero address", () => {
      it("it reverts", async () => {
        await expect(
          Splitter.deploy(this, {
            bank: { address: ethers.constants.AddressZero },
          })
        ).to.be.revertedWith("Splitter: bank cannot be the zero address");
      });
    });
  });

  describe("# register", () => {
    describe("» sender has REGISTER_ROLE", () => {
      describe("» and beneficiaries and shares arrays have the same length", () => {
        describe("» and no beneficiary is the zero address", () => {
          describe("» and no share is worth zero", () => {
            describe("» and shares add up to less than 100% [with fee]", () => {
              before(async () => {
                await setup.splitter(this);
                await this.splitter.register();
                this.data.split = await this.splitter.stateOf(this.sERC20.address);
                this.data.total = this.params.splitter.shares[0]
                  .add(this.params.splitter.shares[1])
                  .add(this.params.splitter.shares[2])
                  .add(this.params.splitter.fee);
                this.data.normalizedShares = this.splitter.normalizedShares();
              });

              it("it registers split", async () => {
                expect(this.data.split.received).to.equal(0);
                expect(this.data.split.totalWithdrawn).to.equal(0);

                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(
                  this.data.normalizedShares[0]
                );
                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(
                  this.data.normalizedShares[1]
                );
                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.beneficiaries[2].address)).to.equal(
                  this.data.normalizedShares[2]
                );
                expect(await this.splitter.shareOf(this.sERC20.address, this.signers.splitter.bank.address)).to.equal(this.data.normalizedShares[3]);
              });

              it("it emits a Register event", async () => {
                await expect(this.data.tx)
                  .to.emit(this.splitter.contract, "Register")
                  .withArgs(
                    this.sERC20.address,
                    this.signers.splitter.beneficiaries.map((beneficiary) => beneficiary.address),
                    this.params.splitter.shares,
                    this.params.issuer.fee,
                    this.params.splitter.shares[0].add(this.params.splitter.shares[1]).add(this.params.splitter.shares[2]).add(this.params.splitter.fee)
                  );
              });
            });

            describe("» but shares add up to 100% or more [with fee]", () => {
              before(async () => {
                await setup.splitter(this);
              });

              it("it reverts", async () => {
                await expect(
                  this.splitter.register({
                    shares: [ethers.utils.parseEther("20"), ethers.utils.parseEther("80"), ethers.utils.parseEther("1")],
                  })
                ).to.be.revertedWith("Splitter: total allocation must be inferior to 100%");
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
          this.data.normalizedShares = this.splitter.normalizedShares();
        });

        it("it updates split state", async () => {
          this.data.amount1 = ethers.BigNumber.from("1000");
          await this.sERC20.transfer({ amount: this.data.amount1 });
          const split1 = await this.splitter.stateOf(this.sERC20.address);
          expect(split1.received).to.equal(this.data.amount1);
          expect(split1.totalWithdrawn).to.equal(0);

          await this.splitter.withdraw({ from: this.signers.splitter.beneficiaries[0] });
          this.data.withdrawn1 = this.data.normalizedShares[0].mul(this.data.amount1).div(this.constants.splitter.HUNDRED);
          const split2 = await this.splitter.stateOf(this.contracts.sERC20.address);

          expect(split2.received).to.equal(this.data.amount1);
          expect(split2.totalWithdrawn).to.equal(this.data.withdrawn1);
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn1);

          this.data.amount2 = ethers.BigNumber.from("5000");
          await this.sERC20.transfer({ amount: this.data.amount2 });

          const split3 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split3.received).to.equal(this.data.amount1.add(this.data.amount2));
          expect(split3.totalWithdrawn).to.equal(this.data.withdrawn1);

          await this.splitter.withdraw({
            from: this.signers.splitter.beneficiaries[1],
          });
          this.data.withdrawn2 = this.data.normalizedShares[1].mul(this.data.amount1.add(this.data.amount2)).div(this.constants.splitter.HUNDRED);

          const split4 = await this.splitter.stateOf(this.contracts.sERC20.address);
          expect(split4.received).to.equal(this.data.amount1.add(this.data.amount2));
          expect(split4.totalWithdrawn).to.equal(this.data.withdrawn1.add(this.data.withdrawn2));
          expect(await this.splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.splitter.beneficiaries[1].address)).to.equal(this.data.withdrawn2);
        });

        it("it transfers sERC20s", async () => {
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn1);
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[1].address)).to.equal(this.data.withdrawn2);
          expect(await this.contracts.sERC20.balanceOf(this.signers.splitter.beneficiaries[2].address)).to.equal(0);
        });

        it("it emits a Withdraw event", async () => {
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.sERC20.address, this.signers.splitter.beneficiaries[1].address, this.data.withdrawn2);
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
          this.data.amount1 = ethers.BigNumber.from("1000");
          this.data.amount2 = ethers.BigNumber.from("2000");

          await setup.splitter(this);
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: this.data.amount1 });
          this.data.sERC201 = this.contracts.sERC20;

          await this.sERC721.mint();
          await this.vault.fractionalize();
          await this.splitter.register();
          await this.sERC20.mint();
          await this.sERC20.transfer({ amount: this.data.amount2 });
          this.data.sERC202 = this.contracts.sERC20;

          this.data.normalizedShares = this.splitter.normalizedShares();
          this.data.withdrawn1 = this.data.normalizedShares[0].mul(this.data.amount1).div(this.constants.splitter.HUNDRED);
          this.data.withdrawn2 = this.data.normalizedShares[0].mul(this.data.amount2).div(this.constants.splitter.HUNDRED);

          await this.splitter.withdrawBatch();
        });

        it("it updates split state", async () => {
          const split1 = await this.splitter.stateOf(this.data.sERC201.address);
          const split2 = await this.splitter.stateOf(this.data.sERC202.address);

          expect(split1.received).to.equal(this.data.amount1);
          expect(split1.totalWithdrawn).to.equal(this.data.withdrawn1);

          expect(split2.received).to.equal(this.data.amount2);
          expect(split2.totalWithdrawn).to.equal(this.data.withdrawn2);

          expect(await this.splitter.withdrawnBy(this.data.sERC201.address, this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn1);
          expect(await this.splitter.withdrawnBy(this.data.sERC202.address, this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn2);
        });

        it("it transfers sERC20s", async () => {
          expect(await this.data.sERC201.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn1);
          expect(await this.data.sERC202.balanceOf(this.signers.splitter.beneficiaries[0].address)).to.equal(this.data.withdrawn2);
        });

        it("it emits Withdraw events", async () => {
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.data.sERC201.address, this.signers.splitter.beneficiaries[0].address, this.data.withdrawn1);
          await expect(this.data.tx)
            .to.emit(this.splitter.contract, "Withdraw")
            .withArgs(this.data.sERC202.address, this.signers.splitter.beneficiaries[0].address, this.data.withdrawn2);
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

  describe("# setBank", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and bank is not the zero address", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.setBank({ bank: this.signers.others[0] });
        });

        it("it sets bank", async () => {
          expect(await this.splitter.bank()).to.equal(this.signers.others[0].address);
        });

        it("it emits a SetBank event", async () => {
          await expect(this.data.tx).to.emit(this.splitter.contract, "SetBank").withArgs(this.signers.others[0].address);
        });
      });

      describe("» but bank is the zero address", () => {
        before(async () => {
          await setup.splitter(this);
        });

        it("it reverts", async () => {
          await expect(
            this.splitter.setBank({
              bank: { address: ethers.constants.AddressZero },
            })
          ).to.be.revertedWith("Splitter: bank cannot be the zero address");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.splitter(this);
      });

      it("it reverts", async () => {
        await expect(
          this.splitter.setBank({
            from: this.signers.others[0],
          })
        ).to.be.revertedWith("Splitter: must have DEFAULT_ADMIN_ROLE to set bank");
      });
    });
  });

  describe("# setFee", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and fee is inferior to 100%", () => {
        before(async () => {
          await setup.splitter(this);
          await this.splitter.setFee({ fee: "100" });
        });

        it("it sets fee", async () => {
          expect(await this.splitter.fee()).to.equal(100);
        });

        it("it emits a SetFee event", async () => {
          await expect(this.data.tx).to.emit(this.splitter.contract, "SetFee").withArgs(100);
        });
      });

      describe("» but fee is superior or equal to 100%", () => {
        before(async () => {
          await setup.splitter(this);
        });

        it("it reverts", async () => {
          await expect(
            this.splitter.setFee({
              fee: this.constants.splitter.HUNDRED.add(this.constants.ONE),
            })
          ).to.be.revertedWith("Splitter: fee must be inferior to 100%");
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.splitter(this);
      });

      it("it reverts", async () => {
        await expect(
          this.splitter.setFee({
            from: this.signers.others[0],
          })
        ).to.be.revertedWith("Splitter: must have DEFAULT_ADMIN_ROLE to set fee");
      });
    });
  });
});
