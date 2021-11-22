const { expect } = require("chai");

const itRegistersLikeExpected = (ctx, opts = {}) => {
  it("it deploys FractionalizationBootstrappingPool", async () => {
    expect(await ctx.pool.getPoolId()).to.equal(ctx.data.issuance.poolId);
  });

  it("it registers issuance", async () => {
    expect(ctx.data.issuance.state).to.equal(ctx.constants.issuer.issuances.state.Opened);
    expect(ctx.data.issuance.guardian).to.equal(ctx.signers.issuer.guardian.address);
    expect(ctx.data.issuance.pool).to.equal(ctx.pool.address);
    expect(ctx.data.issuance.poolId).to.equal(ctx.data.poolId);
    expect(ctx.data.issuance.reserve).to.equal(ctx.params.issuer.reserve);
    expect(ctx.data.issuance.allocation).to.equal(ctx.params.issuer.allocation);
    expect(ctx.data.issuance.fee).to.equal(ctx.params.issuer.fee);
    expect(ctx.data.issuance.nbOfProposals).to.equal(0);
    expect(ctx.data.issuance.sERC20IsToken0).to.equal(ctx.pool.sERC20IsToken0);
  });
};

const itIssuesLikeExpected = (ctx, opts = {}) => {
  it("it collects issuance fee towards pool", async () => {
    expect(
      ctx.pool.sERC20IsToken0
        ? ctx.data.latestPoolBalances[0].sub(ctx.data.previousPoolBalances[0])
        : ctx.data.latestPoolBalances[1].sub(ctx.data.previousPoolBalances[1])
    ).to.equal(ctx.data.expectedReward);
    expect(
      ctx.pool.sERC20IsToken0
        ? ctx.data.latestPoolBalances[1].sub(ctx.data.previousPoolBalances[1])
        : ctx.data.latestPoolBalances[0].sub(ctx.data.previousPoolBalances[0])
    ).to.equal(ctx.data.expectedFee);
  });

  it("it collects protocol fee towards issuer's bank", async () => {
    expect(ctx.data.latestBankBalance.sub(ctx.data.previousBankBalance)).to.equal(ctx.data.expectedProtocolFee);
  });

  it("it collects proceeds towards issuance's guardian", async () => {
    opts.gas ??= false;

    const gasCost = opts.gas ? ctx.data.gasSpent : ethers.BigNumber.from("0");
    expect(ctx.data.latestGuardianBalance.sub(ctx.data.previousGuardianBalance)).to.equal(ctx.data.expectedGuardianProceeds.sub(gasCost));
  });

  it("it mints sERC20 issuance towards buyer", async () => {
    expect(ctx.data.latestRecipientBalance.sub(ctx.data.previousRecipientBalance)).to.equal(ctx.data.expectedAmount);
  });

  it("it mints sERC20 allocation towards splitter", async () => {
    expect(await ctx.sERC20.balanceOf(ctx.signers.issuer.splitter.address)).to.equal(
      ctx.params.issuer.allocation.mul(ctx.data.latestTotalSupply).div(ctx.constants.issuer.HUNDRED)
    );
  });

  it("it pokes pool's weights", async () => {
    expect(ctx.data.previousWeights[0]).to.not.equal(ctx.data.latestWeights[0]);
    expect(ctx.data.previousWeights[1]).to.not.equal(ctx.data.latestWeights[1]);
  });

  it("it emits a Issue event", async () => {
    opts.value = opts.excess ? ctx.data.effectiveValue : ctx.params.issuer.value;

    await expect(ctx.data.tx)
      .to.emit(ctx.issuer.contract, "Issue")
      .withArgs(ctx.sERC20.contract.address, ctx.signers.issuer.buyer.address, opts.value, ctx.data.expectedAmount);
  });
};

const itRejectsProposalLikeExpected = (ctx, opts = {}) => {
  it("it deletes proposal", async () => {
    expect(ctx.data.proposal.state).to.equal(ctx.constants.issuer.proposals.state.Null);
  });

  it("it pays back proposal's buyer", async () => {
    expect(ctx.data.latestBuyerBalance.sub(ctx.data.previousBuyerBalance)).to.equal(ctx.params.issuer.value);
  });

  it("it emits a RejectProposal event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.issuer.contract, "RejectProposal").withArgs(ctx.sERC20.address, ctx.data.proposalId);
  });
};

const itWithdrawsProposalLikeExpected = (ctx) => {
  it("it deletes proposal", async () => {
    expect(ctx.data.proposal.state).to.equal(ctx.constants.issuer.proposals.state.Null);
  });

  it("it pays back proposal's buyer", async () => {
    expect(ctx.data.latestBuyerBalance.sub(ctx.data.previousBuyerBalance)).to.equal(ctx.params.issuer.value.sub(ctx.data.gasSpent));
  });

  it("it emits a WithdrawProposal event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.issuer.contract, "WithdrawProposal").withArgs(ctx.sERC20.address, ctx.data.proposalId);
  });
};

module.exports = {
  itIssuesLikeExpected,
  itRegistersLikeExpected,
  itRejectsProposalLikeExpected,
  itWithdrawsProposalLikeExpected,
};
