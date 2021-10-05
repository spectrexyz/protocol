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
    expect(ctx.data.latestGuardianBalance.sub(ctx.data.previousGuardianBalance)).to.equal(ctx.data.expectedGuardianProceeds);
  });

  it("it mints sERC20 issuance towards recipient", async () => {
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
    await expect(ctx.data.tx)
      .to.emit(ctx.issuer.contract, "Issue")
      .withArgs(ctx.sERC20.contract.address, ctx.signers.issuer.recipient.address, ctx.params.issuer.value, ctx.data.expectedAmount);
  });
};

module.exports = {
  itIssuesLikeExpected,
  itRegistersLikeExpected,
};