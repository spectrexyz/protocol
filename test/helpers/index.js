const SERC20 = require('../../artifacts/contracts/core/SERC20.sol/sERC20.json');
const SERC721 = require('../../artifacts/contracts/core/SERC721.sol/sERC721.json');
const SERC1155 = require('../../artifacts/contracts/core/SERC1155.sol/sERC1155.json');
const AllocationSplitter = require('../../artifacts/contracts/utils/AllocationSplitter.sol/AllocationSplitter.json');

const ERC1155Receiver = require('../../artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json');
const CloneFactory = require('../../artifacts/contracts/test/CloneFactory.sol/CloneFactory.json');

const { deployContract } = require('ethereum-waffle');
const { expect } = require('chai');

const RECEIVER_SINGLE_MAGIC_VALUE = '0xf23a6e61';
const RECEIVER_BATCH_MAGIC_VALUE = '0xbc197c81';
const DERRIDA = '0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce';

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
    cap: ethers.BigNumber.from('1000000000000000'),
    balance: ethers.BigNumber.from('100000000'),
    amount: ethers.BigNumber.from('1000'),
    amount1: ethers.BigNumber.from('700'),
    amount2: ethers.BigNumber.from('1250'),
    shares: [ethers.BigNumber.from('300000000000000000'), ethers.BigNumber.from('100000000000000000'), ethers.BigNumber.from('600000000000000000')],
  };

  ctx.contracts = {};

  ctx.data = {};

  ctx.signers = {
    holders: [],
    owners: [],
    beneficiaries: [],
    others: [],
  };

  [
    ctx.signers.root,
    ctx.signers.admin,
    ctx.signers.operator,
    ctx.signers.owners[0],
    ctx.signers.owners[1],
    ctx.signers.owners[2],
    ctx.signers.holders[0],
    ctx.signers.holders[1],
    ctx.signers.holders[2],
    ctx.signers.beneficiaries[0],
    ctx.signers.beneficiaries[1],
    ctx.signers.beneficiaries[2],
    ...ctx.signers.others
  ] = await ethers.getSigners();
};

const allocate = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.admin;
  opts.beneficiaries ??= [ctx.signers.beneficiaries[0], ctx.signers.beneficiaries[1], ctx.signers.beneficiaries[2]];
  opts.shares ??= [ctx.constants.shares[0], ctx.constants.shares[1], ctx.constants.shares[2]];

  ctx.contracts.AllocationSplitter = ctx.contracts.AllocationSplitter.connect(opts.from);
  ctx.data.tx = await ctx.contracts.AllocationSplitter.allocate(
    ctx.contracts.sERC20.address,
    opts.beneficiaries.map((beneficiary) => beneficiary.address),
    opts.shares
  );
  ctx.data.receipt = await ctx.data.tx.wait();
};

const mock = {
  deploy: {
    ERC1155Receiver: async (ctx, opts = {}) => {
      opts.singleValue ??= RECEIVER_SINGLE_MAGIC_VALUE;
      opts.singleReverts ??= false;
      opts.batchValue ??= RECEIVER_BATCH_MAGIC_VALUE;
      opts.batchReverts ??= false;

      ctx.contracts.ERC1155Receiver = await deployContract(ctx.signers.root, ERC1155Receiver, [
        opts.singleValue,
        opts.singleReverts,
        opts.batchValue,
        opts.batchReverts,
      ]);
    },
  },
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
  sERC20: async (ctx, opts = {}) => {
    opts.to ??= ctx.signers.holders[0];
    opts.amount ??= ctx.constants.balance;

    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.admin);
    await ctx.contracts.sERC20.mint(opts.to.address, opts.amount);
  },
};

const setApprovalForAll = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.holders[0];
  opts.operator ??= ctx.signers.operator;
  opts.approve ??= true;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.from);
  ctx.data.tx = await ctx.contracts.sERC1155.setApprovalForAll(opts.operator.address, opts.approve);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const safeTransferFrom = async (ctx, opts = {}) => {
  opts.from = opts.from ? opts.from : ctx.signers.holders[0];
  opts.operator = opts.operator ? opts.operator : opts.from;
  opts.to = opts.to ? opts.to : ctx.signers.others[0];
  opts.id = opts.id ? opts.id : ctx.data.id;
  opts.amount = opts.amount ? opts.amount : ctx.constants.amount;
  opts.data = opts.data ? opts.data : ethers.constants.HashZero;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.operator);
  ctx.data.tx = await ctx.contracts.sERC1155.safeTransferFrom(opts.from.address, opts.to.address, opts.id, opts.amount, opts.data);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const safeBatchTransferFrom = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.holders[0];
  opts.operator ??= opts.from;
  opts.to ??= ctx.signers.others[0];
  opts.ids ??= [ctx.data.id1, ctx.data.id2];
  opts.amounts ??= [ctx.constants.amount1, ctx.constants.amount2];
  opts.data ??= ethers.constants.HashZero;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.operator);
  ctx.data.tx = await ctx.contracts.sERC1155.safeBatchTransferFrom(opts.from.address, opts.to.address, opts.ids, opts.amounts, opts.data);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const setup = async (ctx, opts = { approve: true }) => {
  ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);
  ctx.contracts.sERC721 = await deployContract(ctx.signers.root, SERC721, ['sERC721 Collection', 'sERC721']);
  ctx.contracts.sERC1155 = await deployContract(ctx.signers.root, SERC1155, [ctx.contracts.sERC20Base.address, ctx.constants.unwrappedURI]);
  ctx.contracts.AllocationSplitter = await deployContract(ctx.signers.root, AllocationSplitter, [ctx.signers.admin.address]);

  ctx.data.receipt = await (await ctx.contracts.sERC721.mint(ctx.signers.owners[0].address, ctx.constants.tokenURI)).wait();
  ctx.data.tokenId = ctx.data.receipt.events[0].args.tokenId.toString();

  if (opts.approve) {
    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
    await (await ctx.contracts.sERC721.approve(ctx.contracts.sERC1155.address, ctx.data.tokenId)).wait();
  }
};

