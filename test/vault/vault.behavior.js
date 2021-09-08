const { expect } = require("chai");

const itSafeTransfersFromLikeExpected = (ctx, opts = {}) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.sERC20.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount));
    expect(await ctx.vault.balanceOf(ctx.signers.holders[0].address, ctx.data.id)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount));
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.sERC20.balanceOf(opts.to.address)).to.equal(ctx.params.vault.amount);
    expect(await ctx.vault.balanceOf(opts.to.address, ctx.data.id)).to.equal(ctx.params.vault.amount);
  });

  it("it emits one TransferSingle event", async () => {
    opts.operator = opts.operator ? ctx.signers.vault.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === "TransferSingle").length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.vault, "TransferSingle")
      .withArgs(opts.operator.address, ctx.signers.holders[0].address, opts.to.address, ctx.data.id, ctx.params.vault.amount);
  });
};

const itSafeBatchTransfersFromLikeExpected = (ctx, opts = { operator: undefined }) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.data.sERC201.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount1));
    expect(await ctx.data.sERC202.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount2));
    expect(await ctx.vault.balanceOf(ctx.signers.holders[0].address, ctx.data.id1)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount1));
    expect(await ctx.vault.balanceOf(ctx.signers.holders[0].address, ctx.data.id2)).to.equal(ctx.params.sERC20.balance.sub(ctx.params.vault.amount2));
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.data.sERC201.balanceOf(opts.to.address)).to.equal(ctx.params.vault.amount1);
    expect(await ctx.data.sERC202.balanceOf(opts.to.address)).to.equal(ctx.params.vault.amount2);
    expect(await ctx.vault.balanceOf(opts.to.address, ctx.data.id1)).to.equal(ctx.params.vault.amount1);
    expect(await ctx.vault.balanceOf(opts.to.address, ctx.data.id2)).to.equal(ctx.params.vault.amount2);
  });

  it("it emits one TransferBatch event", async () => {
    opts.operator = opts.operator ? ctx.signers.vault.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === "TransferBatch").length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.vault, "TransferBatch")
      .withArgs(
        opts.operator.address,
        ctx.signers.holders[0].address,
        opts.to.address,
        [ctx.data.id1, ctx.data.id2],
        [ctx.params.vault.amount1, ctx.params.vault.amount2]
      );
  });
};

const itFractionalizesLikeExpected = (ctx, opts = {}) => {
  it("it locks ERC721", async () => {
    expect(await ctx.vault.isLocked(ctx.sERC721.address, ctx.data.tokenId)).to.equal(true);
    expect(await ctx.vault.tokenTypeOf(ctx.sERC721.address, ctx.data.tokenId)).to.equal(ctx.data.id);
    expect(await ctx.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.vault.address);
  });

  it("it clones and initializes sERC20", async () => {
    expect(await ctx.sERC20.name()).to.equal(ctx.params.sERC20.name);
    expect(await ctx.sERC20.symbol()).to.equal(ctx.params.sERC20.symbol);
    expect(await ctx.sERC20.cap()).to.equal(ctx.params.sERC20.cap);
    expect(await ctx.sERC20.hasRole(ctx.constants.sERC20.DEFAULT_ADMIN_ROLE, ctx.signers.sERC20.admin.address)).to.equal(true);
  });

  it("it emits a TransferSingle event as per the ERC1155 standard", async () => {
    opts.operator = opts.transfer ? ctx.contracts.sERC721 : ctx.signers.root;

    await expect(ctx.data.tx2)
      .to.emit(ctx.contracts.vault, "TransferSingle")
      .withArgs(opts.operator.address, ethers.constants.AddressZero, ethers.constants.AddressZero, ctx.data.id, 0);
  });

  it("it registers spectre", async () => {
    const spectre = await ctx.contracts.vault["spectreOf(uint256)"](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.vault.spectres.state.Locked);
    expect(spectre.collection).to.equal(ctx.sERC721.address);
    expect(spectre.tokenId).to.equal(ctx.data.tokenId);
    expect(spectre.broker).to.equal(ctx.signers.vault.broker.address);
  });

  it("it emits a Fractionalize event", async () => {
    await expect(ctx.data.tx2)
      .to.emit(ctx.vault.contract, "Fractionalize")
      .withArgs(ctx.sERC721.address, ctx.data.tokenId, ctx.data.id, ctx.sERC20.address, ctx.signers.vault.broker.address);
  });
};

const itUnlocksLikeExpected = (ctx, opts = {}) => {
  it("it updates spectre state", async () => {
    const spectre = await ctx.contracts.vault["spectreOf(uint256)"](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.vault.spectres.state.Unlocked);
  });

  it("it re-initializes NFT's token type", async () => {
    expect(await ctx.contracts.vault.tokenTypeOf(ctx.sERC721.address, ctx.data.id)).to.equal(0);
  });

  it("it emits an Unlock event", async () => {
    await expect(ctx.data.tx).to.emit(ctx.vault.contract, "Unlock").withArgs(ctx.data.id, ctx.signers.sERC721.owners[1].address);
  });

  it("it transfers NFT", async () => {
    expect(await ctx.contracts.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.signers.sERC721.owners[1].address);
  });
};

module.exports = {
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itFractionalizesLikeExpected,
  itUnlocksLikeExpected,
};
