const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { advanceTime } = require("../helpers/time");
const {
  itRegistersLikeExpected,
  itBuysOutLikeExpected,
  itCreatesProposalLikeExpected,
  itRejectsProposalLikeExpected,
  itWithdrawsProposalLikeExpected,
  itEnablesFlashBuyoutLikeExpected,
  itEnablesEscapeLikeExpected,
  itDisablesEscapeLikeExpected,
} = require("./broker.behavior");
const { Broker } = require("../helpers/models");

describe("Broker", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    describe("» vault is not the zero address", () => {
      describe("» and issuer is not the zero address", () => {
        describe("» and bank is not the zero address", () => {
          describe("» and protocol fee is inferior to 100%", () => {
            before(async () => {
              await setup.broker(this);
            });

            it("it sets up the broker's vault", async () => {
              expect(await this.broker.vault()).to.equal(this.vault.address);
            });

            it("it sets up the broker's issuer", async () => {
              expect(await this.broker.issuer()).to.equal(this.contracts.issuerMock.address);
            });

            it("it sets up the broker's bank", async () => {
              expect(await this.broker.bank()).to.equal(this.signers.broker.bank.address);
            });

            it("it sets up the broker's protocolFee", async () => {
              expect(await this.broker.protocolFee()).to.equal(this.params.broker.protocolFee);
            });

            it("it sets up the broker's permissions", async () => {
              expect(await this.broker.hasRole(this.constants.broker.DEFAULT_ADMIN_ROLE, this.signers.broker.admin.address)).to.equal(true);
            });

            it("it emits a SetBank event", async () => {
              await expect(this.broker.contract.deployTransaction).to.emit(this.broker.contract, "SetBank").withArgs(this.signers.broker.bank.address);
            });

            it("it emits a SetProtocolFee event", async () => {
              await expect(this.broker.contract.deployTransaction).to.emit(this.broker.contract, "SetProtocolFee").withArgs(this.params.broker.protocolFee);
            });
          });

          describe("» but protocol fee is superior or equal to 100%", () => {
            before(async () => {
              await setup.broker(this);
            });

            it("it reverts", async () => {
              await expect(Broker.deploy(this, { protocolFee: this.constants.broker.HUNDRED })).to.be.revertedWith(
                "Broker: protocol fee must be inferior to 100%"
              );
            });
          });
        });

        describe("» but bank is the zero address", () => {
          before(async () => {
            await setup.broker(this);
          });

          it("it reverts", async () => {
            await expect(Broker.deploy(this, { bank: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              "Broker: bank cannot be the zero address"
            );
          });
        });
      });

      describe("» but issuer is the zero address", () => {
        before(async () => {
          await setup.broker(this);
        });

        it("it reverts", async () => {
          await expect(Broker.deploy(this, { issuer: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
            "Broker: issuer cannot be the zero address"
          );
        });
      });
    });

    describe("» vault is the zero address", () => {
      before(async () => {
        await setup.broker(this);
      });

      it("it reverts", async () => {
        await expect(Broker.deploy(this, { vault: { address: ethers.constants.AddressZero } })).to.be.revertedWith("Broker: vault cannot be the zero address");
      });
    });
  });

  describe("# register", () => {
    describe("» caller has REGISTER_ROLE", () => {
      describe("» and sale is not registered yet", () => {
        describe("» and guardian is not the zero address", () => {
          describe("» and timelock period is valid", () => {
            describe("» and flash buyout is enabled", () => {
              describe("» and escape is enabled", () => {
                describe("» and cap is enabled", () => {
                  before(async () => {
                    await setup.broker(this);
                    await this.broker.register({ cap: true });
                    this.data.sale = await this.broker.saleOf(this.sERC20.address);
                    this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                      this.params.broker.timelock
                    );
                  });

                  itRegistersLikeExpected(this, { cap: true });

                  it("it emits a EnableFlashBuyout event", async () => {
                    await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout");
                  });

                  it("it emits a EnableEscape event", async () => {
                    await expect(this.data.tx).to.emit(this.broker.contract, "EnableEscape");
                  });
                });

                describe("» and cap is disabled", () => {
                  before(async () => {
                    await setup.broker(this);
                    await this.broker.register();
                    this.data.sale = await this.broker.saleOf(this.sERC20.address);
                    this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                      this.params.broker.timelock
                    );
                  });

                  itRegistersLikeExpected(this);

                  it("it emits a EnableFlashBuyout event", async () => {
                    await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout");
                  });

                  it("it emits a EnableEscape event", async () => {
                    await expect(this.data.tx).to.emit(this.broker.contract, "EnableEscape");
                  });
                });
              });

              describe("» but escape is disabled", () => {
                before(async () => {
                  await setup.broker(this);
                  await this.broker.register({ escape: false });
                  this.data.sale = await this.broker.saleOf(this.sERC20.address);
                  this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                    this.params.broker.timelock
                  );
                });

                itRegistersLikeExpected(this, { escape: false });

                it("it emits a EnableFlashBuyout event", async () => {
                  await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout");
                });

                it("it does not emit a EnableEscape event", async () => {
                  await expect(this.data.tx).to.not.emit(this.broker.contract, "EnableEscape");
                });
              });
            });

            describe("» but flash buyout is disabled", () => {
              before(async () => {
                await setup.broker(this);
                await this.broker.register({ flash: false });
                this.data.sale = await this.broker.saleOf(this.sERC20.address);
                this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                  this.params.broker.timelock
                );
              });

              itRegistersLikeExpected(this, { flash: false });

              it("it does not emit a EnableFlashBuyout event", async () => {
                await expect(this.data.tx).to.not.emit(this.broker.contract, "EnableFlashBuyout");
              });

              it("it emits a EnableEscape event", async () => {
                await expect(this.data.tx).to.emit(this.broker.contract, "EnableEscape");
              });
            });
          });

          describe("» but timelock period is invalid", () => {
            before(async () => {
              await setup.broker(this);
            });

            it("it reverts", async () => {
              await expect(this.broker.register({ timelock: "100" })).to.be.revertedWith("Broker: invalid timelock");
            });
          });
        });

        describe("» but guardian is the zero address", () => {
          before(async () => {
            await setup.broker(this);
          });

          it("it reverts", async () => {
            await expect(this.broker.register({ guardian: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              "Broker: guardian cannot be the zero address"
            );
          });
        });
      });

      describe("» but sale is already registered", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.register()).to.be.revertedWith("Broker: sale already registered");
        });
      });
    });

    describe("» caller does not have REGISTER_ROLE", () => {
      before(async () => {
        await setup.broker(this);
      });

      it("it reverts", async () => {
        await expect(this.broker.register({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must have REGISTER_ROLE to register");
      });
    });
  });

  describe("# buyout", () => {
    describe("» sale is opened", () => {
      describe("» and flash buyout is enabled", () => {
        describe("» and cap is disabled", () => {
          describe("» and buyout value is sufficient [collateral and ETH]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register();
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              await this.broker.buyout();
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
            });

            itBuysOutLikeExpected(this, { value: true, collateral: true });
          });

          describe("» and buyout value is sufficient [collateral only]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register();
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              await this.broker.buyout({ value: 0 });
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
            });

            itBuysOutLikeExpected(this, { value: false, collateral: true });
          });

          describe("» and buyout value is sufficient [ETH only]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register();
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              await this.broker.buyout();
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
            });

            itBuysOutLikeExpected(this, { value: true, collateral: false });
          });

          describe("» but buyout value is insufficient", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register();
              await advanceTime(this.params.broker.timelock);
            });

            it("it reverts", async () => {
              await expect(this.broker.buyout({ value: "1" })).to.be.revertedWith("Broker: insufficient value");
            });
          });
        });

        describe("» and cap is enabled", () => {
          describe("» and buyout value is sufficient [collateral and ETH]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ cap: true });
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              this.data.previousGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
              await this.broker.buyout({ cap: true });
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
              this.data.lastGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
            });

            itBuysOutLikeExpected(this, { value: true, collateral: true, cap: true });
          });

          describe("» and buyout value is sufficient [collateral only]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ cap: true });
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.sERC20.cap });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              this.data.previousGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
              await this.broker.buyout({ value: 0, cap: true });
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
              this.data.lastGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
            });

            itBuysOutLikeExpected(this, { value: false, collateral: true, cap: true });
          });

          describe("» and buyout value is sufficient [ETH only]", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ cap: true });
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              this.data.previousTotalSupply = await this.sERC20.totalSupply();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              this.data.previousGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
              await this.broker.buyout({ cap: true });
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.lastTotalSupply = await this.sERC20.totalSupply();
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
              this.data.lastGuardianBalance = await this.sERC20.balanceOf(this.signers.broker.guardian.address);
            });

            itBuysOutLikeExpected(this, { value: true, collateral: false, cap: true });
          });

          describe("» but buyout value is insufficient", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ cap: true });
              await advanceTime(this.params.broker.timelock);
            });

            it("it reverts", async () => {
              await expect(this.broker.buyout({ value: "1", cap: true })).to.be.revertedWith("Broker: insufficient value");
            });
          });
        });
      });

      describe("» but flash buyout is disabled", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await advanceTime(this.params.broker.timelock);
        });

        it("it reverts", async () => {
          await expect(this.broker.buyout()).to.be.revertedWith("Broker: flash buyout is disabled");
        });
      });
    });

    describe("» but sale is not opened", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.buyout()).to.be.revertedWith("Broker: invalid sale state");
      });
    });
  });

  describe("# createProposal", () => {
    describe("» sale is opened", () => {
      describe("» and flash buyout is disabled", () => {
        describe("» and buyout value is sufficient [collateral and ETH]", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          itCreatesProposalLikeExpected(this, { value: true, collateral: true });
        });

        describe("» and buyout value is sufficient [collateral only]", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal({ value: 0 });
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          itCreatesProposalLikeExpected(this, { value: false, collateral: true });
        });

        describe("» and buyout value is sufficient [ETH only]", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          itCreatesProposalLikeExpected(this, { value: true, collateral: false });
        });
      });

      describe("» but flash buyout is enabled", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await advanceTime(this.params.broker.timelock);
        });

        it("it reverts", async () => {
          await expect(this.broker.createProposal()).to.be.revertedWith("Broker: flash buyout is enabled");
        });
      });
    });

    describe("» sale is not opened", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ flash: false });
      });

      it("it reverts", async () => {
        await expect(this.broker.createProposal()).to.be.revertedWith("Broker: invalid sale state");
      });
    });
  });

  describe("# acceptProposal", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and sale is opened", () => {
        describe("» and proposal is pending", () => {
          describe("» and flash buyout is disabled", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ flash: false });
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              await this.broker.createProposal();
              this.data.previousBankBalance = await this.signers.broker.bank.getBalance();
              await this.broker.acceptProposal();
              this.data.sale = await this.broker.saleOf(this.sERC20.address);
              this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
              this.data.lastBankBalance = await this.signers.broker.bank.getBalance();
              this.data.expectedFee = this.params.broker.value.mul(this.params.broker.protocolFee).div(this.constants.broker.HUNDRED);
            });

            it("it updates proposal state", async () => {
              expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Accepted);
            });

            it("it updates sale state", async () => {
              expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.Closed);
            });

            it("it updates sale stock", async () => {
              expect(this.data.sale.stock).to.equal(this.params.broker.value.sub(this.data.expectedFee));
            });

            it("it burns locked tokens", async () => {
              expect(await this.sERC20.balanceOf(this.broker.address)).to.equal(0);
            });

            it("it transfers NFT", async () => {
              expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.buyer.address);
            });

            it("it closes sERC20 issuance", async () => {
              await expect(this.data.tx).to.emit(this.contracts.issuerMock, "Close").withArgs(this.sERC20.address);
            });

            it("it pays protocol fee", async () => {
              expect(this.data.lastBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedFee);
            });

            it("it emits a AcceptProposal event", async () => {
              await expect(this.data.tx).to.emit(this.broker.contract, "AcceptProposal").withArgs(this.sERC20.address, this.data.proposalId);
            });

            it("it emits a Buyout event", async () => {
              await expect(this.data.tx)
                .to.emit(this.broker.contract, "Buyout")
                .withArgs(this.sERC20.address, this.signers.broker.buyer.address, this.params.broker.value, this.params.broker.balance, this.data.expectedFee);
            });
          });

          describe("» but flash buyout is enabled", () => {
            before(async () => {
              await setup.broker(this);
              await this.broker.register({ flash: false });
              await advanceTime(this.params.broker.timelock);
              await this.broker.createProposal();
              await this.broker.enableFlashBuyout();
            });

            it("it reverts", async () => {
              await expect(this.broker.acceptProposal()).to.be.revertedWith("Broker: flash buyout is enabled");
            });
          });
        });

        describe("» but proposal is not pending", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            await advanceTime(this.params.broker.lifespan.add(ethers.BigNumber.from("1")));
          });

          it("it reverts", async () => {
            await expect(this.broker.acceptProposal()).to.be.revertedWith("Broker: invalid proposal state");
          });
        });
      });

      describe("» but sale is not opened", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.firstProposalId = this.data.proposalId;
          await this.broker.createProposal();
          await this.broker.acceptProposal({ proposalId: this.data.firstProposalId });
        });

        it("it reverts", async () => {
          await expect(this.broker.acceptProposal()).to.be.revertedWith("Broker: invalid sale state");
        });
      });
    });

    describe("» caller is not sale's guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ flash: false });
        await advanceTime(this.params.broker.timelock);
        await this.broker.createProposal();
      });

      it("it reverts", async () => {
        await expect(this.broker.acceptProposal({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to accept proposal");
      });
    });
  });

  describe("# rejectProposal", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and proposal is pending", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await this.broker.rejectProposal();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
        });

        itRejectsProposalLikeExpected(this);
      });

      describe("» and proposal is lapsed", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await advanceTime(this.params.broker.lifespan.add(ethers.BigNumber.from("1")));
          await this.broker.rejectProposal();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.address, this.data.proposalId);
        });

        itRejectsProposalLikeExpected(this);
      });

      describe("» but proposal is neither pending nor lapsed", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          await this.broker.acceptProposal();
        });

        it("it reverts", async () => {
          await expect(this.broker.rejectProposal()).to.be.revertedWith("Broker: invalid proposal state");
        });
      });
    });

    describe("» caller is not sale's guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ flash: false });
        await advanceTime(this.params.broker.timelock);
        await this.broker.createProposal();
      });

      it("it reverts", async () => {
        await expect(this.broker.rejectProposal({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to reject proposal");
      });
    });
  });

  describe("# withdrawProposal", () => {
    describe("» caller is proposal's buyer", () => {
      describe("» proposal is pending", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await this.broker.withdrawProposal();
          this.data.lastBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.address, 0);
        });

        itWithdrawsProposalLikeExpected(this);
      });

      describe("» proposal is lapsed", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await advanceTime(this.params.broker.lifespan.add(ethers.BigNumber.from("1")));
          await this.broker.withdrawProposal();
          this.data.lastBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.address, 0);
        });

        itWithdrawsProposalLikeExpected(this);
      });

      describe("» but proposal is neither pending not lapsed", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ flash: false });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          await this.broker.acceptProposal();
        });

        it("it reverts", async () => {
          await expect(this.broker.withdrawProposal()).to.be.revertedWith("Broker: invalid proposal state");
        });
      });
    });

    describe("» caller is not proposal's buyer", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ flash: false });
        await advanceTime(this.params.broker.timelock);
        await this.broker.createProposal();
      });

      it("it reverts", async () => {
        await expect(this.broker.withdrawProposal({ from: this.signers.others[0] })).to.be.revertedWith(
          "Broker: must be proposal's buyer to withdraw proposal"
        );
      });
    });
  });

  describe("# claim", () => {
    describe("» sale is opened", () => {
      describe("» and there is something to claim", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[1], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.buyout();
          this.data.previousClaimerETHBalance = await this.signers.others[0].getBalance();
          await this.broker.claim();
          this.data.sale = await this.broker.saleOf(this.sERC20.address);
          this.data.expectedFee = this.params.broker.value.mul(this.params.broker.protocolFee).div(this.constants.broker.HUNDRED);
          this.data.expectedValue = this.params.broker.value.sub(this.data.expectedFee).div(ethers.BigNumber.from("2"));
          this.data.lastClaimerETHBalance = await this.signers.others[0].getBalance();
        });

        it("it burns claimer tokens", async () => {
          expect(await this.sERC20.balanceOf(this.signers.others[0].address)).to.equal(0);
        });

        it("it pays claimer", async () => {
          expect(this.data.lastClaimerETHBalance.sub(this.data.previousClaimerETHBalance).add(this.data.gasSpent)).to.equal(this.data.expectedValue);
        });

        it("it updates sale's stock", async () => {
          expect(this.data.sale.stock).to.equal(this.params.broker.value.sub(this.data.expectedFee).sub(this.data.expectedValue));
        });

        it("it emits a claim event", async () => {
          await expect(this.data.tx)
            .to.emit(this.broker.contract, "Claim")
            .withArgs(this.sERC20.address, this.signers.others[0].address, this.data.expectedValue, this.params.broker.balance);
        });
      });

      describe("» but there is nothing to claim", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[1], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.buyout();
          await this.broker.claim();
        });

        it("it reverts", async () => {
          await expect(this.broker.claim()).to.be.revertedWith("Broker: nothing to claim");
        });
      });
    });

    describe("» sale is not closed", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
        await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
        await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
        await this.sERC20.mint({ to: this.signers.others[1], amount: this.params.broker.balance });
        await advanceTime(this.params.broker.timelock);
      });

      it("it reverts", async () => {
        await expect(this.broker.claim()).to.be.revertedWith("Broker: invalid sale state");
      });
    });
  });

  describe("# enableFlashBuyout", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and flash buyout is disabled", () => {
        describe("» and sale is pending", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await this.broker.enableFlashBuyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itEnablesFlashBuyoutLikeExpected(this);
        });

        describe("» and sale is opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.enableFlashBuyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itEnablesFlashBuyoutLikeExpected(this);
        });

        describe("» but sale is neither pending nor opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ flash: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            await this.broker.acceptProposal();
          });

          it("it reverts", async () => {
            await expect(this.broker.enableFlashBuyout()).to.be.revertedWith("Broker: invalid sale state");
          });
        });
      });

      describe("» but flash buyout is already enabled", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.enableFlashBuyout()).to.be.revertedWith("Broker: flash buyout already enabled");
        });
      });
    });

    describe("» but caller is not guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ flash: false });
      });

      it("it reverts", async () => {
        await expect(this.broker.enableFlashBuyout({ from: this.signers.others[0] })).to.be.revertedWith(
          "Broker: must be sale's guardian to enable flash buyout"
        );
      });
    });
  });

  describe("# enableEscape", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and escape is disabled", () => {
        describe("» and sale is pending", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ escape: false });
            await this.broker.enableEscape();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itEnablesEscapeLikeExpected(this);
        });

        describe("» and sale is opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ escape: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.enableEscape();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itEnablesEscapeLikeExpected(this);
        });

        describe("» but sale is neither pending nor opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register({ escape: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.buyout();
          });

          it("it reverts", async () => {
            await expect(this.broker.enableEscape()).to.be.revertedWith("Broker: invalid sale state");
          });
        });
      });

      describe("» but escape is already enabled", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.enableEscape()).to.be.revertedWith("Broker: escape already enabled");
        });
      });
    });

    describe("» but caller is not guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register({ escape: false });
      });

      it("it reverts", async () => {
        await expect(this.broker.enableEscape({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to enable escape");
      });
    });
  });

  describe("# disableEscape", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and escape is enabled", () => {
        describe("» and sale is pending", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register();
            await this.broker.disableEscape();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itDisablesEscapeLikeExpected(this);
        });

        describe("» and sale is opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register();
            await advanceTime(this.params.broker.timelock);
            await this.broker.disableEscape();
            this.data.sale = await this.broker.saleOf(this.sERC20.address);
          });

          itDisablesEscapeLikeExpected(this);
        });

        describe("» but sale is neither pending nor opened", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register();
            await advanceTime(this.params.broker.timelock);
            await this.broker.buyout();
          });

          it("it reverts", async () => {
            await expect(this.broker.disableEscape()).to.be.revertedWith("Broker: invalid sale state");
          });
        });
      });

      describe("» but escape is already disabled", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register({ escape: false });
        });

        it("it reverts", async () => {
          await expect(this.broker.disableEscape()).to.be.revertedWith("Broker: escape already disabled");
        });
      });
    });

    describe("» but caller is not guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.disableEscape({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to disable escape");
      });
    });
  });

  describe("# setReserve", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and sale is pending", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await this.broker.setReserve({ reserve: "10" });
          this.data.sale = await this.broker.saleOf(this.sERC20.address);
        });

        it("it updates sale's reserve price", async () => {
          expect(this.data.sale.reserve).to.equal("10");
        });

        it("it emits a SetReserve event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "SetReserve").withArgs(this.sERC20.address, "10");
        });
      });

      describe("» and sale is opened", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await advanceTime(this.params.broker.timelock);
          await this.broker.setReserve({ reserve: "10" });
          this.data.sale = await this.broker.saleOf(this.sERC20.address);
        });

        it("it updates sale's reserve price", async () => {
          expect(this.data.sale.reserve).to.equal("10");
        });

        it("it emits a SetReserve event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "SetReserve").withArgs(this.sERC20.address, "10");
        });
      });

      describe("» but sale is neither pending nor opened", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          await advanceTime(this.params.broker.timelock);
          await this.broker.buyout();
        });

        it("it reverts", async () => {
          await expect(this.broker.setReserve()).to.be.revertedWith("Broker: invalid sale state");
        });
      });
    });

    describe("» but caller is not guardian", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.setReserve({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to set reserve");
      });
    });
  });

  describe("# setBank", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and bank is not the zero address", () => {
        before(async () => {
          await setup.broker(this);
          this.data.tx = await this.broker.contract.connect(this.signers.broker.admin).setBank(this.signers.others[0].address);
          this.data.receipt = await this.data.tx.wait();
        });

        it("it sets the broker's bank", async () => {
          expect(await this.broker.bank()).to.equal(this.signers.others[0].address);
        });

        it("it emits a SetBank event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "SetBank").withArgs(this.signers.others[0].address);
        });
      });

      describe("» but bank is the zero address", () => {
        before(async () => {
          await setup.broker(this);
        });

        it("it reverts", async () => {
          await expect(this.broker.contract.connect(this.signers.broker.admin).setBank(ethers.constants.AddressZero)).to.be.revertedWith(
            "Broker: bank cannot be the zero address"
          );
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.broker(this);
      });

      it("it reverts", async () => {
        await expect(this.broker.contract.connect(this.signers.others[0]).setBank(this.signers.issuer.bank.address)).to.be.revertedWith(
          "Broker: must have DEFAULT_ADMIN_ROLE to set bank"
        );
      });
    });
  });

  describe("# setProtocolFee", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and protocol fee is inferior to 100%", () => {
        before(async () => {
          await setup.broker(this);
          this.data.tx = await this.broker.contract.connect(this.signers.broker.admin).setProtocolFee(0);
          this.data.receipt = await this.data.tx.wait();
        });

        it("it sets the broker's protocol fee", async () => {
          expect(await this.broker.protocolFee()).to.equal(0);
        });

        it("it emits a SetProtocolFee event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "SetProtocolFee").withArgs(0);
        });
      });

      describe("» but protocol fee is superior or equal to 100%", () => {
        before(async () => {
          await setup.broker(this);
        });

        it("it reverts", async () => {
          await expect(this.broker.contract.connect(this.signers.broker.admin).setProtocolFee(this.constants.broker.HUNDRED)).to.be.revertedWith(
            "Broker: protocol fee must be inferior to 100%"
          );
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.broker(this);
      });

      it("it reverts", async () => {
        await expect(this.broker.contract.connect(this.signers.others[0]).setProtocolFee(this.params.broker.protocolFee)).to.be.revertedWith(
          "Broker: must have DEFAULT_ADMIN_ROLE to set protocol fee"
        );
      });
    });
  });

  describe("# escape", () => {
    describe("» caller has ESCAPE_ROLE", () => {
      describe("» and parameters lengths match", () => {
        describe("» and all NFTs are escapable", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register();
            this.data.tokenId0 = this.data.tokenId;
            this.data.sERC20 = this.sERC20;
            await this.sERC721.mint();
            await this.vault.fractionalize({ broker: this.broker.contract });
            await this.broker.register();
            this.data.tokenId1 = this.data.tokenId;
            await this.broker.escape();
          });

          it("it transfers NFTs", async () => {
            expect(await this.sERC721.ownerOf(this.data.tokenId0)).to.equal(this.signers.broker.beneficiaries[0].address);
            expect(await this.sERC721.ownerOf(this.data.tokenId1)).to.equal(this.signers.broker.beneficiaries[1].address);
          });

          it("it closes NFTs sales", async () => {
            expect((await this.broker.saleOf(this.data.sERC20.address)).state).to.equal(this.constants.broker.sales.state.Closed);
            expect((await this.broker.saleOf(this.sERC20.address)).state).to.equal(this.constants.broker.sales.state.Closed);
          });

          it("it emits an Escape event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Escape")
              .withArgs(this.data.sERC20.address, this.signers.broker.beneficiaries[0].address, ethers.constants.HashZero);

            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Escape")
              .withArgs(this.sERC20.address, this.signers.broker.beneficiaries[1].address, ethers.constants.HashZero);
          });
        });

        describe("» but one NFT is not escapable", () => {
          before(async () => {
            await setup.broker(this);
            await this.broker.register();
            this.data.tokenId0 = this.data.tokenId;
            this.data.sERC20 = this.sERC20;
            await this.sERC721.mint();
            await this.vault.fractionalize({ broker: this.broker.contract });
            await this.broker.register({ escape: false });
            this.data.tokenId1 = this.data.tokenId;
          });

          it("it reverts", async () => {
            await expect(this.broker.escape()).to.be.revertedWith("Broker: escape is disabled");
          });
        });
      });

      describe("» but parameters lengths mismatch", () => {
        before(async () => {
          await setup.broker(this);
          await this.broker.register();
          this.data.sERC20 = this.sERC20;
          await this.sERC721.mint();
          await this.vault.fractionalize({ broker: this.broker.contract });
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.escape({ sERC20s: [this.sERC20.address] })).to.be.revertedWith("Broker: parameters lengths mismatch");
          await expect(this.broker.escape({ beneficiaries: [this.signers.broker.beneficiaries[0].address] })).to.be.revertedWith(
            "Broker: parameters lengths mismatch"
          );
          await expect(this.broker.escape({ datas: [ethers.constants.HashZero] })).to.be.revertedWith("Broker: parameters lengths mismatch");
        });
      });
    });

    describe("» caller does not have ESCAPE_ROLE", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
        this.data.sERC20 = this.sERC20;
        await this.sERC721.mint();
        await this.vault.fractionalize({ broker: this.broker.contract });
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.escape({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must have ESCAPE_ROLE to escape");
      });
    });
  });

  describe("# priceOfFor", () => {
    describe("» market value is inferior to reserve price", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
        await this.sERC20.mint({ to: this.signers.broker.buyer, amount: ethers.BigNumber.from(1) });
        await this.sERC20.mint({ to: this.signers.others[0], amount: ethers.BigNumber.from(1) });
        this.data.price = await this.broker.priceOfFor(this.sERC20.address, this.signers.broker.buyer.address);
      });

      it("it returns valid data based on reserve price", async () => {
        expect(this.data.price.value).to.equal(this.params.broker.reserve.div(ethers.BigNumber.from("2")));
        expect(this.data.price.collateral).to.equal(ethers.BigNumber.from(1));
      });
    });

    describe("» market value is superior to reserve price", () => {
      before(async () => {
        await setup.broker(this);
        await this.broker.register();
        await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
        await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
        this.data.price = await this.broker.priceOfFor(this.sERC20.address, this.signers.broker.buyer.address);
      });

      it("it returns valid data based on market value", async () => {
        expect(this.data.price.value).to.equal(
          (await this.sERC20.totalSupply()) // supply
            .mul(await this.broker.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)) // price
            .mul(this.params.broker.multiplier)
            .div(this.constants.broker.DECIMALS) // DECIMALS for TWAP
            .div(this.constants.broker.DECIMALS) // DECIMALS for multiplier
            .div(ethers.BigNumber.from("2")) // buyer holds half the supply
        );
        expect(this.data.price.collateral).to.equal(this.params.broker.balance);
      });
    });
  });
});
