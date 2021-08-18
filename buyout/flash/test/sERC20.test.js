const { expect } = require('chai');
const { initialize, setup } = require('@spectrexyz/protocol-helpers');
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

          it("# it sets sERC20's pegged sERC1155's address", async () => {
            expect(await this.sERC20.sERC1155()).to.equal(this.sERC1155.contract.address);
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

  describe('# approve', () => {
    describe('» spender is not the zero address', () => {
      before(async () => {
        await sERC20.deploy(this);
        await this.sERC20.approve({ spender: this.signers.others[0], amount: this.params.sERC20.amount });
      });

      it("it updates spender's allowance", async () => {
        expect(await this.sERC20.allowance(this.signers.holders[0].address, this.signers.others[0].address)).to.equal(this.params.sERC20.amount);
      });

      it('it emits an Approval event', async () => {
        await expect(this.data.tx)
          .to.emit(this.contracts.sERC20, 'Approval')
          .withArgs(this.signers.holders[0].address, this.signers.others[0].address, this.params.sERC20.amount);
      });
    });

    describe('» spender is the zero address', () => {
      before(async () => {
        await sERC20.deploy(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.approve({ spender: { address: ethers.constants.AddressZero } })).to.be.revertedWith('ERC20: approve to the zero address');
      });
    });
  });

  describe('# transfer', () => {
    describe('» recipient is not the zero address', () => {
      describe('» and sender has enough balance', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
          await this.sERC20.transfer({ to: this.signers.holders[1] });
        });

        it('it transfers tokens', async () => {
          expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
          expect(await this.sERC20.balanceOf(this.signers.holders[1])).to.equal(this.params.sERC20.amount);
        });

        it('it emits a Transfer event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC20, 'Transfer')
            .withArgs(this.signers.holders[0].address, this.signers.holders[1].address, this.params.sERC20.amount);
        });

        it('it emits a TransferSingle event at the sERC1155 layer', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC1155, 'TransferSingle')
            .withArgs(this.sERC20.contract.address, this.signers.holders[0].address, this.signers.holders[1].address, this.data.id, this.params.sERC20.amount);
        });
      });

      describe('» but sender does not have enough balance', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
        });

        it('it reverts', async () => {
          await expect(
            this.sERC20.transfer({ to: this.signers.holders[1], amount: this.params.sERC20.balance.add(ethers.BigNumber.from('1')) })
          ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        });
      });
    });

    describe('» recipient is the zero address', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.mint();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.transfer({ to: { address: ethers.constants.AddressZero } })).to.be.revertedWith('ERC20: transfer to the zero address');
      });
    });
  });

  describe('# transferFrom', () => {
    describe('» token owner is not the zero address', () => {
      describe('» and recipient is not the zero address', () => {
        describe('» and spender has enough approved balance', () => {
          describe('» and token owner has enough balance', () => {
            before(async () => {
              await setup(this);
              await this.sERC20.mint();
              await this.sERC20.approve({ spender: this.signers.others[0], amount: this.params.sERC20.amount });
              await this.sERC20.transferFrom();
            });

            it('it transfers tokens', async () => {
              expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
              expect(await this.sERC20.balanceOf(this.signers.holders[1])).to.equal(this.params.sERC20.amount);
            });

            it("it updates spender's allowance", async () => {
              expect(await this.sERC20.allowance(this.signers.holders[0].address, this.signers.others[0].address)).to.equal(0);
            });

            it('it emits a Transfer event', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC20, 'Transfer')
                .withArgs(this.signers.holders[0].address, this.signers.holders[1].address, this.params.sERC20.amount);
            });

            it('it emits a TransferSingle event at the sERC1155 layer', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC1155, 'TransferSingle')
                .withArgs(
                  this.sERC20.contract.address,
                  this.signers.holders[0].address,
                  this.signers.holders[1].address,
                  this.data.id,
                  this.params.sERC20.amount
                );
            });

            it('it emits an Approval event', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC20, 'Approval')
                .withArgs(this.signers.holders[0].address, this.signers.others[0].address, 0);
            });
          });

          describe('» but token owner does not have enough balance', () => {
            before(async () => {
              await setup(this);
              await this.sERC20.mint();
              await this.sERC20.approve({ spender: this.signers.others[0], amount: this.params.sERC20.balance.add(this.params.sERC20.balance) });
            });

            it('it reverts', async () => {
              await expect(this.sERC20.transferFrom({ amount: this.params.sERC20.balance.add(this.params.sERC20.balance) })).to.be.revertedWith(
                'ERC20: transfer amount exceeds balance'
              );
            });
          });
        });

        describe('» but spender does not have enough approved balance', () => {
          before(async () => {
            await setup(this);
            await this.sERC20.mint();
          });

          it('it reverts', async () => {
            await expect(this.sERC20.transferFrom()).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
          });
        });
      });

      describe('» but recipient is the zero address', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
        });

        it('it reverts', async () => {
          await expect(this.sERC20.transferFrom({ to: { address: ethers.constants.AddressZero } })).to.be.revertedWith('ERC20: transfer to the zero address');
        });
      });
    });

    describe('» but token owner is the zero address', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.mint();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.transferFrom({ owner: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
          'ERC20: transfer from the zero address'
        );
      });
    });
  });

  describe('# setRoleAdmin', () => {
    describe('» caller has admin role', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.setRoleAdmin({ adminRole: ethers.BigNumber.from('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177') });
      });

      it('it sets admin role', async () => {
        expect(await this.sERC20.getRoleAdmin(this.constants.sERC20.MINT_ROLE)).to.equal(
          ethers.BigNumber.from('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177')
        );
      });

      it('it emits a RoleAdminChanged event', async () => {
        await expect(this.data.tx)
          .to.emit(this.contracts.sERC20, 'RoleAdminChanged')
          .withArgs(
            this.constants.sERC20.MINT_ROLE,
            this.constants.sERC20.DEFAULT_ADMIN_ROLE,
            ethers.BigNumber.from('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177')
          );
      });
    });

    describe('» caller does not have admin role', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.setRoleAdmin({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must be role admin to set role admin');
      });
    });
  });

  describe('# burn', () => {
    describe('» burnt amount is inferior to balance', () => {
      describe('» and sERC20 is not paused', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
          await this.sERC20.burn();
        });

        it('it burns tokens', async () => {
          expect(await this.sERC20.totalSupply()).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
          expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
        });

        it('it emits a Transfer event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC20, 'Transfer')
            .withArgs(this.signers.holders[0].address, ethers.constants.AddressZero, this.params.sERC20.amount);
        });

        it('it emits a TransferSingle event at the sERC1155 layer', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC1155, 'TransferSingle')
            .withArgs(this.sERC20.contract.address, this.signers.holders[0].address, ethers.constants.AddressZero, this.data.id, this.params.sERC20.amount);
        });
      });

      describe('» but sERC20 is paused', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.pause();
        });

        it('it reverts', async () => {
          await expect(this.sERC20.burn()).to.be.revertedWith('ERC20Pausable: token transfer while paused');
        });
      });
    });

    describe('» burnt amount is superior to balance', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.mint();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.burn({ amount: this.params.sERC20.balance.add(ethers.BigNumber.from('1')) })).to.be.revertedWith(
          'ERC20: burn amount exceeds balance'
        );
      });
    });
  });

  describe('# burnFrom', () => {
    describe('» and spender has enough approved balance', () => {
      describe('» and token owner has enough balance', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
          await this.sERC20.approve({ spender: this.signers.others[0], amount: this.params.sERC20.amount });
          await this.sERC20.burnFrom();
        });

        it('it transfers tokens', async () => {
          expect(await this.sERC20.totalSupply()).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
          expect(await this.sERC20.balanceOf(this.signers.holders[0])).to.equal(this.params.sERC20.balance.sub(this.params.sERC20.amount));
        });

        it("it updates spender's allowance", async () => {
          expect(await this.sERC20.allowance(this.signers.holders[0].address, this.signers.others[0].address)).to.equal(0);
        });

        it('it emits a Transfer event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC20, 'Transfer')
            .withArgs(this.signers.holders[0].address, ethers.constants.AddressZero, this.params.sERC20.amount);
        });

        it('it emits a TransferSingle event at the sERC1155 layer', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC1155, 'TransferSingle')
            .withArgs(this.sERC20.contract.address, this.signers.holders[0].address, ethers.constants.AddressZero, this.data.id, this.params.sERC20.amount);
        });

        it('it emits an Approval event', async () => {
          await expect(this.data.tx).to.emit(this.contracts.sERC20, 'Approval').withArgs(this.signers.holders[0].address, this.signers.others[0].address, 0);
        });
      });

      describe('» but token owner does not have enough balance', () => {
        before(async () => {
          await setup(this);
          await this.sERC20.mint();
          await this.sERC20.approve({ spender: this.signers.others[0], amount: this.params.sERC20.balance.add(this.params.sERC20.balance) });
        });

        it('it reverts', async () => {
          await expect(this.sERC20.burnFrom({ amount: this.params.sERC20.balance.add(this.params.sERC20.balance) })).to.be.revertedWith(
            'ERC20: burn amount exceeds balance'
          );
        });
      });
    });

    describe('» but spender does not have enough approved balance', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.mint();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.burnFrom()).to.be.revertedWith('ERC20: burn amount exceeds allowance');
      });
    });
  });

  describe('# mint', () => {
    describe('» caller has MINT_ROLE', () => {
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

    describe('» caller does not have MINT_ROLE', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.mint({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have MINT_ROLE to mint');
      });
    });
  });

  describe('# pause', () => {
    describe('» caller has PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
      });

      it('it pauses sERC20', async () => {
        expect(await this.sERC20.paused()).to.equal(true);
      });
    });

    describe('# caller does not have PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(this.sERC20.pause({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have PAUSE_ROLE to pause');
      });
    });
  });

  describe('# unpause', () => {
    describe('» caller has PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
        await this.sERC20.unpause();
      });

      it('it pauses sERC20', async () => {
        expect(await this.sERC20.paused()).to.equal(false);
      });
    });

    describe('# caller does not have PAUSE_ROLE', () => {
      before(async () => {
        await setup(this);
        await this.sERC20.pause();
      });

      it('it reverts', async () => {
        await expect(this.sERC20.unpause({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have PAUSE_ROLE to unpause');
      });
    });
  });

  describe('# snapshot', () => {
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
        await expect(this.sERC20.snapshot({ from: this.signers.others[0] })).to.be.revertedWith('sERC20: must have SNAPSHOT_ROLE to snapshot');
      });
    });
  });
});
