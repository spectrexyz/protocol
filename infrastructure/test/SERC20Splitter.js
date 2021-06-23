const { expect } = require('chai');
// const { ethers } = require('ethers');
const { initialize, register, mint, setup, spectralize, transfer, withdraw, withdrawBatch } = require('@spectrexyz/protocol-helpers');

describe('SERC20Splitter', () => {
  before(async () => {
    await initialize(this);
  });

  describe('# constructor', () => {
    before(async () => {
      await setup(this);
    });

    it('# it sets up permissions', async () => {
      expect(await this.contracts.SERC20Splitter.hasRole(await this.contracts.SERC20Splitter.DEFAULT_ADMIN_ROLE(), this.signers.root.address)).to.equal(true);
      expect(await this.contracts.SERC20Splitter.hasRole(await this.contracts.SERC20Splitter.REGISTER_ROLE(), this.signers.admin.address)).to.equal(true);
    });
  });

  describe('# register', () => {
    describe('» sender has REGISTER_ROLE', () => {
      describe('» and sERC20 split is not yet registered', () => {
        describe('» and beneficiaries and shares arrays have the same length', () => {
          describe('» and no beneficiary is the zero address', () => {
            describe('» and no share is worth zero', () => {
              describe('» and shares add up to 100%', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                  await register(this);
                });

                it('it registers split', async () => {
                  const split = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);

                  expect(await this.contracts.SERC20Splitter.isRegistered(this.contracts.sERC20.address)).to.equal(true);
                  expect(split.received).to.equal(0);
                  expect(split.totalWithdrawn).to.equal(0);
                });

                it('it emits a Register event', async () => {
                  await expect(this.data.tx)
                    .to.emit(this.contracts.SERC20Splitter, 'Register')
                    .withArgs(
                      this.contracts.sERC20.address,
                      [this.signers.beneficiaries[0].address, this.signers.beneficiaries[1].address, this.signers.beneficiaries[2].address],
                      [this.constants.shares[0], this.constants.shares[1], this.constants.shares[2]]
                    );
                });
              });

              describe('» but shares do not add up 100%', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                });

                it('it reverts', async () => {
                  await expect(register(this, { shares: [this.constants.shares[0], this.constants.shares[1], '10'] })).to.be.revertedWith(
                    'SERC20Splitter: shares must add up to 100%'
                  );
                });
              });
            });

            describe('» but one share is worth zero', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
              });

              it('it reverts', async () => {
                await expect(register(this, { shares: [this.constants.shares[0], this.constants.shares[1], 0] })).to.be.revertedWith(
                  'SERC20Splitter: share cannot be worth zero'
                );
              });
            });
          });

          describe('» but one beneficiary is the zero address', () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
            });

            it('it reverts', async () => {
              await expect(
                register(this, { beneficiaries: [this.signers.beneficiaries[0], this.signers.beneficiaries[1], { address: ethers.constants.AddressZero }] })
              ).to.be.revertedWith('SERC20Splitter: beneficiary cannot be the zero address');
            });
          });
        });

        describe('» but beneficiaries and shares arrays do not have the same length', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
          });

          it('it reverts', async () => {
            await expect(register(this, { shares: [this.constants.shares[0], this.constants.shares[1]] })).to.be.revertedWith(
              'SERC20Splitter: beneficiaries and shares length mismatch'
            );
          });
        });
      });

      describe('» but sERC20 split is already registered', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await register(this);
        });

        it('it reverts', async () => {
          await expect(register(this)).to.be.revertedWith('SERC20Splitter: sERC20 split already registered');
        });
      });
    });

    describe('» sender does not have REGISTER_ROLE', () => {
      before(async () => {
        await setup(this);
        await spectralize(this);
      });

      it('it reverts', async () => {
        await expect(register(this, { from: this.signers.others[0] })).to.be.revertedWith('SERC20Splitter: must have register role to register');
      });
    });
  });

  describe('# withdraw', () => {
    describe('» sERC20 split is registered', () => {
      describe('» and there is something to withdraw', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
        });

        it('it updates split history', async () => {
          await transfer.sERC20(this, { amount: '1000' });
          const split1 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split1.received).to.equal(1000);
          expect(split1.totalWithdrawn).to.equal(0);

          await withdraw(this);
          const split2 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split2.received).to.equal(1000);
          expect(split2.totalWithdrawn).to.equal(300);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[0].address)).to.equal(300);

          await transfer.sERC20(this, { amount: '5000' });
          const split3 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split3.received).to.equal(6000);
          expect(split3.totalWithdrawn).to.equal(300);

          await withdraw(this, { from: this.signers.beneficiaries[1] });
          const split4 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split4.received).to.equal(6000);
          expect(split4.totalWithdrawn).to.equal(900);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[1].address)).to.equal(600);

          await transfer.sERC20(this, { amount: '6000' });
          const split5 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split5.received).to.equal(12000);
          expect(split5.totalWithdrawn).to.equal(900);

          await withdraw(this, { from: this.signers.beneficiaries[0] });
          await withdraw(this, { from: this.signers.beneficiaries[1] });
          await withdraw(this, { from: this.signers.beneficiaries[2] });
          const split6 = await this.contracts.SERC20Splitter.splitOf(this.contracts.sERC20.address);
          expect(split6.received).to.equal(12000);
          expect(split6.totalWithdrawn).to.equal(12000);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[0].address)).to.equal(3600);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[1].address)).to.equal(1200);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[2].address)).to.equal(7200);
        });

        it('it transfers sERC20s', async () => {
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[0].address)).to.equal(3600);
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[1].address)).to.equal(1200);
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[2].address)).to.equal(7200);
        });

        it('it emits a Withdraw event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.SERC20Splitter, 'Withdraw')
            .withArgs(this.contracts.sERC20.address, this.signers.beneficiaries[2].address, 7200);
        });
      });

      describe('» but there is nothing to withdraw', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
          await transfer.sERC20(this, { amount: '1000' });
          await withdraw(this);
        });

        it('it reverts', async () => {
          await expect(withdraw(this)).to.be.revertedWith('SERC20Splitter: nothing to withdraw');
        });
      });
    });

    describe('» sERC20 split is not registered', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(withdraw(this)).to.be.revertedWith('SERC20Splitter: unsplit sERC20');
      });
    });
  });

  describe('# withdrawBatch', () => {
    describe('» all sERC20s splits are registered', () => {
      describe('» and there is something to withdraw for all sERC20s', () => {
        before(async () => {
          await setup(this);

          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
          await transfer.sERC20(this, { amount: '1000' });
          this.data.sERC201 = this.contracts.sERC20;

          await mint.sERC721(this);
          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
          await transfer.sERC20(this, { amount: '2000' });
          this.data.sERC202 = this.contracts.sERC20;

          await withdrawBatch(this);
        });

        it('it updates split history', async () => {
          const split1 = await this.contracts.SERC20Splitter.splitOf(this.data.sERC201.address);
          const split2 = await this.contracts.SERC20Splitter.splitOf(this.data.sERC202.address);

          expect(split1.received).to.equal(1000);
          expect(split1.totalWithdrawn).to.equal(300);

          expect(split2.received).to.equal(2000);
          expect(split2.totalWithdrawn).to.equal(600);

          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.data.sERC201.address, this.signers.beneficiaries[0].address)).to.equal(300);
          expect(await this.contracts.SERC20Splitter.withdrawnBy(this.data.sERC202.address, this.signers.beneficiaries[0].address)).to.equal(600);
        });

        it('it transfers sERC20s', async () => {
          expect(await this.data.sERC201.balanceOf(this.signers.beneficiaries[0].address)).to.equal(300);
          expect(await this.data.sERC202.balanceOf(this.signers.beneficiaries[0].address)).to.equal(600);
        });

        it('it emits Withdraw events', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.SERC20Splitter, 'Withdraw')
            .withArgs(this.data.sERC201.address, this.signers.beneficiaries[0].address, 300);
          await expect(this.data.tx)
            .to.emit(this.contracts.SERC20Splitter, 'Withdraw')
            .withArgs(this.data.sERC202.address, this.signers.beneficiaries[0].address, 600);
        });
      });

      describe('» but there is nothing to withdraw for one sERC20', () => {
        before(async () => {
          await setup(this);

          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
          await transfer.sERC20(this, { amount: '1000' });
          this.data.sERC201 = this.contracts.sERC20;

          await mint.sERC721(this);
          await spectralize(this);
          await register(this);
          await mint.sERC20(this);
          await transfer.sERC20(this, { amount: '2000' });
          this.data.sERC202 = this.contracts.sERC20;

          await withdraw(this);
        });

        it('it reverts', async () => {
          await expect(withdrawBatch(this)).to.be.revertedWith('SERC20Splitter: nothing to withdraw');
        });
      });
    });

    describe('» one sERC20 split is not registered', () => {
      before(async () => {
        await setup(this);

        await spectralize(this);
        await register(this);
        await mint.sERC20(this);
        await transfer.sERC20(this, { amount: '1000' });
        this.data.sERC201 = this.contracts.sERC20;

        await mint.sERC721(this);
        await spectralize(this);
        await mint.sERC20(this);
        await transfer.sERC20(this, { amount: '2000' });
        this.data.sERC202 = this.contracts.sERC20;
      });

      it('it reverts', async () => {
        await expect(withdrawBatch(this)).to.be.revertedWith('SERC20Splitter: unsplit sERC20');
      });
    });
  });
});
