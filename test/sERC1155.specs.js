const { expect } = require('chai');
const { deployContract } = require('ethereum-waffle');
const { SERC20, SERC721, SERC1155 } = require('./helpers');

describe.only('sERC1155', () => {
  let tx,
    receipt,
    sERC721,
    sERC1155,
    sERC20Base,
    tokenId,
    id,
    admin,
    owners = [],
    holders = [],
    user,
    others;

  const UNWRAPPED_URI = 'ipfs://Qm.../unwrapped';
  const TOKEN_URI = 'ipfs://Qm.../';
  const NAME = 'My Awesome sERC20';
  const SYMBOL = 'MAS';
  const CAP = ethers.BigNumber.from('1000000000000000000000000');
  const ROLES = [
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
  ];

  const setup = async (opts = { approve: true }) => {
    sERC20Base = await deployContract(admin, SERC20);
    sERC721 = await deployContract(admin, SERC721, ['sERC721 Collection', 'sERC721']);
    sERC1155 = await deployContract(admin, SERC1155, [sERC20Base.address, UNWRAPPED_URI]);
    receipt = await (await sERC721.mint(owners[0].address, TOKEN_URI)).wait();

    tokenId = receipt.events[0].args.tokenId.toString();

    if (opts.approve) {
      sERC721 = sERC721.connect(owners[0]);
      await (await sERC721.approve(sERC1155.address, tokenId)).wait();
    }
  };

  before(async () => {
    [admin, owners[0], owners[1], holders[0], holders[1], ...others] = await ethers.getSigners();
  });

  describe('# wrap', () => {
    describe('» NFT have never been wrapped', () => {
      describe('» and NTF is ERC721 compliant', () => {
        describe('» and sERC1155 has been approved to transfer NFT', () => {
          before(async () => {
            await setup();
            tx = await sERC1155.wrap(sERC721.address, tokenId, NAME, SYMBOL, CAP, ROLES, owners[1].address);
            receipt = await tx.wait();
            id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
          });

          it('it wraps NFT', async () => {
            const NFT = await sERC1155['NFTOf(uint256)'](id);

            expect(NFT.collection).to.equal(sERC721.address);
            expect(NFT.tokenId).to.equal(tokenId);
            expect(NFT.owner).to.equal(owners[1].address);
          });

          it('it emits a Wrap event', async () => {
            const sERC20 = await sERC1155.sERC20Of(id);
            await expect(tx)
              .to.emit(sERC1155, 'Wrap')
              .withArgs(sERC721.address, tokenId, id, sERC20, owners[1].address);
          });
        });
        describe('» but sERC1155 has not been approved to transfer NFT', () => {
          before(async () => {
            await setup({ approve: false });
          });

          it('it reverts', async () => {
            await expect(sERC1155.wrap(sERC721.address, tokenId, NAME, SYMBOL, CAP, ROLES, owners[1].address)).to.be.revertedWith(
              'ERC721: transfer caller is not owner nor approved'
            );
          });
        });
      });
      describe('» but NTF is not ERC721 compliant', () => {});
    });
    describe('» NFT has already been wrapped', () => {
      describe('» and NFT has been unwrapped since', () => {});
      describe('» but NFT still is wrapped', () => {});
    });
  });
});
