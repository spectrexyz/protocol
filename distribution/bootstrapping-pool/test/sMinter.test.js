const chai = require('chai');
const { expect } = require('chai');
const { initialize, setup } = require('@spectrexyz/protocol-helpers');
const { near } = require('@spectrexyz/protocol-helpers/chai');
const { advanceTime, currentTimestamp } = require('@spectrexyz/protocol-helpers/time');
const sMinter = require('@spectrexyz/protocol-helpers/models/sMinter');
const { ethers } = require('ethers');
const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe.only('sMinter', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    describe('» vault is not the zero address', () => {
      describe('» and bank is not the zero address', () => {
        describe('» and splitter is not the zero address', () => {
          before(async () => {
            await setup(this, { balancer: true, minter: true, mint: false });
          });

          it('it initializes contract', async () => {
            expect(await this.sMinter.vault()).to.equal(this.contracts.Vault.address);
            expect(await this.sMinter.bank()).to.equal(this.signers.sMinter.bank.address);
            expect(await this.sMinter.splitter()).to.equal(this.signers.sMinter.splitter.address);
            expect(await this.sMinter.protocolFee()).to.equal(this.params.sMinter.protocolFee);
          });
        });

        describe('» but splitter is the zero address', () => {
          it('it reverts', async () => {
            await expect(sMinter.deploy(this, { splitter: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              'sMinter: splitter cannot be the zero address'
            );
          });
        });
      });

      describe('» but bank is the zero address', () => {
        it('it reverts', async () => {
          await expect(sMinter.deploy(this, { bank: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
            'sMinter: bank cannot be the zero address'
          );
        });
      });
    });

    describe('» vault is the zero address', () => {
      it('it reverts', async () => {
        await expect(sMinter.deploy(this, { vault: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
          'sMinter: vault cannot be the zero address'
        );
      });
    });
  });

  describe('⇛ setters', () => {
    describe('# setVault', () => {
      describe('» caller is admin', () => {
        describe('» and vault is not the zero address', () => {
          before(async () => {
            await setup(this, { balancer: true, minter: true, mint: false });
            await this.sMinter.contract.connect(this.signers.sMinter.admin).setVault(this.signers.others[0].address);
          });

          it('it sets Vault', async () => {
            expect(await this.sMinter.vault()).to.equal(this.signers.others[0].address);
          });
        });

        describe('» but vault is the zero address', () => {
          it('it reverts', async () => {
            await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setVault(ethers.constants.AddressZero)).to.be.revertedWith(
              'sMinter: vault cannot be the zero addres'
            );
          });
        });
      });

      describe('» caller is not admin', () => {
        before(async () => {
          await setup(this, { balancer: true, minter: true, mint: false });
        });

        it('it reverts', async () => {
          await expect(this.sMinter.contract.connect(this.signers.others[0]).setVault(this.signers.others[0].address)).to.be.revertedWith(
            'sMinter: protected operation'
          );
        });
      });
    });

    describe('# setBank', () => {
      describe('» caller is admin', () => {
        describe('» and bank is not the zero address', () => {
          before(async () => {
            await setup(this, { balancer: true, minter: true, mint: false });
            await this.sMinter.contract.connect(this.signers.sMinter.admin).setBank(this.signers.others[0].address);
          });

          it('it sets bank', async () => {
            expect(await this.sMinter.bank()).to.equal(this.signers.others[0].address);
          });
        });

        describe('» but bank is the zero address', () => {
          it('it reverts', async () => {
            await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setBank(ethers.constants.AddressZero)).to.be.revertedWith(
              'sMinter: bank cannot be the zero addres'
            );
          });
        });
      });

      describe('» caller is not admin', () => {
        before(async () => {
          await setup(this, { balancer: true, minter: true, mint: false });
        });

        it('it reverts', async () => {
          await expect(this.sMinter.contract.connect(this.signers.others[0]).setBank(this.signers.others[0].address)).to.be.revertedWith(
            'sMinter: protected operation'
          );
        });
      });
    });

    describe('# setSplitter', () => {
      describe('» caller is admin', () => {
        describe('» and splitter is not the zero address', () => {
          before(async () => {
            await setup(this, { balancer: true, minter: true, mint: false });
            await this.sMinter.contract.connect(this.signers.sMinter.admin).setSplitter(this.signers.others[0].address);
          });

          it('it sets splitter', async () => {
            expect(await this.sMinter.splitter()).to.equal(this.signers.others[0].address);
          });
        });

        describe('» but splitter is the zero address', () => {
          it('it reverts', async () => {
            await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setSplitter(ethers.constants.AddressZero)).to.be.revertedWith(
              'sMinter: splitter cannot be the zero addres'
            );
          });
        });
      });

      describe('» caller is not admin', () => {
        before(async () => {
          await setup(this, { balancer: true, minter: true, mint: false });
        });

        it('it reverts', async () => {
          await expect(this.sMinter.contract.connect(this.signers.others[0]).setSplitter(this.signers.others[0].address)).to.be.revertedWith(
            'sMinter: protected operation'
          );
        });
      });
    });
  });

  describe.only('⇛ core', () => {
    describe('# register', () => {
      describe('» pit is not registered yet', () => {
        describe('» and pool is not the zero address', () => {
          describe('» and beneficiary is not the zero address', () => {
            describe('» and initial price is not null', () => {
              describe('» and allocation is inferior to 100%', () => {
                before(async () => {
                  await setup(this, { balancer: true, minter: true, mint: false });
                  this.data.pit = await this.sMinter.pitOf(this.sERC20.contract.address);
                });

                it('it registers pit', async () => {
                  expect(this.data.pit.pool).to.equal(this.sBootstrappingPool.contract.address);
                  expect(this.data.pit.poolId).to.equal(await this.sBootstrappingPool.getPoolId());
                  expect(this.data.pit.beneficiary).to.equal(this.signers.sMinter.beneficiary.address);
                  expect(this.data.pit.initialPrice).to.equal(this.params.sMinter.initialPrice);
                  expect(this.data.pit.fee).to.equal(this.params.sMinter.fee);
                  expect(this.data.pit.sERC20IsToken0).to.equal(this.sBootstrappingPool.sERC20IsToken0);
                });

                it('it emits a Register event', async () => {
                  await expect(this.data.tx)
                    .to.emit(this.sMinter.contract, 'Register')
                    .withArgs(
                      this.sERC20.contract.address,
                      this.sBootstrappingPool.contract.address,
                      this.signers.sMinter.beneficiary.address,
                      this.params.sMinter.initialPrice,
                      this.params.sMinter.allocation,
                      this.params.sMinter.fee
                    );
                });
              });

              describe('» but allocation is superior to 100%', () => {
                before(async () => {
                  await setup(this, { balancer: true, minter: true, mint: false, register: false });
                });

                it('it reverts', async () => {
                  await expect(this.sMinter.register({ allocation: ethers.utils.parseEther('1').mul(ethers.BigNumber.from('100')) })).to.be.revertedWith(
                    'sMinter: allocation must be inferior to 100%'
                  );
                });
              });
            });

            describe('» but initial price is null', () => {
              before(async () => {
                await setup(this, { balancer: true, minter: true, mint: false, register: false });
              });

              it('it reverts', async () => {
                await expect(this.sMinter.register({ initialPrice: '0' })).to.be.revertedWith('sMinter: initial price cannot be null');
              });
            });
          });

          describe('» but beneficiary is the zero address', () => {
            before(async () => {
              await setup(this, { balancer: true, minter: true, mint: false, register: false });
            });

            it('it reverts', async () => {
              await expect(this.sMinter.register({ beneficiary: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
                'sMinter: beneficiary cannot be the zero address'
              );
            });
          });
        });

        describe('» but pool is the zero address', () => {
          before(async () => {
            await setup(this, { balancer: true, minter: true, mint: false, register: false });
          });

          it('it reverts', async () => {
            await expect(this.sMinter.register({ pool: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              'sMinter: pool cannot be the zero address'
            );
          });
        });
      });

      describe('» pit is already registered', () => {
        before(async () => {
          await setup(this, { balancer: true, minter: true, mint: false });
        });

        it('it reverts', async () => {
          await expect(this.sMinter.register()).to.be.revertedWith('sMinter: pit already registered');
        });
      });
    });

    describe.only('# mint', () => {
      describe('» pool is not initialized yet', () => {
        before(async () => {
          await setup(this, { balancer: true, minter: true });

          this.data.previousBankBalance = await this.signers.sMinter.bank.getBalance();
          this.data.previousBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
          this.data.previousPairPrice = this.params.sMinter.initialPrice;
          this.data.previousBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
          this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);

          await advanceTime(86400);
          await this.sMinter.mint();
          this.data.latestTotalSupply = await this.sERC20.totalSupply();
          this.data.latestBankBalance = await this.signers.sMinter.bank.getBalance();
          this.data.latestBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
          this.data.latestPairPrice = this.sBootstrappingPool.sERC20IsToken0
            ? await this.sBootstrappingPool.pairPrice()
            : this.constants.sMinter.DECIMALS.mul(this.constants.sMinter.DECIMALS).div(await this.sBootstrappingPool.pairPrice());
          this.data.latestBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
          this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);

          this.data.expectedProtocolFee = this.params.sMinter.value.mul(this.params.sMinter.protocolFee).div(this.constants.sMinter.DECIMALS);
          this.data.expectedFee = this.params.sMinter.value.mul(this.params.sMinter.fee).div(this.constants.sMinter.DECIMALS);
          this.data.expectedReward = this.data.expectedFee
            .mul(this.params.sMinter.initialPrice)
            .mul(this.params.sBootstrappingPool.normalizedStartWeight)
            .div(this.constants.sBootstrappingPool.ONE.sub(this.params.sBootstrappingPool.normalizedStartWeight))
            .div(this.constants.sMinter.DECIMALS);
          this.data.expectedBeneficiaryPay = this.params.sMinter.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
          this.data.expectedAmount = this.params.sMinter.value
            .sub(this.data.expectedProtocolFee)
            .sub(this.data.expectedFee)
            .mul(this.params.sMinter.initialPrice)
            .div(this.constants.sMinter.DECIMALS);
        });

        it('it initializes pool', async () => {
          const { balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);
          const sBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[0] : balances[1];
          const eBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[1] : balances[0];

          expect(sBalance).to.equal(this.data.expectedReward);
          expect(eBalance).to.equal(this.data.expectedFee);
        });

        it('it preserves pair price', async () => {
          expect(this.data.latestPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
        });

        it('it mints BPT towards sMinter bank', async () => {
          expect(this.data.latestBankBTPBalance).to.be.gt(this.data.previousBankBTPBalance);
        });

        it('it collects protocol fee', async () => {
          expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
        });

        it('it pays beneficiary', async () => {
          expect(this.data.latestBeneficiaryBalance.sub(this.data.previousBeneficiaryBalance)).to.equal(this.data.expectedBeneficiaryPay);
        });

        it('it mints sERC20 towards recipient', async () => {
          expect(this.data.latestRecipientBalance.sub(this.data.previousRecipientBalance)).to.equal(this.data.expectedAmount);
        });

        it('it mints sERC20 allocation towards splitter', async () => {
          expect(await this.sERC20.balanceOf(this.signers.sMinter.splitter)).to.equal(
            this.params.sMinter.allocation.mul(this.data.latestTotalSupply).div(this.constants.sMinter.HUNDRED)
          );
        });

        it('it emits a Mint event', async () => {
          await expect(this.data.tx)
            .to.emit(this.sMinter.contract, 'Mint')
            .withArgs(this.sERC20.contract.address, this.signers.sMinter.recipient.address, this.params.sMinter.value, this.data.expectedAmount);
        });
      });
    });
  });
});
