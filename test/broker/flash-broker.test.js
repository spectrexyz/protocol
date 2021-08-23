const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { sERC20 } = require("../helpers/models");
const { advanceTime } = require("../helpers/time");

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
            expect(this.data.sale.guardian).to.equal(this.signers.broker.guardian.address);
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
          await expect(this.broker.register({ sERC20: this.signers.others[0] })).to.be.revertedWith("FlashBroker: invalid spectre state");
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

  describe("# buyout", () => {
    describe("» sale is open", () => {
      describe("» and buyout value is sufficient", () => {
        describe("» and flash buyout is enabled", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register();
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.sERC20.cap.div(ethers.BigNumber.from("4")) });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.sERC20.cap.div(ethers.BigNumber.from("4")) });
            await advanceTime(this.params.broker.timelock);
            this.data.previousTotalSupply = await this.sERC20.totalSupply();
            await this.broker.buyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.lastTotalSupply = await this.sERC20.totalSupply();
          });

          it("# it updates sale state", async () => {
            expect(this.data.sale.state).to.equal(this.constants.broker.sales.state.CLOSED);
          });

          it("# it updates sale price", async () => {
            expect(this.data.sale.price).to.equal(
              ethers.BigNumber.from(this.params.broker.value).mul(this.constants.broker.DECIMALS).div(this.data.lastTotalSupply)
            );
          });

          it("# it burns buyer's tokens", async () => {
            expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(0);
          });

          it("# it transfers NFT", async () => {
            expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.broker.beneficiary.address);
          });
        });

        describe("» but flash buyout is not enabled", () => {
          before(async () => {
            await setup(this, { broker: true });
            await this.broker.register({ flash: false });
            await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.sERC20.cap.div(ethers.BigNumber.from("4")) });
            await this.sERC20.mint({ to: this.signers.others[0], amount: this.params.sERC20.cap.div(ethers.BigNumber.from("4")) });
            await advanceTime(this.params.broker.timelock);
            await this.sERC20.approve({
              from: this.signers.broker.buyer,
              spender: this.broker.contract,
              amount: this.params.sERC20.cap.div(ethers.BigNumber.from("4")),
            });
            await this.broker.buyout();
            this.data.sale = await this.broker.saleOf(this.sERC20.contract.address);
            this.data.proposal = await this.broker.proposal(this.sERC20.contract.address, 0);
          });

          it("it creates a new proposal", async () => {
            expect(this.data.sale.nbOfProposals).to.equal(1);
            expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Pending);
            expect(this.data.proposal.buyer).to.equal(this.signers.broker.buyer.address);
            expect(this.data.proposal.beneficiary).to.equal(this.signers.broker.beneficiary.address);
            expect(this.data.proposal.value).to.equal(this.params.broker.value);
            expect(this.data.proposal.balance).to.equal(this.params.sERC20.cap.div(ethers.BigNumber.from("4")));
            expect(this.data.proposal.expiration).to.equal(
              ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(this.constants.broker.proposals.duration)
            );

            //             enum State {
            //     Null,
            //     Pending,
            //     Accepted,
            //     Rejected,
            //     Lapsed,proposal.
            //     Cancelled,
            //     Refunded
            // }

            // struct Proposal {
            //     State _state;
            //     address payable from;
            //     uint256 value;
            //     uint256 expiration;
            // }
          });
        });
      });
    });
  });

  describe.only("# cancel", () => {
    describe("» proposal is pending", () => {
      describe("» and caller is proposal's buyer", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.sERC20.approve({
            from: this.signers.broker.buyer,
            spender: this.broker.contract,
            amount: this.params.broker.balance,
          });
          await this.broker.buyout();
          this.data.previousBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          await this.broker.cancel();
          this.data.lastBuyerETHBalance = await this.signers.broker.buyer.getBalance();
          this.data.proposal = await this.broker.proposal(this.sERC20.contract.address, 0);
        });

        it("it updates proposal's state", async () => {
          expect(this.data.proposal.state).to.equal(this.constants.broker.proposals.state.Cancelled);
        });

        it("it refunds sERC20s", async () => {
          expect(await this.sERC20.balanceOf(this.signers.broker.buyer)).to.equal(this.params.broker.balance);
        });

        it("it refunds ETH", async () => {
          expect(this.data.lastBuyerETHBalance.sub(this.data.previousBuyerETHBalance).add(this.data.receipt.gasUsed.mul(this.data.tx.gasPrice))).to.equal(
            this.params.broker.value
          );
        });

        it("it emits a CancelProposal event", async () => {
          await expect(this.data.tx).to.emit(this.broker.contract, "CancelProposal").withArgs(this.sERC20.contract.address, this.data.proposalId);
        });
      });

      describe("» but caller is not proposal's buyer", () => {
        before(async () => {
          await setup(this, { broker: true });
          await this.broker.register({ flash: false });
          await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
          await advanceTime(this.params.broker.timelock);
          await this.sERC20.approve({
            from: this.signers.broker.buyer,
            spender: this.broker.contract,
            amount: this.params.broker.balance,
          });
          await this.broker.buyout();
        });

        it("it reverts", async () => {
          await expect(this.broker.cancel({ from: this.signers.others[0] })).to.be.revertedWith("FlashBroker: must be buyer to cancel proposal");
        });
      });
    });

    describe("» proposal is not pending", () => {
      before(async () => {
        await setup(this, { broker: true });
        await this.broker.register({ flash: false });
        await this.sERC20.mint({ to: this.signers.broker.buyer, amount: this.params.broker.balance });
        await advanceTime(this.params.broker.timelock);
        await this.sERC20.approve({
          from: this.signers.broker.buyer,
          spender: this.broker.contract,
          amount: this.params.broker.balance,
        });
        await this.broker.buyout();
        await this.broker.cancel();
      });

      it("it reverts", async () => {
        await expect(this.broker.cancel()).to.be.revertedWith("FlashBroker: invalid proposal state");
      });
    });
  });
});
