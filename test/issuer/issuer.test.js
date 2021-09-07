const chai = require("chai");
const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { near } = require("../helpers/chai");
const { Issuer } = require("../helpers/models");
const { advanceTime, currentTimestamp } = require("../helpers/time");

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe.only("Issuer", () => {
  before(async () => {
    await initialize(this);
  });

  describe("⇛ constructor", () => {
    describe("» vault is not the zero address", () => {
      describe("» and bank is not the zero address", () => {
        describe("» and splitter is not the zero address", () => {
          describe("» and protocol fee is inferior to 100%", () => {
            before(async () => {
              await setup(this, { issuer: true, mint: false });
            });

            it("it initializes contract", async () => {
              expect(await this.issuer.vault()).to.equal(this.contracts.bvault.address);
              expect(await this.issuer.bank()).to.equal(this.signers.issuer.bank.address);
              expect(await this.issuer.splitter()).to.equal(this.signers.issuer.splitter.address);
              expect(await this.issuer.protocolFee()).to.equal(this.params.issuer.protocolFee);
            });

            it("it sets up permissions", async () => {
              expect(await this.issuer.hasRole(ethers.constants.HashZero, this.signers.issuer.admin.address)).to.equal(true);
            });
          });

          describe("» but protocol fee is superior or equal to 100%", () => {
            it("it reverts", async () => {
              await expect(Issuer.deploy(this, { protocolFee: this.constants.issuer.HUNDRED })).to.be.revertedWith(
                "Issuer: protocol fee must be inferior to 100%"
              );
            });
          });
        });

        describe("» but splitter is the zero address", () => {
          it("it reverts", async () => {
            await expect(Issuer.deploy(this, { splitter: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              "Issuer: splitter cannot be the zero address"
            );
          });
        });
      });

      describe("» but bank is the zero address", () => {
        it("it reverts", async () => {
          await expect(Issuer.deploy(this, { bank: { address: ethers.constants.AddressZero } })).to.be.revertedWith("Issuer: bank cannot be the zero address");
        });
      });
    });

    describe("» vault is the zero address", () => {
      it("it reverts", async () => {
        await expect(Issuer.deploy(this, { vault: { address: ethers.constants.AddressZero } })).to.be.revertedWith("Issuer: vault cannot be the zero address");
      });
    });
  });

  describe.only("# register", () => {
    describe("» caller has REGISTER_ROLE", () => {
      describe("» and guardian is not the zero address", () => {
        describe("» and reserve price is not null", () => {
          describe.only("» and minting fee is inferior to 100%", () => {
            before(async () => {
              await setup(this, {
                issuer: true,
                mint: false,
              });
              await this.issuer.register();
              this.data.issuance = await this.issuer.issuanceOf(this.sERC20.contract.address);
            });

            it.only("it registers issuance", async () => {
              expect(this.data.issuance.state).to.equal(this.constants.issuer.issuances.state.OPEN);
              // expect(this.data.issuance.pool).to.equal(this.sBootstrappingPool.contract.address);
              expect(this.data.issuance.guardian).to.equal(this.signers.issuer.guardian.address);
              expect(this.data.issuance.reserve).to.equal(this.params.issuance.reserve);
              expect(this.data.issuance.allocation).to.equal(this.params.issuance.allocation);
              expect(this.data.issuance.fee).to.equal(this.params.issuance.fee);
              expect(this.data.issuance.nbOfProposals).to.equal(0);
              expect(this.data.issuance.flash).to.equal(true);
            });

            it("it emits a Register event", async () => {
              await expect(this.data.tx)
                .to.emit(this.sMinter.contract, "Register")
                .withArgs(
                  this.sERC20.contract.address,
                  this.sBootstrappingPool.contract.address,
                  this.signers.sMinter.beneficiary.address,
                  this.params.sMinter.initialPrice,
                  this.params.sMinter.allocation,
                  this.params.sMinter.fee,
                  this.params.sMinter.protocolFee
                );
            });
          });

          describe("» but minting fee is superior or equal to 100%", () => {
            before(async () => {
              await setup(this, {
                balancer: true,
                minter: true,
                mint: false,
                register: false,
              });
            });

            it("it reverts", async () => {
              await expect(
                this.sMinter.register({
                  fee: this.constants.sMinter.HUNDRED.sub(this.params.sMinter.protocolFee),
                })
              ).to.be.revertedWith("sMinter: cumulated fees must be inferior to 100%");
            });
          });
        });

        describe("» but reserve price is null", () => {
          before(async () => {
            await setup(this, {
              balancer: true,
              minter: true,
              mint: false,
              register: false,
            });
          });

          it("it reverts", async () => {
            await expect(this.sMinter.register({ initialPrice: "0" })).to.be.revertedWith("sMinter: initial price cannot be null");
          });
        });
      });

      describe("» but guardian is the zero address", () => {
        before(async () => {
          await setup(this, {
            balancer: true,
            minter: true,
            mint: false,
            register: false,
          });
        });

        it("it reverts", async () => {
          await expect(
            this.sMinter.register({
              beneficiary: { address: ethers.constants.AddressZero },
            })
          ).to.be.revertedWith("sMinter: beneficiary cannot be the zero address");
        });
      });
    });

    describe("» caller does not have REGISTER_ROLE", () => {
      before(async () => {
        await setup(this, {
          balancer: true,
          minter: true,
          mint: false,
          register: false,
        });
      });

      it("it reverts", async () => {
        await expect(this.sMinter.register({ from: this.signers.others[0] })).to.be.revertedWith("sMinter: must have REGISTER_ROLE to register");
      });
    });
  });

  // describe('⇛ setters', () => {
  //   describe('# setBank', () => {
  //     describe('» caller is admin', () => {
  //       describe('» and bank is not the zero address', () => {
  //         before(async () => {
  //           await setup(this, { balancer: true, minter: true, mint: false });
  //           await this.sMinter.contract.connect(this.signers.sMinter.admin).setBank(this.signers.others[0].address);
  //         });

  //         it('it sets bank', async () => {
  //           expect(await this.sMinter.bank()).to.equal(this.signers.others[0].address);
  //         });
  //       });

  //       describe('» but bank is the zero address', () => {
  //         it('it reverts', async () => {
  //           await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setBank(ethers.constants.AddressZero)).to.be.revertedWith(
  //             'sMinter: bank cannot be the zero addres'
  //           );
  //         });
  //       });
  //     });

  //     describe('» caller is not admin', () => {
  //       before(async () => {
  //         await setup(this, { balancer: true, minter: true, mint: false });
  //       });

  //       it('it reverts', async () => {
  //         await expect(this.sMinter.contract.connect(this.signers.others[0]).setBank(this.signers.others[0].address)).to.be.revertedWith(
  //           'sMinter: protected operation'
  //         );
  //       });
  //     });
  //   });

  //   describe('# setSplitter', () => {
  //     describe('» caller is admin', () => {
  //       describe('» and splitter is not the zero address', () => {
  //         before(async () => {
  //           await setup(this, { balancer: true, minter: true, mint: false });
  //           await this.sMinter.contract.connect(this.signers.sMinter.admin).setSplitter(this.signers.others[0].address);
  //         });

  //         it('it sets splitter', async () => {
  //           expect(await this.sMinter.splitter()).to.equal(this.signers.others[0].address);
  //         });
  //       });

  //       describe('» but splitter is the zero address', () => {
  //         it('it reverts', async () => {
  //           await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setSplitter(ethers.constants.AddressZero)).to.be.revertedWith(
  //             'sMinter: splitter cannot be the zero addres'
  //           );
  //         });
  //       });
  //     });

  //     describe('» caller is not admin', () => {
  //       before(async () => {
  //         await setup(this, { balancer: true, minter: true, mint: false });
  //       });

  //       it('it reverts', async () => {
  //         await expect(this.sMinter.contract.connect(this.signers.others[0]).setSplitter(this.signers.others[0].address)).to.be.revertedWith(
  //           'sMinter: protected operation'
  //         );
  //       });
  //     });
  //   });

  //   describe('# setProtocolFee', () => {
  //     describe('» caller is admin', () => {
  //       describe('» and protocol fee is inferior to 100%', () => {
  //         before(async () => {
  //           await setup(this, { balancer: true, minter: true, mint: false });
  //           await this.sMinter.contract.connect(this.signers.sMinter.admin).setProtocolFee('1000');
  //         });

  //         it('it sets protocol fee', async () => {
  //           expect(await this.sMinter.protocolFee()).to.equal('1000');
  //         });
  //       });

  //       describe('» but protocol fee is superior or equal to 100%', () => {
  //         before(async () => {
  //           await setup(this, { balancer: true, minter: true, mint: false });
  //         });

  //         it('it reverts', async () => {
  //           await expect(this.sMinter.contract.connect(this.signers.sMinter.admin).setProtocolFee(this.constants.sMinter.HUNDRED)).to.be.revertedWith(
  //             'sMinter: protocol fee must be inferior to 100%'
  //           );
  //         });
  //       });
  //     });

  //     describe('» caller is not admin', () => {
  //       before(async () => {
  //         await setup(this, { balancer: true, minter: true, mint: false });
  //       });

  //       it('it reverts', async () => {
  //         await expect(this.sMinter.contract.connect(this.signers.others[0]).setProtocolFee(this.params.sMinter.protocolFee)).to.be.revertedWith(
  //           'sMinter: protected operation'
  //         );
  //       });
  //     });
  //   });
  // });

  // describe('⇛ core', () => {
  //   describe('# register', () => {
  //     describe('» caller has REGISTER_ROLE', () => {
  //       describe('» and pit is not registered yet', () => {
  //         describe('» and pool is not the zero address', () => {
  //           describe('» and beneficiary is not the zero address', () => {
  //             describe('» and initial price is not null', () => {
  //               describe('» and allocation is inferior to 100%', () => {
  //                 describe('» and cumulated fees are inferior to 100%', () => {
  //                   before(async () => {
  //                     await setup(this, { balancer: true, minter: true, mint: false });
  //                     this.data.pit = await this.sMinter.pitOf(this.sERC20.contract.address);
  //                   });

  //                   it('it registers pit', async () => {
  //                     expect(this.data.pit.pool).to.equal(this.sBootstrappingPool.contract.address);
  //                     expect(this.data.pit.poolId).to.equal(await this.sBootstrappingPool.getPoolId());
  //                     expect(this.data.pit.beneficiary).to.equal(this.signers.sMinter.beneficiary.address);
  //                     expect(this.data.pit.initialPrice).to.equal(this.params.sMinter.initialPrice);
  //                     expect(this.data.pit.allocation).to.equal(this.params.sMinter.allocation);
  //                     expect(this.data.pit.fee).to.equal(this.params.sMinter.fee);
  //                     expect(this.data.pit.protocolFee).to.equal(this.params.sMinter.protocolFee);
  //                     expect(this.data.pit.sERC20IsToken0).to.equal(this.sBootstrappingPool.sERC20IsToken0);
  //                   });

  //                   it('it emits a Register event', async () => {
  //                     await expect(this.data.tx)
  //                       .to.emit(this.sMinter.contract, 'Register')
  //                       .withArgs(
  //                         this.sERC20.contract.address,
  //                         this.sBootstrappingPool.contract.address,
  //                         this.signers.sMinter.beneficiary.address,
  //                         this.params.sMinter.initialPrice,
  //                         this.params.sMinter.allocation,
  //                         this.params.sMinter.fee,
  //                         this.params.sMinter.protocolFee
  //                       );
  //                   });
  //                 });

  //                 describe('» but cumulated fees are superior or equal to 100%', () => {
  //                   before(async () => {
  //                     await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //                   });

  //                   it('it reverts', async () => {
  //                     await expect(this.sMinter.register({ fee: this.constants.sMinter.HUNDRED.sub(this.params.sMinter.protocolFee) })).to.be.revertedWith(
  //                       'sMinter: cumulated fees must be inferior to 100%'
  //                     );
  //                   });
  //                 });
  //               });

  //               describe('» but allocation is superior or equal to 100%', () => {
  //                 before(async () => {
  //                   await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //                 });

  //                 it('it reverts', async () => {
  //                   await expect(this.sMinter.register({ allocation: this.constants.sMinter.HUNDRED })).to.be.revertedWith(
  //                     'sMinter: allocation must be inferior to 100%'
  //                   );
  //                 });
  //               });
  //             });

  //             describe('» but initial price is null', () => {
  //               before(async () => {
  //                 await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //               });

  //               it('it reverts', async () => {
  //                 await expect(this.sMinter.register({ initialPrice: '0' })).to.be.revertedWith('sMinter: initial price cannot be null');
  //               });
  //             });
  //           });

  //           describe('» but beneficiary is the zero address', () => {
  //             before(async () => {
  //               await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //             });

  //             it('it reverts', async () => {
  //               await expect(this.sMinter.register({ beneficiary: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
  //                 'sMinter: beneficiary cannot be the zero address'
  //               );
  //             });
  //           });
  //         });

  //         describe('» but pool is the zero address', () => {
  //           before(async () => {
  //             await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //           });

  //           it('it reverts', async () => {
  //             await expect(this.sMinter.register({ pool: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
  //               'sMinter: pool cannot be the zero address'
  //             );
  //           });
  //         });
  //       });

  //       describe('» but pit is already registered', () => {
  //         before(async () => {
  //           await setup(this, { balancer: true, minter: true, mint: false });
  //         });

  //         it('it reverts', async () => {
  //           await expect(this.sMinter.register()).to.be.revertedWith('sMinter: pit already registered');
  //         });
  //       });
  //     });

  //     describe('» caller does not have REGISTER_ROLE', () => {
  //       before(async () => {
  //         await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //       });

  //       it('it reverts', async () => {
  //         await expect(this.sMinter.register({ from: this.signers.others[0] })).to.be.revertedWith('sMinter: must have REGISTER_ROLE to register');
  //       });
  //     });
  //   });

  //   describe.only('# mint', () => {
  //     describe('» pit is registered', () => {
  //       describe('» and pool is not initialized yet', () => {
  //         describe('» and minted amount is more than expected', () => {
  //           before(async () => {
  //             await setup(this, { balancer: true, minter: true });

  //             this.data.previousBankBalance = await this.signers.sMinter.bank.getBalance();
  //             this.data.previousBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
  //             this.data.previousBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
  //             this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);
  //             this.data.previousPairPrice = this.params.sMinter.initialPrice;

  //             await this.sMinter.mint();

  //             this.data.latestTotalSupply = await this.sERC20.totalSupply();
  //             this.data.latestBankBalance = await this.signers.sMinter.bank.getBalance();
  //             this.data.latestBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
  //             this.data.latestBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
  //             this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);
  //             this.data.latestPairPrice = this.sBootstrappingPool.sERC20IsToken0
  //               ? await this.sBootstrappingPool.pairPrice()
  //               : this.constants.sMinter.DECIMALS.mul(this.constants.sMinter.DECIMALS).div(await this.sBootstrappingPool.pairPrice());

  //             this.data.expectedProtocolFee = this.params.sMinter.value.mul(this.params.sMinter.protocolFee).div(this.constants.sMinter.HUNDRED);
  //             this.data.expectedFee = this.params.sMinter.value.mul(this.params.sMinter.fee).div(this.constants.sMinter.HUNDRED);
  //             this.data.expectedReward = this.data.expectedFee
  //               .mul(this.params.sMinter.initialPrice)
  //               .mul(this.params.sBootstrappingPool.normalizedStartWeight)
  //               .div(this.constants.sBootstrappingPool.ONE.sub(this.params.sBootstrappingPool.normalizedStartWeight))
  //               .div(this.constants.sMinter.DECIMALS);
  //             this.data.expectedBeneficiaryPay = this.params.sMinter.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
  //             this.data.expectedAmount = this.params.sMinter.value
  //               .sub(this.data.expectedProtocolFee)
  //               .sub(this.data.expectedFee)
  //               .mul(this.params.sMinter.initialPrice)
  //               .div(this.constants.sMinter.DECIMALS);
  //           });

  //           it('it initializes pool', async () => {
  //             const { balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);
  //             const sBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[0] : balances[1];
  //             const eBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[1] : balances[0];

  //             expect(sBalance).to.equal(this.data.expectedReward);
  //             expect(eBalance).to.equal(this.data.expectedFee);
  //           });

  //           it('it preserves pair price', async () => {
  //             expect(this.data.latestPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
  //           });

  //           it('it mints BPT towards sMinter bank', async () => {
  //             expect(this.data.latestBankBTPBalance).to.be.gt(this.data.previousBankBTPBalance);
  //           });

  //           it('it collects protocol fee', async () => {
  //             expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
  //           });

  //           it('it pays beneficiary', async () => {
  //             expect(this.data.latestBeneficiaryBalance.sub(this.data.previousBeneficiaryBalance)).to.equal(this.data.expectedBeneficiaryPay);
  //           });

  //           it('it mints sERC20 towards recipient', async () => {
  //             expect(this.data.latestRecipientBalance.sub(this.data.previousRecipientBalance)).to.equal(this.data.expectedAmount);
  //           });

  //           it('it mints sERC20 allocation towards splitter', async () => {
  //             expect(await this.sERC20.balanceOf(this.signers.sMinter.splitter)).to.equal(
  //               this.params.sMinter.allocation.mul(this.data.latestTotalSupply).div(this.constants.sMinter.HUNDRED)
  //             );
  //           });

  //           it('it emits a Mint event', async () => {
  //             await expect(this.data.tx)
  //               .to.emit(this.sMinter.contract, 'Mint')
  //               .withArgs(this.sERC20.contract.address, this.signers.sMinter.recipient.address, this.params.sMinter.value, this.data.expectedAmount);
  //           });
  //         });

  //         describe('» but minted amount is less than expected', () => {
  //           before(async () => {
  //             await setup(this, { balancer: true, minter: true });
  //           });

  //           it('it reverts', async () => {
  //             await expect(this.sMinter.mint({ expected: ethers.utils.parseEther('1000') })).to.be.revertedWith('sMinter: insufficient minting return');
  //           });
  //         });
  //       });

  //       describe.only('» and pool is already initialized', () => {
  //         describe('» and minted amount is more than expected', () => {
  //           before(async () => {
  //             await setup(this, { balancer: true, minter: true });

  //             await this.sMinter.mint();
  //             await this.sMinter.mint();

  //             this.data.previousSBalance = this.sBootstrappingPool.sERC20IsToken0
  //               ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0]
  //               : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1];
  //             this.data.previousEBalance = this.sBootstrappingPool.sERC20IsToken0
  //               ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1]
  //               : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0];
  //             this.data.previousBPTTotalSupply = await this.sBootstrappingPool.totalSupply();
  //             this.data.previousBankBalance = await this.signers.sMinter.bank.getBalance();
  //             this.data.previousBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
  //             this.data.previousBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
  //             this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);
  //             this.data.previousSplitterBalance = await this.sERC20.balanceOf(this.signers.sMinter.splitter);
  //             this.data.previousPairPrice = this.params.sMinter.initialPrice;

  //             await advanceTime(86400);
  //             await this.sMinter.mint();
  //             await advanceTime(86400);
  //             console.log('last');
  //             await this.sMinter.mint();

  //             this.data.latestSBalance = this.sBootstrappingPool.sERC20IsToken0
  //               ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0]
  //               : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1];
  //             this.data.latestEBalance = this.sBootstrappingPool.sERC20IsToken0
  //               ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1]
  //               : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0];
  //             this.data.latestBPTTotalSupply = await this.sBootstrappingPool.totalSupply();
  //             this.data.latestTotalSupply = await this.sERC20.totalSupply();
  //             this.data.latestBankBalance = await this.signers.sMinter.bank.getBalance();
  //             this.data.latestBankBTPBalance = await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address);
  //             this.data.latestBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
  //             this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.sMinter.recipient);
  //             this.data.latestSplitterBalance = await this.sERC20.balanceOf(this.signers.sMinter.splitter);
  //             this.data.latestPairPrice = this.sBootstrappingPool.sERC20IsToken0
  //               ? await this.sBootstrappingPool.getTimeWeightedAverage([{ variable: 0, secs: 86400, ago: 0 }])
  //               : this.constants.sMinter.DECIMALS.mul(this.constants.sMinter.DECIMALS).div(
  //                   await this.sBootstrappingPool.getTimeWeightedAverage([{ variable: 0, secs: 86400, ago: 0 }])
  //                 );

  //             this.data.expectedProtocolFee = this.params.sMinter.value.mul(this.params.sMinter.protocolFee).div(this.constants.sMinter.HUNDRED);
  //             this.data.expectedFee = this.params.sMinter.value.mul(this.params.sMinter.fee).div(this.constants.sMinter.HUNDRED);
  //             this.data.expectedReward = this.data.expectedFee
  //               .mul(this.params.sMinter.latestPairPrice)
  //               .mul(this.params.sBootstrappingPool.sERC20MaxWeight)
  //               .div(this.constants.sBootstrappingPool.ONE.sub(this.params.sBootstrappingPool.sERC20MaxWeight))
  //               .div(this.constants.sMinter.DECIMALS);
  //             this.data.expectedBeneficiaryPay = this.params.sMinter.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
  //             this.data.expectedAmount = this.params.sMinter.value
  //               .sub(this.data.expectedProtocolFee)
  //               .sub(this.data.expectedFee)
  //               .mul(this.params.sMinter.latestPairPrice)
  //               .div(this.constants.sMinter.DECIMALS);
  //           });

  //           it("it updates pool's balance", async () => {
  //             console.log('Expected reward: ' + this.data.expectedReward.toString());
  //             expect(this.data.latestSBalance.sub(this.data.previousSBalance)).to.equal(this.data.expectedReward);
  //             expect(this.data.latestEBalance.sub(this.data.previousEBalance)).to.equal(this.data.expectedFee);
  //           });

  //           it('it preserves pair price', async () => {
  //             console.log('Pair price:' + this.data.latestPairPrice.toString());
  //             expect(this.data.latestPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
  //           });

  //           it('it mints no BPT', async () => {
  //             expect(this.data.latestBPTTotalSupply).to.equal(this.data.previousBPTTotalSupply);
  //           });

  //           it('it collects protocol fee', async () => {
  //             expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
  //           });

  //           it('it pays beneficiary', async () => {
  //             expect(this.data.latestBeneficiaryBalance.sub(this.data.previousBeneficiaryBalance)).to.equal(this.data.expectedBeneficiaryPay);
  //           });

  //           it('it mints sERC20 towards recipient', async () => {
  //             expect(this.data.latestRecipientBalance.sub(this.data.previousRecipientBalance)).to.equal(this.data.expectedAmount);
  //           });

  //           it('it mints sERC20 allocation towards splitter', async () => {
  //             expect(await this.sERC20.balanceOf(this.signers.sMinter.splitter)).to.be.near(
  //               this.params.sMinter.allocation.mul(this.data.latestTotalSupply).div(this.constants.sMinter.HUNDRED),
  //               MAX_RELATIVE_ERROR
  //             );
  //           });

  //           it('it emits a Mint event', async () => {
  //             await expect(this.data.tx)
  //               .to.emit(this.sMinter.contract, 'Mint')
  //               .withArgs(this.sERC20.contract.address, this.signers.sMinter.recipient.address, this.params.sMinter.value, this.data.expectedAmount);
  //           });
  //         });

  //         describe('» but minted amount is less than expected', () => {
  //           before(async () => {
  //             await setup(this, { balancer: true, minter: true });

  //             await this.sMinter.mint();
  //             await this.sMinter.mint();
  //             await advanceTime(86400);
  //           });

  //           it('it reverts', async () => {
  //             await expect(this.sMinter.mint({ expected: ethers.utils.parseEther('1000') })).to.be.revertedWith('sMinter: insufficient minting return');
  //           });
  //         });
  //       });
  //     });

  //     describe('» pit is not registered', () => {
  //       before(async () => {
  //         await setup(this, { balancer: true, minter: true, mint: false, register: false });
  //       });

  //       it('it reverts', async () => {
  //         await expect(this.sMinter.mint()).to.be.revertedWith('sMinter: no pit registered for sERC20');
  //       });
  //     });
  //   });
  // });
});
