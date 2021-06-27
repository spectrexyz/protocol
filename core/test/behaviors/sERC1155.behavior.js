const { expect } = require('chai');

const itSafeTransfersFromLikeExpected = (ctx, opts = {}) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.contracts.sERC20.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.params.sERC1155.amount));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id)).to.equal(ctx.constants.balance.sub(ctx.params.sERC1155.amount));
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.contracts.sERC20.balanceOf(opts.to.address)).to.equal(ctx.params.sERC1155.amount);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id)).to.equal(ctx.params.sERC1155.amount);
  });

  it('it emits one TransferSingle event', async () => {
    opts.operator = opts.operator ? ctx.signers.sERC1155.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferSingle').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferSingle')
      .withArgs(opts.operator.address, ctx.signers.holders[0].address, opts.to.address, ctx.data.id, ctx.params.sERC1155.amount);
  });
};

const itSafeBatchTransfersFromLikeExpected = (ctx, opts = { operator: undefined }) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.data.sERC201.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.params.sERC1155.amount1));
    expect(await ctx.data.sERC202.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.params.sERC1155.amount2));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id1)).to.equal(
      ctx.constants.balance.sub(ctx.params.sERC1155.amount1)
    );
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id2)).to.equal(
      ctx.constants.balance.sub(ctx.params.sERC1155.amount2)
    );
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.data.sERC201.balanceOf(opts.to.address)).to.equal(ctx.params.sERC1155.amount1);
    expect(await ctx.data.sERC202.balanceOf(opts.to.address)).to.equal(ctx.params.sERC1155.amount2);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id1)).to.equal(ctx.params.sERC1155.amount1);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id2)).to.equal(ctx.params.sERC1155.amount2);
  });

  it('it emits one TransferBatch event', async () => {
    opts.operator = opts.operator ? ctx.signers.sERC1155.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferBatch').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferBatch')
      .withArgs(
        opts.operator.address,
        ctx.signers.holders[0].address,
        opts.to.address,
        [ctx.data.id1, ctx.data.id2],
        [ctx.params.sERC1155.amount1, ctx.params.sERC1155.amount2]
      );
  });
};

const itSpectralizesLikeExpected = (ctx, opts = {}) => {
  it('it locks ERC721', async () => {
    expect(await ctx.contracts.sERC1155.isLocked(ctx.contracts.sERC721.address, ctx.data.tokenId)).to.equal(true);
    expect(await ctx.contracts.sERC1155.lockOf(ctx.contracts.sERC721.address, ctx.data.tokenId)).to.equal(ctx.data.id);
    expect(await ctx.contracts.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.contracts.sERC1155.address);
  });

  it('it emits a Lock event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Lock')
      .withArgs(ctx.data.id);
  });

  it('it clones and initializes sERC20', async () => {
    expect(await ctx.contracts.sERC20.name()).to.equal(ctx.constants.name);
    expect(await ctx.contracts.sERC20.symbol()).to.equal(ctx.constants.symbol);
    expect(await ctx.contracts.sERC20.cap()).to.equal(ctx.constants.cap);
    expect(await ctx.contracts.sERC20.hasRole(await ctx.contracts.sERC20.DEFAULT_ADMIN_ROLE(), ctx.signers.admin.address)).to.equal(true);
  });

  it('it emits a TransferSingle event as per the ERC1155 standard', async () => {
    opts.operator = opts.transfer ? ctx.contracts.sERC721 : ctx.signers.root;

    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferSingle')
      .withArgs(opts.operator.address, ethers.constants.AddressZero, ethers.constants.AddressZero, ctx.data.id, 0);
  });

  it('it registers spectre', async () => {
    const spectre = await ctx.contracts.sERC1155['spectreOf(uint256)'](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.SpectreState.Locked);
    expect(spectre.collection).to.equal(ctx.contracts.sERC721.address);
    expect(spectre.tokenId).to.equal(ctx.data.tokenId);
    expect(spectre.guardian).to.equal(ctx.signers.owners[1].address);
  });

  it('it emits a Spectralize event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Spectralize')
      .withArgs(ctx.contracts.sERC721.address, ctx.data.tokenId, ctx.data.id, ctx.contracts.sERC20.address, ctx.signers.owners[1].address);
  });
};

const itUnlocksLikeExpected = (ctx, opts = {}) => {
  it('it updates spectre state', async () => {
    const spectre = await ctx.contracts.sERC1155['spectreOf(uint256)'](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.SpectreState.Unlocked);
  });

  it('it updates NFT lock', async () => {
    expect(await ctx.contracts.sERC1155.lockOf(ctx.contracts.sERC721.address, ctx.data.id)).to.equal(0);
  });

  it('it emits an Unlock event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Unlock')
      .withArgs(ctx.data.id, ctx.signers.owners[2].address);
  });

  it('it transfers NFT', async () => {
    expect(await ctx.contracts.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.signers.owners[2].address);
  });
};

module.exports = {
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  itUnlocksLikeExpected,
};
