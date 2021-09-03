const { expect } = require("chai");
// const { ethers } = require("ethers");
const { initialize, setup } = require("../helpers");
const { advanceTime } = require("../helpers/time");

describe("Broker", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    before(async () => {
      await setup(this, { broker: true });
    });

    it("it initializes broker", async () => {
      expect(await this.broker.vault()).to.equal(this.sERC1155.contract.address);
      expect(await this.broker.forge()).to.equal(this.contracts.marketMock.address);
    });

    it("it sets up permissions", async () => {
      expect(await this.broker.hasRole(ethers.constants.HashZero, this.signers.broker.admin.address)).to.equal(true);
    });
  });

  describe("# register", () => {
    describe("» caller has REGISTER_ROLE", () => {
      describe("» and timelock period is valid", () => {
        describe("» and flash buyout is enabled", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.timelock
            );
          });

          it("it registers sale", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.PENDING);
            expect(this.data.sale.guardian).to.equal(this.signers.broker.guardian.address);
            expect(this.data.sale.reserve).to.equal(this.params.broker.reserve);
            expect(this.data.sale.multiplier).to.equal(this.params.broker.multiplier);
            expect(this.data.sale.opening).to.equal(this.data.expectedOpening);
            expect(this.data.sale.stock).to.equal(0);
            expect(this.data.sale.nbOfProposals).to.equal(0);
            expect(this.data.sale.flash).to.equal(true);
          });

          it("it emits a Register event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Register")
              .withArgs(
                this.sERC20.contract.address,
                this.signers.broker.guardian.address,
                this.params.broker.reserve,
                this.params.broker.multiplier,
                this.data.expectedOpening
              );
          });

          it("it emits a EnableFlashBuyout event", async () => {
            await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout");
          });
        });

        describe("» but flash buyout is disabled", () => {
          describe("» and guardian is not the zero address", () => {
            before(async () => {
              await setup(this, { broker: true });
              await this.broker.register({ flash: false });
              this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
              this.data.expectedOpening = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                this.params.broker.timelock
              );
            });

            it("it registers sale", async () => {
              expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.PENDING);
              expect(this.data.sale.guardian).to.equal(this.signers.broker.guardian.address);
              expect(this.data.sale.reserve).to.equal(this.params.broker.reserve);
              expect(this.data.sale.multiplier).to.equal(this.params.broker.multiplier);
              expect(this.data.sale.opening).to.equal(this.data.expectedOpening);
              expect(this.data.sale.stock).to.equal(0);
              expect(this.data.sale.nbOfProposals).to.equal(0);
              expect(this.data.sale.flash).to.equal(false);
            });

            it("it emits a Register event", async () => {
              await expect(this.data.tx)
                .to.emit(this.broker.contract, "Register")
                .withArgs(
                  this.sERC20.contract.address,
                  this.signers.broker.guardian.address,
                  this.params.broker.reserve,
                  this.params.broker.multiplier,
                  this.data.expectedOpening
                );
            });

            it("it does not emit a EnableFlashBuyout event", async () => {
              await expect(this.data.tx).to.not.emit(this.broker.contract, "EnableFlashBuyout");
            });
          });

          describe("» but guardian is the zero address", () => {
            before(async () => {
              await setup(this, { broker: true });
            });

            it("it reverts", async () => {
              await expect(this.broker.register({ flash: false, guardian: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
                "Broker: guardian cannot be the zero address if flash buyout is not enabled"
              );
            });
          });
        });
      });

      describe("» but timelock period is invalid", () => {
        before(async () => {
          await setup(this, { broker: true });
        });

        it("it reverts", async () => {
          await expect(this.broker.register({ timelock: "100" })).to.be.revertedWith("Broker: invalid timelock");
        });
      });
    });

    describe("» caller does not have REGISTER_ROLE", () => {
      before(async () => {
        await setup(this, { broker: true });
      });

      it("it reverts", async () => {
        await expect(this.broker.register({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must have REGISTER_ROLE to register");
      });
    });
  });

  describe("# buyout", () => {
    describe("» sale is open", () => {
      describe("» and flash buyout is enabled", () => {
        describe("» and buyout value is sufficient [with collateral and ETH]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            this.data.previousTotalSupply = await this.sERC20.totalSupply();
            await this.broker.buyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.lastTotalSupply = await this.sERC20.totalSupply();
          });

          it("it updates sale state", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.CLOSED);
          });

          it("it updates sale stock", async () => {
            expect(this.data.sale.stock).to.equal(this.params.broker.value);
          });

          it("it burns buyer's tokens", async () => {
            expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(0);
          });

          it("it transfers NFT", async () => {
            expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.buyer.address);
          });

          it("it revokes market's MINT_ROLE over sERC20", async () => {
            expect(await this.sERC20.hasRole(this.constants.sERC20.MINT_ROLE, this.contracts.marketMock.address)).to.equal(false);
          });

          it("it emits a Buyout event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Buyout")
              .withArgs(this.sERC20.contract.address, this.signers.broker.buyer.address, this.params.broker.value, this.params.broker.balance);
          });
        });

        describe("» and buyout value is sufficient [with collateral only]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            this.data.previousTotalSupply = await this.sERC20.totalSupply();
            await this.broker.buyout({ value: 0 });
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.lastTotalSupply = await this.sERC20.totalSupply();
          });

          it("it updates sale state", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.CLOSED);
          });

          it("it updates sale stock", async () => {
            expect(this.data.sale.stock).to.equal(0);
          });

          it("it burns buyer's tokens", async () => {
            expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(0);
          });

          it("it transfers NFT", async () => {
            expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.buyer.address);
          });

          it("it revokes market's MINT_ROLE over sERC20", async () => {
            expect(await this.sERC20.hasRole(this.constants.sERC20.MINT_ROLE, this.contracts.marketMock.address)).to.equal(false);
          });

          it("it emits a Buyout event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Buyout")
              .withArgs(this.sERC20.contract.address, this.signers.broker.buyer.address, 0, this.params.broker.balance);
          });
        });

        describe("» and buyout value is sufficient [with ETH only]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            this.data.previousTotalSupply = await this.sERC20.totalSupply();
            await this.broker.buyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.lastTotalSupply = await this.sERC20.totalSupply();
          });

          it("it updates sale state", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.CLOSED);
          });

          it("it updates sale stock", async () => {
            expect(this.data.sale.stock).to.equal(this.params.broker.value);
          });

          it("it transfers NFT", async () => {
            expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.buyer.address);
          });

          it("it revokes market's MINT_ROLE over sERC20", async () => {
            expect(await this.sERC20.hasRole(this.constants.sERC20.MINT_ROLE, this.contracts.marketMock.address)).to.equal(false);
          });

          it("it emits a Buyout event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "Buyout")
              .withArgs(this.sERC20.contract.address, this.signers.broker.buyer.address, this.params.broker.value, 0);
          });
        });

        describe("» but buyout value is insufficient", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
          });

          it("it reverts", async () => {
            await expect(this.broker.buyout({ value: "1" })).to.be.revertedWith("Broker: insufficient value");
          });
        });
      });

      describe("» but flash buyout is disabled", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
        });

        it("it reverts", async () => {
          await expect(this.broker.buyout()).to.be.revertedWith("Broker: flash buyout is disabled");
        });
      });
    });

    describe("» but sale is not opened", () => {
      before(async () => {
        await setup(this, { broker: true });
        await this.broker.register();
        await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
        await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
      });

      it("it reverts", async () => {
        await expect(this.broker.buyout()).to.be.revertedWith("Broker: invalid sale state");
      });
    });
  });

  describe("# createProposal", () => {
    describe("» sale is opened", () => {
      describe("» and flash buyout is disabled", () => {
        describe("» and buyout value is sufficient [with collateral and ETH]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          it("it creates a new proposal", async () => {
            expect(this.data.sale.nbOfProposals).to.equal(1);
            expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Pending);
            expect(this.data.proposal.buyer).to.equal(this.signers.broker.buyer.address);
            expect(this.data.proposal.value).to.equal(this.params.broker.value);
            expect(this.data.proposal.collateral).to.equal(this.params.broker.balance);
            expect(this.data.proposal.expiration).to.equal(this.data.expectedExpiration);
          });

          it("it locks collateral", async () => {
            expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(0);
            expect(await this.sERC20.balanceOf(this.contracts.broker)).to.equal(this.params.broker.balance);
          });

          it("it emits a CreateProposal event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "CreateProposal")
              .withArgs(
                this.sERC20.contract.address,
                this.data.proposalId,
                this.signers.broker.buyer.address,
                this.params.broker.value,
                this.params.broker.balance,
                this.data.expectedExpiration
              );
          });
        });

        describe("» and buyout value is sufficient [with collateral only]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal({ value: 0 });
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          it("it creates a new proposal", async () => {
            expect(this.data.sale.nbOfProposals).to.equal(1);
            expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Pending);
            expect(this.data.proposal.buyer).to.equal(this.signers.broker.buyer.address);
            expect(this.data.proposal.value).to.equal(0);
            expect(this.data.proposal.collateral).to.equal(this.params.broker.balance);
            expect(this.data.proposal.expiration).to.equal(this.data.expectedExpiration);
          });

          it("it locks collateral", async () => {
            expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(0);
            expect(await this.sERC20.balanceOf(this.contracts.broker)).to.equal(this.params.broker.balance);
          });

          it("it emits a CreateProposal event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "CreateProposal")
              .withArgs(
                this.sERC20.contract.address,
                this.data.proposalId,
                this.signers.broker.buyer.address,
                0,
                this.params.broker.balance,
                this.data.expectedExpiration
              );
          });
        });

        describe("» and buyout value is sufficient [with ETH only]", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
            await advanceTime(this.params.broker.timelock);
            await this.broker.createProposal();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
            this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
              this.params.broker.lifespan
            );
          });

          it("it creates a new proposal", async () => {
            expect(this.data.sale.nbOfProposals).to.equal(1);
            expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Pending);
            expect(this.data.proposal.buyer).to.equal(this.signers.broker.buyer.address);
            expect(this.data.proposal.value).to.equal(this.params.broker.value);
            expect(this.data.proposal.collateral).to.equal(0);
            expect(this.data.proposal.expiration).to.equal(this.data.expectedExpiration);
          });

          it("it emits a CreateProposal event", async () => {
            await expect(this.data.tx)
              .to.emit(this.broker.contract, "CreateProposal")
              .withArgs(
                this.sERC20.contract.address,
                this.data.proposalId,
                this.signers.broker.buyer.address,
                this.params.broker.value,
                0,
                this.data.expectedExpiration
              );
          });
        });
      });

      describe("» but flash buyout is enabled", () => {});
    });

    describe("» sale is not opened", () => {});
  });

  describe("# acceptProposal", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and sale is opened", () => {
        describe("» and proposal is pending", () => {
          describe("» and flash buyout is disabled", () => {
            before(async () => {
              await setup(this, { broker: true });
              await this.broker.register({ flash: false });
              await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
              await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
              await advanceTime(this.params.broker.timelock);
              await this.broker.createProposal();
              await this.broker.acceptProposal();
              this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
              this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
            });

            it("it updates proposal state", async () => {
              expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Accepted);
            });

            it("it updates sale state", async () => {
              expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.CLOSED);
            });

            it("it updates sale stock", async () => {
              expect(this.data.sale.stock).to.equal(this.params.broker.value);
            });

            it("it burns locked tokens", async () => {
              expect(await this.sERC20.balanceOf(this.contracts.broker)).to.equal(0);
            });

            it("it transfers NFT", async () => {
              expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.buyer.address);
            });

            it("it revokes market's MINT_ROLE over sERC20", async () => {
              expect(await this.sERC20.hasRole(this.constants.sERC20.MINT_ROLE, this.contracts.marketMock.address)).to.equal(false);
            });

            it("it emits a AcceptProposal event", async () => {
              await expect(this.data.tx).to.emit(this.broker.contract, "AcceptProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
            });

            it("it emits a Buyout event", async () => {
              await expect(this.data.tx)
                .to.emit(this.broker.contract, "Buyout")
                .withArgs(this.sERC20.contract.address, this.signers.broker.buyer.address, this.params.broker.value, this.params.broker.balance);
            });
          });

          describe("» but flash buyout is enabled", () => {
            before(async () => {
              await setup(this, { broker: true });
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
            await setup(this, { broker: true });
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
          await setup(this, { broker: true });
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
        await setup(this, { broker: true });
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
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await this.broker.rejectProposal();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
        });

        it("it updates proposal state", async () => {
          expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Rejected);
        });

        it("it refunds locked tokens", async () => {
          expect(await this.sERC20.balanceOf(this.contracts.broker)).to.equal(0);
          expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(this.params.broker.balance);
        });

        it("it refunds locked ETH", async () => {
          expect(await this.signers.broker.buyer.getBalance()).to.equal(this.data.previousBuyerETHBalance.add(this.params.broker.value));
        });

        it("it emits a RejectProposal event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "RejectProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
        });
      });

      describe("» and proposal is lapsed", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await advanceTime(this.params.broker.lifespan.add(ethers.BigNumber.from("1")));
          await this.broker.rejectProposal();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, this.data.proposalId);
        });

        it("it updates proposal state", async () => {
          expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Rejected);
        });

        it("it refunds locked tokens", async () => {
          expect(await this.sERC20.balanceOf(this.contracts.broker)).to.equal(0);
          expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(this.params.broker.balance);
        });

        it("it refunds locked ETH", async () => {
          expect(await this.signers.broker.buyer.getBalance()).to.equal(this.data.previousBuyerETHBalance.add(this.params.broker.value));
        });

        it("it emits a RejectProposal event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "RejectProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
        });
      });

      describe("» but proposal is neither pending nor lapsed", () => {
        before(async () => {
          await setup(this, { broker: true });
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
        await setup(this, { broker: true });
        await this.broker.register({ flash: false });
        await advanceTime(this.params.broker.timelock);
        await this.broker.createProposal();
      });

      it("it reverts", async () => {
        await expect(this.broker.rejectProposal({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must be sale's guardian to reject proposal");
      });
    });
  });

  describe.only("# withdrawProposal", () => {
    describe("» caller is proposal's buyer", () => {
      describe("» proposal is pending", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await this.broker.withdrawProposal();
          this.data.lastBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, 0);
        });

        it("it updates proposal's state", async () => {
          expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Withdrawn);
        });

        it("it refunds sERC20s", async () => {
          expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(this.params.broker.balance);
        });

        it("it refunds ETH", async () => {
          expect(this.data.lastBuyerETHBalance.sub(this.data.previousBuyerETHBalance).add(this.data.receipt.gasUsed.mul(this.data.tx.gasPrice))).to.equal(
            this.params.broker.value
          );
        });

        it("it emits a WithdrawProposal event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "WithdrawProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
        });
      });

      describe("» proposal is lapsed", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.broker.createProposal();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await advanceTime(this.params.broker.lifespan.add(ethers.BigNumber.from("1")));
          await this.broker.withdrawProposal();
          this.data.lastBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          this.data.proposal = await this.broker.proposalFor(this.sERC20.contract.address, 0);
        });

        it("it updates proposal's state", async () => {
          expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Withdrawn);
        });

        it("it refunds sERC20s", async () => {
          expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(this.params.broker.balance);
        });

        it("it refunds ETH", async () => {
          expect(this.data.lastBuyerETHBalance.sub(this.data.previousBuyerETHBalance).add(this.data.receipt.gasUsed.mul(this.data.tx.gasPrice))).to.equal(
            this.params.broker.value
          );
        });

        it("it emits a WithdrawProposal event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "WithdrawProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
        });
      });

      describe("» but proposal is neither pending not lapsed", () => {
        before(async () => {
          await setup(this, { broker: true });
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
        await setup(this, { broker: true });
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

  describe("# enableFlashBuyout", () => {
    describe("» caller is sale's guardian", () => {
      describe("» and flash buyout is not enabled", () => {
        describe("» and sale is pending", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await this.broker.enableFlashBuyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
          });

          it("it enables flash buyout", async () => {
            expect(this.data.sale.flash).to.equal(true);
          });

          it("it emits a EnableFlashBuyout event", async () => {
            await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout").withArgs(this.sERC20.contract.address);
          });
        });

        describe("» and sale is opened", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await advanceTime(this.params.broker.timelock);
            await this.broker.enableFlashBuyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
          });

          it("it enables flash buyout", async () => {
            expect(this.data.sale.flash).to.equal(true);
          });

          it("it emits a EnableFlashBuyout event", async () => {
            await expect(this.data.tx).to.emit(this.broker.contract, "EnableFlashBuyout").withArgs(this.sERC20.contract.address);
          });
        });

        describe("» but sale is neither pending nor opened", () => {
          before(async () => {
            await setup(this, { broker: true });
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
          await setup(this, { broker: true });
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.enableFlashBuyout()).to.be.revertedWith("Broker: flash buyout already enabled");
        });
      });
    });

    describe("» but caller is not guardian", () => {
      before(async () => {
        await setup(this, { broker: true });
        await this.broker.register({ flash: false });
      });

      it("it reverts", async () => {
        await expect(this.broker.enableFlashBuyout({ from: this.signers.others[0] })).to.be.revertedWith(
          "Broker: must be sale's guardian to enable flash buyout"
        );
      });
    });
  });

  describe("# escape", () => {
    describe("» caller has ESCAPE_ROLE", () => {
      describe("» and parameters lengths match", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register();
          this.data.tokenId0 = this.data.tokenId;
          this.data.sERC20 = this.sERC20;
          await this.sERC721.mint();
          await this.sERC1155.spectralize({ guardian: this.broker.contract });
          await this.broker.register();
          this.data.tokenId1 = this.data.tokenId;
          await this.broker.escape();
        });

        it("it transfers NFTs", async () => {
          expect(await this.sERC721.ownerOf(this.data.tokenId0)).to.equal(this.signers.broker.beneficiaries[0].address);
          expect(await this.sERC721.ownerOf(this.data.tokenId1)).to.equal(this.signers.broker.beneficiaries[1].address);
        });

        it("it emits a Escape events", async () => {
          await expect(this.data.tx)
            .to.emit(this.broker.contract, "Escape")
            .withArgs(this.data.sERC20.contract.address, this.signers.broker.beneficiaries[0].address, ethers.constants.HashZero);

          await expect(this.data.tx)
            .to.emit(this.broker.contract, "Escape")
            .withArgs(this.sERC20.contract.address, this.signers.broker.beneficiaries[1].address, ethers.constants.HashZero);
        });
      });

      describe("» but parameters lengths mismatch", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register();
          this.data.sERC20 = this.sERC20;
          await this.sERC721.mint();
          await this.sERC1155.spectralize({ guardian: this.broker.contract });
          await this.broker.register();
        });

        it("it reverts", async () => {
          await expect(this.broker.escape({ sERC20s: [this.sERC20.contract.address] })).to.be.revertedWith("Broker: parameters lengths mismatch");
          await expect(this.broker.escape({ beneficiaries: [this.signers.broker.beneficiaries[0].address] })).to.be.revertedWith(
            "Broker: parameters lengths mismatch"
          );
          await expect(this.broker.escape({ datas: [ethers.constants.HashZero] })).to.be.revertedWith("Broker: parameters lengths mismatch");
        });
      });
    });

    describe("» caller does not have ESCAPE_ROLE", () => {
      before(async () => {
        await setup(this, { broker: true });
        await this.broker.register();
        this.data.sERC20 = this.sERC20;
        await this.sERC721.mint();
        await this.sERC1155.spectralize({ guardian: this.broker.contract });
        await this.broker.register();
      });

      it("it reverts", async () => {
        await expect(this.broker.escape({ from: this.signers.others[0] })).to.be.revertedWith("Broker: must have ESCAPE_ROLE to escape");
      });
    });
  });
});
