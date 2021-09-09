const { expect } = require("chai");

const itRegistersLikeExpected = (ctx, opts = {}) => {
  opts.flash ??= true;

  it("it registers sale", async () => {
    expect(ctx.data.sale.state).to.equal(ctx.constants.broker.sales.state.Pending);
    expect(ctx.data.sale.guardian).to.equal(ctx.signers.broker.guardian.address);
    expect(ctx.data.sale.reserve).to.equal(ctx.params.broker.reserve);
    expect(ctx.data.sale.multiplier).to.equal(ctx.params.broker.multiplier);
    expect(ctx.data.sale.opening).to.equal(ctx.data.expectedOpening);
    expect(ctx.data.sale.stock).to.equal(0);
    expect(ctx.data.sale.nbOfProposals).to.equal(0);
    expect(ctx.data.sale.flash).to.equal(opts.flash);
  });

  it("it emits a Register event", async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.broker.contract, "Register")
      .withArgs(ctx.sERC20.address, ctx.signers.broker.guardian.address, ctx.params.broker.reserve, ctx.params.broker.multiplier, ctx.data.expectedOpening);
  });
};

const itBuysOutLikeExpected = (ctx, opts = {}) => {
  it("it updates sale state", async () => {
    expect(ctx.data.sale.state).to.equal(ctx.constants.broker.sales.state.Closed);
  });
  it("it updates sale stock", async () => {
    opts.value = opts.value ? ctx.params.broker.value : 0;
    opts.collateral = opts.collateral ? ctx.params.broker.balance : 0;
    expect(ctx.data.sale.stock).to.equal(opts.value);
  });
  it("it burns buyer's tokens", async () => {
    expect(await ctx.sERC20.balanceOf(ctx.signers.broker.buyer.address)).to.equal(0);
  });
  it("it transfers NFT", async () => {
    expect(await ctx.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.signers.broker.buyer.address);
  });
  it("it closes sERC20 issuance", async () => {
    await expect(ctx.data.tx).to.emit(ctx.contracts.issuerMock, "Close").withArgs(ctx.sERC20.address);
  });
  it("it emits a Buyout event", async () => {
    opts.value = opts.value ? ctx.params.broker.value : 0;
    opts.collateral = opts.collateral ? ctx.params.broker.balance : 0;
    await expect(ctx.data.tx)
      .to.emit(ctx.broker.contract, "Buyout")
      .withArgs(ctx.sERC20.address, ctx.signers.broker.buyer.address, opts.value, opts.collateral);
  });
};

const itCreatesProposalLikeExpected = (ctx, opts = {}) => {
  it("it creates a new proposal", async () => {
    opts.value = opts.value ? ctx.params.broker.value : 0;
    opts.collateral = opts.collateral ? ctx.params.broker.balance : 0;

    expect(ctx.data.sale.nbOfProposals).to.equal(1);
    expect(ctx.data.proposal.state).to.equal(ctx.constants.broker.proposals.state.Pending);
    expect(ctx.data.proposal.buyer).to.equal(ctx.signers.broker.buyer.address);
    expect(ctx.data.proposal.value).to.equal(opts.value);
    expect(ctx.data.proposal.collateral).to.equal(opts.collateral);
    expect(ctx.data.proposal.expiration).to.equal(ctx.data.expectedExpiration);
  });

  it("it locks collateral", async () => {
    opts.collateral = opts.collateral ? ctx.params.broker.balance : 0;

    expect(await ctx.sERC20.balanceOf(ctx.signers.broker.buyer.address)).to.equal(0);
    expect(await ctx.sERC20.balanceOf(ctx.contracts.broker.address)).to.equal(opts.collateral);
  });

  it("it emits a CreateProposal event", async () => {
    opts.value = opts.value ? ctx.params.broker.value : 0;
    opts.collateral = opts.collateral ? ctx.params.broker.balance : 0;

    await expect(ctx.data.tx)
      .to.emit(ctx.broker.contract, "CreateProposal")
      .withArgs(ctx.sERC20.address, ctx.data.proposalId, ctx.signers.broker.buyer.address, opts.value, opts.collateral, ctx.data.expectedExpiration);
  });
};

const itRejectsProposalLikeExpected = (ctx, opts = {}) => {
  it("it updates proposal state", async () => {
    expect(ctx.data.proposal.state).to.equal(ctx.constants.broker.proposals.state.Rejected);
  });

  it("it refunds locked collateral", async () => {
    expect(await ctx.sERC20.balanceOf(ctx.contracts.broker.address)).to.equal(0);
    expect(await ctx.sERC20.balanceOf(ctx.signers.broker.buyer.address)).to.equal(ctx.params.broker.balance);
  });

  it("it refunds locked ETH", async () => {
    expect(await ctx.signers.broker.buyer.getBalance()).to.equal(ctx.data.previousBuyerETHBalance.add(ctx.params.broker.value));
  });

  it("it emits a RejectProposal event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.broker.contract, "RejectProposal").withArgs(ctx.sERC20.address, ctx.data.proposalId);
  });
};

const itWithdrawsProposalLikeExpected = (ctx, opts = {}) => {
  it("it updates proposal's state", async () => {
    expect(ctx.data.proposal.state).to.equal(ctx.constants.broker.proposals.state.Withdrawn);
  });

  it("it refunds locked collateral", async () => {
    expect(await ctx.sERC20.balanceOf(ctx.signers.broker.buyer.address)).to.equal(ctx.params.broker.balance);
  });

  it("it refunds locked ETH", async () => {
    expect(ctx.data.lastBuyerETHBalance.sub(ctx.data.previousBuyerETHBalance).add(ctx.data.receipt.gasUsed.mul(ctx.data.tx.gasPrice))).to.equal(
      ctx.params.broker.value
    );
  });

  it("it emits a WithdrawProposal event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.broker.contract, "WithdrawProposal").withArgs(ctx.sERC20.address, ctx.data.proposalId);
  });
};

const itEnablesFlashBuyoutLikeExpected = (ctx, opts = {}) => {
  it("it enables flash buyout", async () => {
    expect(ctx.data.sale.flash).to.equal(true);
  });

  it("it emits a EnableFlashBuyout event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.broker.contract, "EnableFlashBuyout").withArgs(ctx.sERC20.address);
  });
};

module.exports = {
  itRegistersLikeExpected,
  itBuysOutLikeExpected,
  itCreatesProposalLikeExpected,
  itRejectsProposalLikeExpected,
  itWithdrawsProposalLikeExpected,
  itEnablesFlashBuyoutLikeExpected,
};
