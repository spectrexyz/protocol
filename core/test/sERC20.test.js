const { expect } = require('chai');
const { initialize, setup, spectralize } = require('@spectrexyz/protocol-helpers');
const { sERC20 } = require('@spectrexyz/protocol-helpers/models');

describe.only('sERC20', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ initialize', () => {
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

        describe('» but admin is the zero address', () => {
          // we would need to deploy a proxy factory to test
        });
      });

      describe('» but cap is zero', () => {
        // we would need to deploy a proxy factory to test
      });
    });

    describe('» is called on the implementation contract', () => {
      before(async () => {
        await sERC20.deploy(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
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

  describe.only('# pause', () => {
    describe.only('» caller has PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
      });

      it('it pauses sERC20', async () => {
        expect(await this.sERC20.paused()).to.equal(true);
      });
    });

    describe.only('# caller does not have PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.pause({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have pause role to pause');
      });
    });
  });

  describe.only('# unepause', () => {
    describe.only('» caller has PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
        await this.sERC20.unpause();
      });

      it('it pauses sERC20', async () => {
        expect(await this.sERC20.paused()).to.equal(false);
      });
    });

    describe.only('# caller does not have PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.unpause({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have pause role to unpause');
      });
    });
  });

  describe.only('⇛ sERC20', () => {
    describe('# mint', () => {
      describe('» cap is not reached yet', () => {
        describe('» and minted amount is inferior to cap', () => {
          describe('» and sERC20 is not paused', () => {
            before(async () => {
              await setup(this);
              await this.sERC20.mint();
            });

            it('it mints tokens', async () => {
              expect(await this.sERC20.totalSupply()).to.equal(this.params.sERC20.balance);
              expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance);
            });

            it('it emits a Transfer event', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC20, 'Transfer')
                .withArgs(ethers.constants.AddressZero, this.signers.holders[0].address, this.params.sERC20.balance);
            });

            it('it emits a TransferSingle event at the sERC1155 layer', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC1155, 'TransferSingle')
                .withArgs(
                  this.sERC20.contract.address,
                  ethers.constants.AddressZero,
                  this.signers.holders[0].address,
                  this.data.id,
                  this.params.sERC20.balance
                );
            });
          });

          describe('» but sERC20 is paused', () => {
            before(async () => {
              await setup(this);
              await this.sERC20.pause();
            });

            it('it reverts', async () => {
              await expect(this.sERC20.mint()).to.be.revertedWith('ERC20Pausable: token transfer while paused');
            });
          });
        });

        describe('» but amount is superior to cap', () => {
          before(async () => {
            await setup(this);
          });

          it('it reverts', async () => {
            await expect(this.sERC20.mint({ amount: this.params.sERC20.cap.add(ethers.BigNumber.from('1')) })).to.be.revertedWith('ERC20Capped: cap exceeded');
          });
        });
      });

      describe('» cap is already reached', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint({ amount: this.params.sERC20.cap });
        });

        it('it reverts', async () => {
          await expect(this.sERC20.mint({ amount: 1 })).to.be.revertedWith('ERC20Capped: cap exceeded');
        });
      });
    });

    describe.only('# snapshot', () => {
      describe('» caller has SNAPSHOT_ROLE', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
          await this.sERC20.transfer({ to: this.signers.holders[1] });
          await this.sERC20.snapshot();
          this.data.tx1 = this.data.tx;
          await this.sERC20.transfer({ to: this.signers.holders[1] });
          await this.sERC20.burn();
          await this.sERC20.mint();
        });

        it("it snapshots sERC20's total supply", async () => {
          expect(await this.sERC20.totalSupplyAt(this.data.snapshotId)).to.equal(this.params.sERC20.balance);
        });

        it("it snapshots sERC20's balances", async () => {
          expect(await this.sERC20.balanceOfAt(this.signers.holders[0].address, this.data.snapshotId)).to.equal(
            this.params.sERC20.balance.sub(this.params.sERC20.amount)
          );
        });

        it('it emits a Snapshot event', async () => {
          await expect(this.data.tx1).to.emit(this.contracts.sERC20, 'Snapshot');
        });
      });

      describe('» caller does not have SNAPSHOT_ROLE', () => {
        before(async () => {
          await setup(this);
        });

        it('it reverts', async () => {
          await expect(this.sERC20.snapshot({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have snapshot role to snapshot');
        });
      });
    });
  });
});
