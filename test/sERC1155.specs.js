const { expect } = require('chai');
const { waffle } = require('hardhat');
const { deployContract, createFixtureLoader } = require('ethereum-waffle');
const { initialize, mint, setup, spectralize, unlock, itWrapsLikeExpected, SERC20, SERC721, SERC1155 } = require('./helpers');

describe('sERC1155', () => {
  let tx,
    receipt,
    sERC20Base,
    sERC20,
    sERC721,
    sERC1155,
    tokenId,
    id,
    root,
    admin,
    owners = [],
    holders = [],
    roles = [],
    others = [];

  const SpectreState = {
    Null: 0,
    ERC721Locked: 1,
    ERC721Unlocked: 2,
  };
  const unwrappedURI = 'ipfs://Qm.../unwrapped';
  const tokenURI = 'ipfs://Qm.../';
  const name = 'My Awesome sERC20';
  const symbol = 'MAS';
  const cap = ethers.BigNumber.from('1000000000000000000000000');
  const balance = ethers.BigNumber.from('1000000000000000000');

  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    describe('» sERC20 base address is not the zero address', () => {
      before(async () => {
        await setup(this);
      });

      it('# it initializes sERC1155', async () => {
        expect(await this.contracts.sERC1155.sERC20Base()).to.equal(this.contracts.sERC20Base.address);
        expect(await this.contracts.sERC1155.unwrappedURI()).to.equal(this.constants.unwrappedURI);
      });

      it('# it sets up admin permissions', async () => {
        expect(await this.contracts.sERC1155.hasRole(await this.contracts.sERC1155.ADMIN_ROLE(), this.signers.root.address)).to.equal(true);
        expect(await this.contracts.sERC1155.getRoleAdmin(await this.contracts.sERC1155.ADMIN_ROLE())).to.equal(await this.contracts.sERC1155.ADMIN_ROLE());
      });
    });

    describe('» sERC20 base address is the zero address', () => {
      it('it reverts', async () => {
        await expect(deployContract(this.signers.root, this.artifacts.SERC1155, [ethers.constants.AddressZero, unwrappedURI])).to.be.revertedWith(
          'sERC1155: sERC20 base cannot be the zero address'
        );
      });
    });
  });

  describe('⇛ ERC165', () => {
    before(async () => {
      await setup(this);
    });

    it('it supports ERC165 interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x01ffc9a7)).to.equal(true);
    });

    it('it supports AccessControlEnumerable interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x5a05180f)).to.equal(true);
    });

    it('it supports ERC1155 interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0xd9b67a26)).to.equal(true);
    });

    it('it supports ERC1155MetadataURI interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x0e89341c)).to.equal(true);
    });

    it('it supports ERC721TokenReceiver interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x150b7a02)).to.equal(true);
    });

    it('it does not support ERC1155TokenReceiver interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x4e2312e0)).to.equal(false);
    });
  });

  describe('⇛ ERC1155', () => {
    describe('# balanceOf', () => {
      describe('» the queried address is the zero address', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
        });

        it('it reverts', async () => {
          await expect(this.contracts.sERC1155.balanceOf(ethers.constants.AddressZero, this.data.id)).to.be.revertedWith(
            'sERC1155: balance query for the zero address'
          );
        });
      });

      describe('» the queried address is not the zero address', () => {
        describe('» and the queried token type exists', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this, this.signers.holders[0].address, '1000');
            await mint.sERC20(this, this.signers.holders[1].address, '1500');
          });

          it('it returns the amount of tokens owned by the queried address', async () => {
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[0].address, this.data.id)).to.equal(1000);
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[1].address, this.data.id)).to.equal(1500);
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[2].address, this.data.id)).to.equal(0);
          });
        });

        describe('# but the queried token type does not exist', () => {
          before(async () => {
            await setup(this);
          });

          it('it returns zero', async () => {
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[0].address, '123456789')).to.equal(0);
          });
        });
      });
    });

    describe('# balanceOfBatch', () => {
      describe('» input arrays match', () => {
        describe('» and no queried address is the zero address', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            this.data.id1 = this.data.id;
            await mint.sERC20(this, this.signers.holders[0].address, '1000');
            await mint.sERC20(this, this.signers.holders[1].address, '1500');
            await mint.sERC721(this);
            await spectralize(this);
            this.data.id2 = this.data.id;
            await mint.sERC20(this, this.signers.holders[0].address, '700');
            await mint.sERC20(this, this.signers.holders[2].address, '2000');
          });

          it('it returns the amount of tokens owned by the queried addresses', async () => {
            const balances = await this.contracts.sERC1155.balanceOfBatch(
              [this.signers.holders[0].address, this.signers.holders[1].address, this.signers.holders[2].address],
              [this.data.id1, this.data.id2, '123456789']
            );

            expect(balances[0]).to.equal(1000);
            expect(balances[1]).to.equal(0);
            expect(balances[2]).to.equal(0);
          });
        });

        describe('» but one of the queried address is the zero address', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this, this.signers.holders[0].address, '10000');
          });

          it('it reverts', async () => {
            await expect(
              this.contracts.sERC1155.balanceOfBatch([this.signers.holders[0].address, ethers.constants.AddressZero], [this.data.id, this.data.id])
            ).to.be.revertedWith('sERC1155: balance query for the zero address');
          });
        });
      });

      describe('» input arrays do not match', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await mint.sERC20(this, this.signers.holders[0].address, '10000');
        });

        it('it reverts', async () => {
          await expect(
            this.contracts.sERC1155.balanceOfBatch(
              [this.signers.holders[0].address, this.signers.holders[1].address],
              [this.data.id, this.data.id, this.data.id]
            )
          ).to.be.revertedWith('sERC1155: accounts and ids length mismatch');
        });
      });
    });
  });

  describe('⇛ ERC1155MetadataURI', () => {
    describe('# uri', () => {
      describe('» token type exists', () => {
        describe('» and its associated ERC721 is still locked', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
          });

          it('it returns its associated ERC721 URI', async () => {
            expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal(this.constants.tokenURI);
          });
        });

        describe('» but its associated ERC721 is not locked anymore', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await unlock(this);
          });

          it('it returns the default unwrapped URI', async () => {
            expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal(this.constants.unwrappedURI);
          });
        });
      });

      describe('» token type does not exist', () => {
        before(async () => {
          await setup(this);
        });

        it('it returns a blank string', async () => {
          expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal('');
        });
      });
    });
  });

  describe('⇛ ERC721Receiver', () => {
    describe('# onERC721Received', () => {
      before(async () => {
        await setup(this);
        await spectralize(this, { transfer: true });
      });

      itWrapsLikeExpected(this);
    });
  });

  describe('# wrap', () => {
    describe('» ERC721 has never been spectralized', () => {
      describe('» and ERC721 is standard-compliant', () => {
        describe('» and sERC1155 has been approved to transfer NFT', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
          });

          itWrapsLikeExpected(this);
        });
        describe('» but sERC1155 has not been approved to transfer NFT', () => {
          before(async () => {
            await setup(this, { approve: false });
          });
          it('it reverts', async () => {
            await expect(
              this.contracts.sERC1155.spectralize(
                this.contracts.sERC721.address,
                this.data.tokenId,
                this.constants.name,
                this.constants.symbol,
                this.constants.cap,
                this.signers.admin.address,
                this.signers.owners[1].address
              )
            ).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
          });
        });
      });

      describe('» but NFT is not ERC721-compliant', () => {
        before(async () => {
          await setup(this);
        });

        it('it reverts', async () => {
          await expect(
            this.contracts.sERC1155.spectralize(
              this.signers.others[0].address,
              this.data.tokenId,
              this.constants.name,
              this.constants.symbol,
              this.constants.cap,
              this.signers.admin.address,
              this.signers.owners[1].address
            )
          ).to.be.revertedWith('sERC1155: ERC721 is not standard');
        });
      });
    });

    describe('» NFT has already been wrapped', () => {
      describe('» and NFT has been unwrapped since', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await unlock(this);
          this.contracts.sERC721 = this.contracts.sERC721.connect(this.signers.owners[2]);
          await (await this.contracts.sERC721.approve(this.contracts.sERC1155.address, this.data.tokenId)).wait();
          await spectralize(this);

          // tx = await sERC1155.spectralize(
          //   sERC721.address,
          //   tokenId,
          //   name,
          //   symbol,
          //   cap,
          //   roles.map((role) => role.address),
          //   owners[1].address
          // );
          // receipt = await tx.wait();
          // id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
          // sERC1155 = sERC1155.connect(owners[1]);
          // tx = await sERC1155['unwrap(uint256,address,bytes)'](id, owners[0].address, ethers.constants.HashZero);
          // receipt = await tx.wait();
          // sERC721 = sERC721.connect(owners[0]);
          //
          // tx = await sERC1155.spectralize(
          //   sERC721.address,
          //   tokenId,
          //   name,
          //   symbol,
          //   cap,
          //   roles.map((role) => role.address),
          //   owners[1].address
          // );
          // receipt = await tx.wait();
          // id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
        });
        itWrapsLikeExpected(this);
      });

      describe('» but NFT still is wrapped', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.owners[1]);
        });
        it('it reverts', async () => {
          await expect(
            this.contracts.sERC1155.spectralize(
              this.contracts.sERC721.address,
              this.data.tokenId,
              this.constants.name,
              this.constants.symbol,
              this.constants.cap,
              this.signers.admin.address,
              this.signers.owners[1].address
            )
          ).to.be.revertedWith('sERC1155: ERC721 is already locked');
        });
      });
    });
  });
});
