const { expect } = require('chai');
const { initialize, setup, spectralize } = require('@spectrexyz/protocol-helpers');
const { sERC20 } = require('@spectrexyz/protocol-helpers/models');

describe.only('sERC20', () => {
  before(async () => {
    await initialize(this);
  });

  describe.only('⇛ initialize', () => {
    describe('» is called on the proxy contract', () => {
      describe('» and cap is not zero', () => {
        describe('» and admin is not the zero address', () => {
          before(async () => {
            await setup(this);
          });

          it("# it sets sERC20's name", async () => {
            expect(await this.sERC20.name()).to.equal(this.params.sERC20.name);
          });

          it("# it sets sERC20's symbol", async () => {
            expect(await this.sERC20.symbol()).to.equal(this.params.sERC20.symbol);
          });

          it("# it sets sERC20's decimals", async () => {
            expect(await this.sERC20.decimals()).to.equal(18);
          });

          it("# it sets sERC20's cap", async () => {
            expect(await this.sERC20.cap()).to.equal(this.params.sERC20.cap);
          });

          it("# it sets sERC20's admin", async () => {
            expect(await this.sERC20.hasRole(await this.contracts.sERC20.DEFAULT_ADMIN_ROLE(), this.signers.sERC20.admin.address)).to.equal(true);
          });
        });
      });
    });

    describe('» is called on the implementation contract', () => {
      before(async () => {
        await sERC20.deploy(this);
      });

      it('it reverts', async () => {
        await expect(
          this.sERC20.contract.initialize(this.params.sERC20.name, this.params.sERC20.symbol, this.params.sERC20.cap, this.signers.sERC20.admin.address)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('⇛ access control', () => {
    before(async () => {
      await setup(this);
      await spectralize(this);

      this.contracts.sERC20 = this.contracts.sERC20;
      this.data.tx = await this.contracts.sERC20
        .connect(this.signers.admin)
        .grantRole(await this.contracts.sERC20.PAUSER_ROLE(), this.signers.others[0].address);
      // grantRole(bytes32 role, address account)
    });

    it('# it sets up admin permissions', async () => {
      expect(await this.contracts.sERC20.hasRole(await this.contracts.sERC20.PAUSER_ROLE(), this.signers.others[0].address)).to.equal(true);
      // expect(await this.contracts.sERC1155.getRoleAdmin(await this.contracts.sERC1155.ADMIN_ROLE())).to.equal(await this.contracts.sERC1155.ADMIN_ROLE());
    });
  });

  describe('⇛ access control', () => {
    describe('total supply', () => {
      before(async () => {
        await setup(this);
        await spectralize(this);
        await this.sERC20.mint();
      });

      it('it returns the sERC20 supply', async () => {
        expect(await this.contracts.sERC20.totalSupply()).to.equal(this.constants.balance);
      });
    });
  });

  describe.only('# transfer', () => {});

  describe.only('⇛ sERC20', () => {
    describe('⇛ mint', () => {
      describe('⇛ cap is not reached yet', () => {
        describe('⇛ and amount is inferior to cap', () => {
          describe('⇛ and sERC20 is not paused', () => {
            before(async () => {
              await setup(this);
              // await spectralize(this);
              await this.sERC20.mint();
            });

            it('it mints tokens', async () => {
              expect(await this.sERC20.totalSupply()).to.equal(this.params.sERC20.balance);
              expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance);
            });
          });
        });

        describe.only('» but sERC20 is paused', () => {
          before(async () => {
            await setup(this);
            // await spectralize(this);
            await this.sERC20.pause();
          });

          it('it reverts', async () => {
            await expect(this.sERC20.mint()).to.be.revertedWith('ERC20Pausable: token transfer while paused');
          });
        });

        describe.only('» but amount is superior to cap', () => {
          before(async () => {
            await setup(this);
            // await spectralize(this);
          });

          it('it reverts', async () => {
            await expect(this.sERC20.mint({ amount: this.params.sERC20.cap.add(ethers.BigNumber.from('1')) })).to.be.revertedWith('ERC20Capped: cap exceeded');
          });
        });
      });

      describe.only('⇛ cap is already reached', () => {
        before(async () => {
          await setup(this);
          // await spectralize(this);
          await this.sERC20.mint({ amount: this.params.sERC20.cap });
        });

        it('it reverts', async () => {
          await expect(this.sERC20.mint({ amount: 1 })).to.be.revertedWith('ERC20Capped: cap exceeded');
        });
      });
    });
  });
});