const spectralize = async (ctx, opts = {}) => {
  opts.transfer ??= false;
  opts.derrida ??= DERRIDA;
  opts.short ??= false;

  if (opts.transfer) {
    const data = opts.short
      ? ethers.utils.concat([
          ethers.utils.formatBytes32String(ctx.constants.name),
          ethers.utils.formatBytes32String(ctx.constants.symbol),
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
          ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.admin.address]),
          ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
        ])
      : ethers.utils.concat([
          ethers.utils.formatBytes32String(ctx.constants.name),
          ethers.utils.formatBytes32String(ctx.constants.symbol),
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
          ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.admin.address]),
          ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
          ethers.utils.defaultAbiCoder.encode(['bytes32'], [opts.derrida]),
        ]);

    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
    ctx.data.tx = await ctx.contracts.sERC721['safeTransferFrom(address,address,uint256,bytes)'](
      ctx.signers.owners[0].address,
      ctx.contracts.sERC1155.address,
      ctx.data.tokenId,
      data
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

const transfer = {
  sERC20: async (ctx, opts = {}) => {
    opts.from ??= ctx.signers.holders[0];
    opts.to ??= ctx.contracts.AllocationSplitter;
    opts.amount ??= ctx.constants.amount;

    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(opts.from);
    ctx.data.tx = await ctx.contracts.sERC20.transfer(opts.to.address, opts.amount);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
};

const unlock = async (ctx) => {
  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(ctx.signers.owners[1]);
  ctx.data.tx = await ctx.contracts.sERC1155['unlock(uint256,address,bytes)'](ctx.data.id, ctx.signers.owners[2].address, ethers.constants.HashZero);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const withdraw = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.beneficiaries[0];

  ctx.contracts.AllocationSplitter = ctx.contracts.AllocationSplitter.connect(opts.from);
  ctx.data.tx = await ctx.contracts.AllocationSplitter.withdraw(ctx.contracts.sERC20.address);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const itSafeTransfersFromLikeExpected = (ctx, opts = { operator: undefined }) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.contracts.sERC20.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id)).to.equal(ctx.constants.balance.sub(ctx.constants.amount));
  });

  it("it credits receiver's balance", async () => {
    expect(await ctx.contracts.sERC20.balanceOf(ctx.signers.others[0].address)).to.equal(ctx.constants.amount);
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.others[0].address, ctx.data.id)).to.equal(ctx.constants.amount);
  });

  it('it emits one TransferSingle event', async () => {
    opts.operator = opts.operator ? ctx.signers.operator.address : ctx.signers.holders[0].address;

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferSingle').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferSingle')
      .withArgs(opts.operator, ctx.signers.holders[0].address, ctx.signers.others[0].address, ctx.data.id, ctx.constants.amount);
  });
};

const itSafeBatchTransfersFromLikeExpected = (ctx, opts = { operator: undefined }) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.data.sERC201.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount1));
    expect(await ctx.data.sERC202.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount2));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id1)).to.equal(ctx.constants.balance.sub(ctx.constants.amount1));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id2)).to.equal(ctx.constants.balance.sub(ctx.constants.amount2));
  });

  it("it credits receiver's balance", async () => {
    expect(await ctx.data.sERC201.balanceOf(ctx.signers.others[0].address)).to.equal(ctx.constants.amount1);
    expect(await ctx.data.sERC202.balanceOf(ctx.signers.others[0].address)).to.equal(ctx.constants.amount2);
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.others[0].address, ctx.data.id1)).to.equal(ctx.constants.amount1);
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.others[0].address, ctx.data.id2)).to.equal(ctx.constants.amount2);
  });

  it('it emits one TransferSBatch event', async () => {
    opts.operator = opts.operator ? ctx.signers.operator.address : ctx.signers.holders[0].address;

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferBatch').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferBatch')
      .withArgs(
        opts.operator,
        ctx.signers.holders[0].address,
        ctx.signers.others[0].address,
        [ctx.data.id1, ctx.data.id2],
        [ctx.constants.amount1, ctx.constants.amount2]
      );
  });
};

const itSpectralizesLikeExpected = (ctx) => {
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
  allocate,
  mint,
  mock,
  setApprovalForAll,
  safeBatchTransferFrom,
  safeTransferFrom,
  setup,
  spectralize,
  transfer,
  unlock,
  withdraw,
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  CloneFactory,
  AllocationSplitter,
  SERC20,
  SERC721,
  SERC1155,
};
