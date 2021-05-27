const SERC20 = require('../../artifacts/contracts/core/SERC20.sol/sERC20.json');
const SERC721 = require('../../artifacts/contracts/core/SERC721.sol/sERC721.json');
const SERC1155 = require('../../artifacts/contracts/core/SERC1155.sol/sERC1155.json');
const { deployContract } = require('ethereum-waffle');
const { expect } = require('chai');

const initialize = async (ctx) => {
  ctx.artifacts = {
    SERC20,
    SERC721,
    SERC1155,
  };

  ctx.constants = {
    SpectreState: {
      Null: 0,
      ERC721Locked: 1,
      ERC721Unlocked: 2,
    },
    unwrappedURI: 'ipfs://Qm.../unwrapped',
    tokenURI: 'ipfs://Qm.../',
    name: 'My Awesome sERC20',
    symbol: 'MAS',
    cap: ethers.BigNumber.from('1000000000000000000000000'),
  };

  ctx.contracts = {};

  ctx.data = {};

  ctx.signers = {
    holders: [],
    owners: [],
    others: [],
  };

  [
    ctx.signers.root,
    ctx.signers.admin,
    ctx.signers.owners[0],
    ctx.signers.owners[1],
    ctx.signers.owners[2],
    ctx.signers.holders[0],
    ctx.signers.holders[1],
    ctx.signers.holders[2],
    ...ctx.signers.others
  ] = await ethers.getSigners();
};

const mint = {
  sERC721: async (ctx, opts = { approve: true }) => {
    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.root);
    ctx.data.receipt = await (await ctx.contracts.sERC721.mint(ctx.signers.owners[0].address, ctx.constants.tokenURI)).wait();
    ctx.data.tokenId = ctx.data.receipt.events[0].args.tokenId.toString();

    if (opts.approve) {
      ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
      await (await ctx.contracts.sERC721.approve(ctx.contracts.sERC1155.address, ctx.data.tokenId)).wait();
    }
  },
  sERC20: async (ctx, address, amount) => {
    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.admin);

    await ctx.contracts.sERC20.mint(address, amount);
  },
};

const setup = async (ctx, opts = { approve: true }) => {
  ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);
  ctx.contracts.sERC721 = await deployContract(ctx.signers.root, SERC721, ['sERC721 Collection', 'sERC721']);
  ctx.contracts.sERC1155 = await deployContract(ctx.signers.root, SERC1155, [ctx.contracts.sERC20Base.address, ctx.constants.unwrappedURI]);

  ctx.data.receipt = await (await ctx.contracts.sERC721.mint(ctx.signers.owners[0].address, ctx.constants.tokenURI)).wait();
  ctx.data.tokenId = ctx.data.receipt.events[0].args.tokenId.toString();

  if (opts.approve) {
    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
    await (await ctx.contracts.sERC721.approve(ctx.contracts.sERC1155.address, ctx.data.tokenId)).wait();
  }
};

const spectralize = async (ctx, opts = { transfer: false }) => {
  if (opts.transfer) {
    ctx.data.tx = await ctx.contracts.sERC721['safeTransferFrom(address,address,uint256,bytes)'](
      ctx.signers.owners[0].address,
      ctx.contracts.sERC1155.address,
      ctx.data.tokenId,
      ethers.utils.concat([
        ethers.utils.formatBytes32String(ctx.constants.name),
        ethers.utils.formatBytes32String(ctx.constants.symbol),
        ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
        ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.admin.address]),
        ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
      ])
    );
    ctx.data.receipt = await ctx.data.tx.wait();
    ctx.data.id = (await ctx.contracts.sERC1155.queryFilter(ctx.contracts.sERC1155.filters.Spectralize())).filter(
      (event) => event.event === 'Spectralize'
    )[0].args.id;
    ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
  } else {
    ctx.data.tx = await ctx.contracts.sERC1155.spectralize(
      ctx.contracts.sERC721.address,
      ctx.data.tokenId,
      ctx.constants.name,
      ctx.constants.symbol,
      ctx.constants.cap,
      ctx.signers.admin.address,
      ctx.signers.owners[1].address
    );
    ctx.data.receipt = await ctx.data.tx.wait();
    ctx.data.id = ctx.data.receipt.events.filter((event) => event.event === 'Spectralize')[0].args.id;
    ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
  }
  ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.admin);
  await await ctx.contracts.sERC20.grantRole(await ctx.contracts.sERC20.MINTER_ROLE(), ctx.signers.admin.address);
};

const unlock = async (ctx) => {
  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(ctx.signers.owners[1]);
  ctx.data.tx = await ctx.contracts.sERC1155['unlock(uint256,address,bytes)'](ctx.data.id, ctx.signers.owners[2].address, ethers.constants.HashZero);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const itWrapsLikeExpected = (ctx) => {
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

  it('it registers spectre', async () => {
    const spectre = await ctx.contracts.sERC1155['spectreOf(uint256)'](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.SpectreState.ERC721Locked);
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

module.exports = {
  initialize,
  mint,
  setup,
  spectralize,
  unlock,
  itWrapsLikeExpected,
  SERC20,
  SERC721,
  SERC1155,
};
