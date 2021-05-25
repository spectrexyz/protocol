const { expect } = require('chai');
const { waffle } = require('hardhat');
const { deployContract } = require('ethereum-waffle');
const { SERC20, SERC721, SERC1155 } = require('./helpers');

describe.only('sERC1155', () => {
  let tx,
    receipt,
    sERC20Base,
    sERC20,
    sERC721,
    sERC1155,
    tokenId,
    id,
    admin,
    owners = [],
    holders = [],
    roles = [],
    others = [];

  const WrappingState = {
    Void: 0,
    Wrapped: 1,
    Unwrapped: 2,
  };
  const unwrappedURI = 'ipfs://Qm.../unwrapped';
  const tokenURI = 'ipfs://Qm.../';
  const name = 'My Awesome sERC20';
  const symbol = 'MAS';
  const cap = ethers.BigNumber.from('1000000000000000000000000');
  const balance = ethers.BigNumber.from('1000000000000000000');

  const setup = async (opts = { approve: true }) => {
    sERC20Base = await deployContract(admin, SERC20);
    sERC721 = await deployContract(admin, SERC721, ['sERC721 Collection', 'sERC721']);
    sERC1155 = await deployContract(admin, SERC1155, [sERC20Base.address, unwrappedURI]);
    receipt = await (await sERC721.mint(owners[0].address, tokenURI)).wait();

    tokenId = receipt.events[0].args.tokenId.toString();

    if (opts.approve) {
      sERC721 = sERC721.connect(owners[0]);
      await (await sERC721.approve(sERC1155.address, tokenId)).wait();
    }
  };

  const wrap = async (opts = { transfer: false }) => {
    if (opts.transfer) {
      tx = await sERC721['safeTransferFrom(address,address,uint256,bytes)'](
        owners[0].address,
        sERC1155.address,
        tokenId,
        ethers.utils.concat([
          ethers.utils.formatBytes32String(name),
          ethers.utils.formatBytes32String(symbol),
          ethers.utils.defaultAbiCoder.encode(['uint256'], [cap]),
          ethers.utils.concat(roles.map((role) => ethers.utils.defaultAbiCoder.encode(['address'], [role.address]))),
          ethers.utils.defaultAbiCoder.encode(['address'], [owners[1].address]),
        ])
      );
      receipt = await tx.wait();
      id = (await sERC1155.queryFilter(sERC1155.filters.Wrap())).filter((event) => event.event === 'Wrap')[0].args.id;
      sERC20 = new ethers.Contract(await sERC1155.sERC20Of(id), SERC20.abi, admin);
    } else {
      tx = await sERC1155.wrap(
        sERC721.address,
        tokenId,
        name,
        symbol,
        cap,
        roles.map((role) => role.address),
        owners[1].address
      );
      receipt = await tx.wait();
      id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
      sERC20 = new ethers.Contract(await sERC1155.sERC20Of(id), SERC20.abi, admin);
    }
  };

  const mint = async (addresses, amounts) => {
    sERC20 = sERC20.connect(roles[0]);

    for (let i = 0; i < addresses.length; i++) {
      await sERC20.mint(addresses[i], amounts[i]);
    }
  };

  const unwrap = async () => {
    sERC1155 = sERC1155.connect(owners[1]);
    tx = await sERC1155['unwrap(uint256,address,bytes)'](id, owners[2].address, ethers.constants.HashZero);
    receipt = await tx.wait();
  };

  const itWrapsLikeExpected = () => {
    it('it takes ownership of ERC721', async () => {
      expect(await sERC721.ownerOf(tokenId)).to.equal(sERC1155.address);
    });

    it('it clones and initializes sERC20', async () => {
      expect(await sERC20.name()).to.equal(name);
      expect(await sERC20.symbol()).to.equal(symbol);
      expect(await sERC20.cap()).to.equal(cap);
      expect(await sERC20.hasRole(await sERC20.MINTER_ROLE(), roles[0].address)).to.equal(true);
      expect(await sERC20.hasRole(await sERC20.PAUSER_ROLE(), roles[1].address)).to.equal(true);
      expect(await sERC20.hasRole(await sERC20.SNAPSHOT_ROLE(), roles[2].address)).to.equal(true);
      expect(await sERC20.hasRole(await sERC20.MINTER_ADMIN_ROLE(), roles[3].address)).to.equal(true);
      expect(await sERC20.hasRole(await sERC20.PAUSER_ADMIN_ROLE(), roles[4].address)).to.equal(true);
      expect(await sERC20.hasRole(await sERC20.SNAPSHOT_ADMIN_ROLE(), roles[5].address)).to.equal(true);
    });

    it("it registers sERC20's wrapping", async () => {
      const wrapping = await sERC1155['wrappingOf(uint256)'](id);

      expect(wrapping.state).to.equal(WrappingState.Wrapped);
      expect(wrapping.collection).to.equal(sERC721.address);
      expect(wrapping.tokenId).to.equal(tokenId);
      expect(wrapping.owner).to.equal(owners[1].address);
    });

    it('it emits a Wrap event', async () => {
      const wrapping = await sERC1155['wrappingOf(uint256)'](id);
      const sERC20Address = await sERC1155.sERC20Of(id);

      await expect(tx)
        .to.emit(sERC1155, 'Wrap')
        .withArgs(wrapping.collection, tokenId, id, sERC20Address, owners[1].address);
    });
  };

  before(async () => {
    [
      admin,
      owners[0],
      owners[1],
      owners[2],
      holders[0],
      holders[1],
      holders[2],
      roles[0],
      roles[1],
      roles[2],
      roles[3],
      roles[4],
      roles[5],
      ...others
    ] = await ethers.getSigners();
  });

  describe('# constructor', () => {
    describe('» sERC20 base address is not the zero address', () => {
      before(async () => {
        await setup();
      });

      it('# it initializes sERC1155', async () => {
        expect(await sERC1155.sERC20Base()).to.equal(sERC20Base.address);
        expect(await sERC1155.unwrappedURI()).to.equal(unwrappedURI);
      });

      it('# it sets up admin permissions', async () => {
        expect(await sERC1155.hasRole(await sERC1155.ADMIN_ROLE(), admin.address)).to.equal(true);
        expect(await sERC1155.getRoleAdmin(await sERC1155.ADMIN_ROLE())).to.equal(await sERC1155.ADMIN_ROLE());
      });
    });

    describe('» sERC20 base address is the zero address', () => {
      it('it reverts', async () => {
        await expect(deployContract(admin, SERC1155, [ethers.constants.AddressZero, unwrappedURI])).to.be.revertedWith(
          'sERC1155: sERC20 base cannot be the zero address'
        );
      });
    });
  });

  describe('ERC165', () => {
    before(async () => {
      await setup();
    });

    it('it supports ERC165 interface', async () => {
      expect(await sERC1155.supportsInterface(0x01ffc9a7)).to.equal(true);
    });

    it('it supports AccessControlEnumerable interface', async () => {
      expect(await sERC1155.supportsInterface(0x5a05180f)).to.equal(true);
    });

    it('it supports ERC1155 interface', async () => {
      expect(await sERC1155.supportsInterface(0xd9b67a26)).to.equal(true);
    });

    it('it supports ERC1155MetadataURI interface', async () => {
      expect(await sERC1155.supportsInterface(0x0e89341c)).to.equal(true);
    });

    it('it supports ERC721TokenReceiver interface', async () => {
      expect(await sERC1155.supportsInterface(0x150b7a02)).to.equal(true);
    });

    it('it does not support ERC1155TokenReceiver interface', async () => {
      expect(await sERC1155.supportsInterface(0x4e2312e0)).to.equal(false);
    });
  });

  describe.only('ERC1155', () => {
    describe('# balanceOf', () => {
      describe('» the queried address is the zero address', () => {
        before(async () => {
          await setup();
          await wrap();
        });

        it('it reverts', async () => {
          await expect(sERC1155.balanceOf(ethers.constants.AddressZero, id)).to.be.revertedWith('sERC1155: balance query for the zero address');
        });
      });

      describe('» the queried address is not the zero address', () => {
        describe('» and the queried token type exists', () => {
          describe('» and its associated ERC721 is still wrapped', () => {
            before(async () => {
              await setup();
              await wrap();
              await mint([holders[0].address, holders[1].address], ['1000', '1500']);
            });

            it('it returns the amount of tokens owned by the queried address', async () => {
              expect(await sERC1155.balanceOf(holders[0].address, id)).to.equal(1000);
              expect(await sERC1155.balanceOf(holders[1].address, id)).to.equal(1500);
              expect(await sERC1155.balanceOf(holders[2].address, id)).to.equal(0);
            });
          });

          describe('» but its associated ERC721 is not wrapped anymore', () => {
            before(async () => {
              await setup();
              await wrap();
              await mint([holders[0].address, holders[1].address], ['1000', '1500']);
              await unwrap();
            });

            it('it returns the amount of tokens owned by the queried address', async () => {
              expect(await sERC1155.balanceOf(holders[0].address, id)).to.equal(1000);
              expect(await sERC1155.balanceOf(holders[1].address, id)).to.equal(1500);
              expect(await sERC1155.balanceOf(holders[2].address, id)).to.equal(0);
            });
          });
        });

        describe('# but the queried token type does not exist', () => {
          before(async () => {
            await setup();
          });

          it('it returns zero', async () => {
            expect(await sERC1155.balanceOf(holders[0].address, 123456789)).to.equal(0);
          });
        });
      });
    });
  });

  describe('ERC1155MetadataURI', () => {
    describe('# uri', () => {
      describe('» token type exists', () => {
        describe('» and its associated ERC721 is still wrapped', () => {
          before(async () => {
            await setup();
            await wrap();
          });

          it('it returns the wrapped ERC721 URI', async () => {
            expect(await sERC1155.uri(id)).to.equal(tokenURI);
          });
        });

        describe('» but its associated ERC721 is not wrapped anymore', () => {
          before(async () => {
            await setup();
            await wrap();
            await unwrap();
          });

          it('it returns the default unwrapped URI', async () => {
            expect(await sERC1155.uri(id)).to.equal(unwrappedURI);
          });
        });
      });

      describe('» token type exists', () => {
        before(async () => {
          await setup();
        });

        it('it returns a blank string', async () => {
          expect(await sERC1155.uri(id)).to.equal('');
        });
      });
    });
  });

  describe('ERC721Receiver', () => {
    describe('# onERC721Received', () => {
      before(async () => {
        await setup();
        await wrap({ transfer: true });
      });

      itWrapsLikeExpected();
    });
  });

  describe('# wrap', () => {
    describe('» NFT has never been wrapped', () => {
      describe('» and NTF is ERC721-compliant', () => {
        describe('» and sERC1155 has been approved to transfer NFT', () => {
          before(async () => {
            await setup();
            await wrap();
          });

          itWrapsLikeExpected();
        });
        describe('» but sERC1155 has not been approved to transfer NFT', () => {
          before(async () => {
            await setup({ approve: false });
          });
          it('it reverts', async () => {
            await expect(
              sERC1155.wrap(
                sERC721.address,
                tokenId,
                name,
                symbol,
                cap,
                roles.map((role) => role.address),
                owners[1].address
              )
            ).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
          });
        });
      });
      describe('» but NTF is not ERC721-compliant', () => {
        before(async () => {
          await setup();
        });
        it('it reverts', async () => {
          await expect(
            sERC1155.wrap(
              others[0].address,
              tokenId,
              name,
              symbol,
              cap,
              roles.map((role) => role.address),
              owners[1].address
            )
          ).to.be.revertedWith('sERC1155: NFT is not ERC721-compliant');
        });
      });
    });

    describe('» NFT has already been wrapped', () => {
      describe('» and NFT has been unwrapped since', () => {
        before(async () => {
          await setup();

          tx = await sERC1155.wrap(
            sERC721.address,
            tokenId,
            name,
            symbol,
            cap,
            roles.map((role) => role.address),
            owners[1].address
          );
          receipt = await tx.wait();
          id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
          sERC1155 = sERC1155.connect(owners[1]);
          tx = await sERC1155['unwrap(uint256,address,bytes)'](id, owners[0].address, ethers.constants.HashZero);
          receipt = await tx.wait();
          sERC721 = sERC721.connect(owners[0]);
          await (await sERC721.approve(sERC1155.address, tokenId)).wait();
          tx = await sERC1155.wrap(
            sERC721.address,
            tokenId,
            name,
            symbol,
            cap,
            roles.map((role) => role.address),
            owners[1].address
          );
          receipt = await tx.wait();
          id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
        });
        itWrapsLikeExpected();
      });
      describe('» but NFT still is wrapped', () => {
        before(async () => {
          await setup();

          tx = await sERC1155.wrap(
            sERC721.address,
            tokenId,
            name,
            symbol,
            cap,
            roles.map((role) => role.address),
            owners[1].address
          );
          receipt = await tx.wait();
          id = receipt.events.filter((event) => event.event === 'Wrap')[0].args.id;
          sERC1155 = sERC1155.connect(owners[1]);
        });
        it('it reverts', async () => {
          await expect(
            sERC1155.wrap(
              sERC721.address,
              tokenId,
              name,
              symbol,
              cap,
              roles.map((role) => role.address),
              owners[1].address
            )
          ).to.be.revertedWith('sERC1155: NFT is already wrapped');
        });
      });
    });
  });
});
