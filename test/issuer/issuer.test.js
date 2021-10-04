const chai = require("chai");
const { expect } = require("chai");
const { ethers } = require("ethers");
const { initialize, setup } = require("../helpers");
const { near } = require("../helpers/chai");
const { issuer } = require("../helpers/config");
const { Issuer } = require("../helpers/models");
const { advanceTime, currentTimestamp } = require("../helpers/time");

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe("Issuer", () => {
  before(async () => {
    await initialize(this);
  });

  describe("# constructor", () => {
    describe("» vault is not the zero address", () => {
      describe("» and pool factory is not the zero address", () => {
        describe("» and splitter is not the zero address", () => {
          describe("» and bank is not the zero address", () => {
            describe("» and protocol fee is inferior to 100%", () => {
              before(async () => {
                await setup.issuer(this);
              });

              it("it sets up the issuer's vault", async () => {
                expect(await this.issuer.vault()).to.equal(this.contracts.bVault.address);
              });

              it("it sets up the issuer's pool factory", async () => {
                expect(await this.issuer.poolFactory()).to.equal(this.poolFactory.address);
              });

              it("it sets up the issuer's splitter", async () => {
                expect(await this.issuer.splitter()).to.equal(this.signers.issuer.splitter.address);
              });

              it("it sets up the issuer's bank", async () => {
                expect(await this.issuer.bank()).to.equal(this.signers.issuer.bank.address);
              });

              it("it sets up the issuer's protocol fee", async () => {
                expect(await this.issuer.protocolFee()).to.equal(this.params.issuer.protocolFee);
              });

              it("it sets up the issuer's WETH", async () => {
                expect(await this.issuer.WETH()).to.equal(this.contracts.WETH.address);
              });

              it("it sets up the issuer's permissions", async () => {
                expect(await this.issuer.hasRole(this.constants.issuer.DEFAULT_ADMIN_ROLE, this.signers.issuer.admin.address)).to.equal(true);
              });

              it("it emits a SetBank event", async () => {
                await expect(this.issuer.contract.deployTransaction).to.emit(this.issuer.contract, "SetBank").withArgs(this.signers.issuer.bank.address);
              });

              it("it emits a SetProtocolFee event", async () => {
                await expect(this.issuer.contract.deployTransaction).to.emit(this.issuer.contract, "SetProtocolFee").withArgs(this.params.issuer.protocolFee);
              });
            });

            describe("» but protocol fee is superior or equal to 100%", () => {
              it("it reverts", async () => {
                await expect(
                  Issuer.deploy(this, {
                    protocolFee: this.constants.issuer.HUNDRED,
                  })
                ).to.be.revertedWith("Issuer: protocol fee must be inferior to 100%");
              });
            });
          });

          describe("» but bank is the zero address", () => {
            it("it reverts", async () => {
              await expect(
                Issuer.deploy(this, {
                  bank: { address: ethers.constants.AddressZero },
                })
              ).to.be.revertedWith("Issuer: bank cannot be the zero address");
            });
          });
        });

        describe("» but splitter is the zero address", () => {
          it("it reverts", async () => {
            await expect(
              Issuer.deploy(this, {
                splitter: { address: ethers.constants.AddressZero },
              })
            ).to.be.revertedWith("Issuer: splitter cannot be the zero address");
          });
        });
      });

      describe("» but pool factory is the zero address", () => {
        it("it reverts", async () => {
          await expect(
            Issuer.deploy(this, {
              poolFactory: { address: ethers.constants.AddressZero },
            })
          ).to.be.revertedWith("Issuer: pool factory cannot be the zero address");
        });
      });
    });

    describe("» vault is the zero address", () => {
      it("it reverts", async () => {
        await expect(
          Issuer.deploy(this, {
            vault: { address: ethers.constants.AddressZero },
          })
        ).to.be.revertedWith("Issuer: vault cannot be the zero address");
      });
    });
  });

  describe("# register", () => {
    describe("» caller has REGISTER_ROLE", () => {
      describe("» and guardian is not the zero address", () => {
        describe("» and reserve price is not null", () => {
          describe("» and allocation is inferior to 100%", () => {
            describe("» and issuance fee is inferior to 100%", () => {
              before(async () => {
                await setup.issuer(this);
                await this.issuer.register();
                this.data.issuance = await this.issuer.issuanceOf(this.sERC20.contract.address);
              });

              it("it deploys FractionalizationBootstrappingPool", async () => {
                expect(await this.pool.getPoolId()).to.equal(this.data.issuance.poolId);
              });

              it("it registers issuance", async () => {
                expect(this.data.issuance.state).to.equal(this.constants.issuer.issuances.state.Opened);
                expect(this.data.issuance.guardian).to.equal(this.signers.issuer.guardian.address);
                expect(this.data.issuance.pool).to.equal(this.pool.address);
                expect(this.data.issuance.poolId).to.equal(this.data.poolId);
                expect(this.data.issuance.reserve).to.equal(this.params.issuer.reserve);
                expect(this.data.issuance.allocation).to.equal(this.params.issuer.allocation);
                expect(this.data.issuance.fee).to.equal(this.params.issuer.fee);
                expect(this.data.issuance.nbOfProposals).to.equal(0);
                expect(this.data.issuance.flash).to.equal(true);
                expect(this.data.issuance.sERC20IsToken0).to.equal(this.pool.sERC20IsToken0);
              });

              it("it emits a Register event", async () => {
                await expect(this.data.tx)
                  .to.emit(this.issuer.contract, "Register")
                  .withArgs(
                    this.sERC20.contract.address,
                    this.signers.issuer.guardian.address,
                    this.pool.address,
                    this.data.poolId,
                    this.params.pool.sMaxNormalizedWeight,
                    this.params.pool.sMinNormalizedWeight,
                    this.params.pool.swapFeePercentage,
                    this.params.issuer.reserve,
                    this.params.issuer.allocation,
                    this.params.issuer.fee
                  );
              });
            });

            describe("» but issuance fee is superior or equal to 100%", () => {
              before(async () => {
                await setup.issuer(this);
              });

              it("it reverts", async () => {
                await expect(
                  this.issuer.register({
                    fee: this.constants.issuer.HUNDRED,
                  })
                ).to.be.revertedWith("Issuer: issuance fee must be inferior to 100%");
              });
            });
          });
        });

        describe("» but reserve price is null", () => {
          before(async () => {
            await setup.issuer(this);
          });

          it("it reverts", async () => {
            await expect(this.issuer.register({ reserve: 0 })).to.be.revertedWith("Issuer: reserve price cannot be null");
          });
        });
      });

      describe("» but guardian is the zero address", () => {
        before(async () => {
          await setup.issuer(this);
        });

        it("it reverts", async () => {
          await expect(
            this.issuer.register({
              guardian: { address: ethers.constants.AddressZero },
            })
          ).to.be.revertedWith("Issuer: guardian cannot be the zero address");
        });
      });
    });

    describe("» caller does not have REGISTER_ROLE", () => {
      before(async () => {
        await setup.issuer(this);
      });

      it("it reverts", async () => {
        await expect(this.issuer.register({ from: this.signers.others[0] })).to.be.revertedWith("Issuer: must have REGISTER_ROLE to register");
      });
    });
  });

  describe("# issue", () => {
    describe("» issuance is opened", () => {
      describe("» and flash issuance is enabled", () => {
        describe("» and issued amount is more than expected", () => {
          describe("» and pool is not initialized yet", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();

              this.data.previousWeights = await this.pool.getNormalizedWeights();
              this.data.previousBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.previousBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.previousGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.others[0].address);

              await this.issuer.issue();

              this.data.latestTotalSupply = await this.sERC20.totalSupply();
              this.data.latestPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
              this.data.latestWeights = await this.pool.getNormalizedWeights();
              this.data.latestBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.latestBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.latestGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.others[0].address);
              this.data.expectedFee = this.params.issuer.value.mul(this.params.issuer.fee).div(this.constants.issuer.HUNDRED);
              this.data.expectedProtocolFee = this.params.issuer.value
                .sub(this.data.expectedFee)
                .mul(this.params.issuer.protocolFee)
                .div(this.constants.issuer.HUNDRED);
              this.data.expectedAmount = this.params.issuer.value
                .sub(this.data.expectedProtocolFee)
                .sub(this.data.expectedFee)
                .mul(this.params.issuer.reserve)
                .div(this.constants.issuer.DECIMALS);
              this.data.expectedReward = this.data.expectedFee
                .mul(this.params.issuer.reserve)
                .mul(this.params.pool.sMaxNormalizedWeight)
                .div(this.constants.pool.ONE.sub(this.params.pool.sMaxNormalizedWeight))
                .div(this.constants.issuer.DECIMALS);
              this.data.expectedGuardianProceeds = this.params.issuer.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
            });

            it("it collects issuance fee towards pool", async () => {
              expect(this.pool.sERC20IsToken0 ? this.data.latestPoolBalances[0] : this.data.latestPoolBalances[1]).to.equal(this.data.expectedReward);
              expect(this.pool.sERC20IsToken0 ? this.data.latestPoolBalances[1] : this.data.latestPoolBalances[0]).to.equal(this.data.expectedFee);
            });

            it("it collects issuance fee BTPs towards issuer's bank", async () => {
              expect(this.data.latestBankBTPBalance).to.be.gt(this.data.previousBankBTPBalance);
            });

            it("it collects protocol fee towards issuer's bank", async () => {
              expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
            });

            it("it collects proceeds towards issuance's guardian", async () => {
              expect(this.data.latestGuardianBalance.sub(this.data.previousGuardianBalance)).to.equal(this.data.expectedGuardianProceeds);
            });

            it("it mints sERC20 issuance towards recipient", async () => {
              expect(this.data.latestRecipientBalance.sub(this.data.previousRecipientBalance)).to.equal(this.data.expectedAmount);
            });

            it("it mints sERC20 allocation towards splitter", async () => {
              expect(await this.sERC20.balanceOf(this.signers.issuer.splitter.address)).to.equal(
                this.params.issuer.allocation.mul(this.data.latestTotalSupply).div(this.constants.issuer.HUNDRED)
              );
            });

            it("it pokes pool's weights", async () => {
              expect(this.data.previousWeights[0]).to.not.equal(this.data.latestWeights[0]);
              expect(this.data.previousWeights[1]).to.not.equal(this.data.latestWeights[1]);
            });

            it("it emits a Issue event", async () => {
              await expect(this.data.tx)
                .to.emit(this.issuer.contract, "Issue")
                .withArgs(this.sERC20.contract.address, this.signers.others[0].address, this.params.issuer.value, this.data.expectedAmount);
            });
          });

          describe("» and pool is already initialized", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();

              await this.issuer.mint();
              await this.issuer.mint();

              this.data.previousPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
              this.data.previousPoolBalanceERC20 = this.pool.sERC20IsToken0 ? this.data.previousPoolBalances[0] : this.data.previousPoolBalances[1];
              this.data.previousPoolBalanceETH = this.pool.sERC20IsToken0 ? this.data.previousPoolBalances[1] : this.data.previousPoolBalances[0];
              this.data.previousBPTTotalSupply = await this.pool.totalSupply();
              this.data.previousBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.previousBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.previousGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.recipient);
              this.data.previousSplitterBalance = await this.sERC20.balanceOf(this.signers.issuer.splitter);
              this.data.previousPairPrice = this.params.issuer.reserve;

              await advanceTime(86400);
              await this.issuer.mint();
              await advanceTime(86400);
              await this.issuer.mint();

              this.data.latestSBalance = this.pool.sERC20IsToken0
                ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0]
                : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1];
              this.data.latestEBalance = this.pool.sERC20IsToken0
                ? (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[1]
                : (await this.contracts.Vault.getPoolTokens(this.data.poolId)).balances[0];
              this.data.latestBPTTotalSupply = await this.pool.totalSupply();
              this.data.latestTotalSupply = await this.sERC20.totalSupply();
              this.data.latestBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.latestBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.latestGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.recipient);
              this.data.latestSplitterBalance = await this.sERC20.balanceOf(this.signers.issuer.splitter);

              this.data.expectedProtocolFee = this.params.issuer.value.mul(this.params.issuer.protocolFee).div(this.constants.issuer.HUNDRED);
              this.data.expectedFee = this.params.issuer.value.mul(this.params.issuer.fee).div(this.constants.issuer.HUNDRED);
              this.data.expectedReward = this.data.expectedFee
                .mul(this.params.issuer.latestPairPrice)
                .mul(this.params.pool.sERC20MaxWeight)
                .div(this.constants.pool.ONE.sub(this.params.pool.sERC20MaxWeight))
                .div(this.constants.issuer.DECIMALS);
              this.data.expectedBeneficiaryPay = this.params.issuer.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
              this.data.expectedAmount = this.params.issuer.value
                .sub(this.data.expectedProtocolFee)
                .sub(this.data.expectedFee)
                .mul(this.params.issuer.latestPairPrice)
                .div(this.constants.issuer.DECIMALS);
            });

            it("it updates pool's balance", async () => {
              expect(this.data.latestSBalance.sub(this.data.previousSBalance)).to.equal(this.data.expectedReward);
              expect(this.data.latestEBalance.sub(this.data.previousEBalance)).to.equal(this.data.expectedFee);
            });

            it("it preserves pair price", async () => {
              console.log("Pair price:" + this.data.latestPairPrice.toString());
              expect(this.data.latestPairPrice).to.be.near(this.data.previousPairPrice, MAX_RELATIVE_ERROR);
            });

            it("it mints no BPT", async () => {
              expect(this.data.latestBPTTotalSupply).to.equal(this.data.previousBPTTotalSupply);
            });

            it("it collects protocol fee", async () => {
              expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
            });

            it("it pays beneficiary", async () => {
              expect(this.data.latestGuardianBalance.sub(this.data.previousGuardianBalance)).to.equal(this.data.expectedBeneficiaryPay);
            });

            it("it mints sERC20 towards recipient", async () => {
              expect(this.data.latestRecipientBalance.sub(this.data.previousRecipientBalance)).to.equal(this.data.expectedAmount);
            });

            it("it mints sERC20 allocation towards splitter", async () => {
              expect(await this.sERC20.balanceOf(this.signers.issuer.splitter)).to.be.near(
                this.params.issuer.allocation.mul(this.data.latestTotalSupply).div(this.constants.issuer.HUNDRED),
                MAX_RELATIVE_ERROR
              );
            });

            it("it emits a Mint event", async () => {
              await expect(this.data.tx)
                .to.emit(this.issuer.contract, "Mint")
                .withArgs(this.sERC20.contract.address, this.signers.issuer.recipient.address, this.params.issuer.value, this.data.expectedAmount);
            });
          });
        });

        describe("» but issued amount is less than expected", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register();
          });

          it("it reverts", async () => {
            await expect(this.issuer.issue({ expected: ethers.utils.parseEther("1000") })).to.be.revertedWith("Issuer: insufficient issuance return");
          });
        });
      });

      describe("» but flash issuance is disabled", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register({ flash: false });
        });

        it("it reverts", async () => {
          await expect(this.issuer.issue()).to.be.revertedWith("Issuer: flash issuance is disabled");
        });
      });
    });

    describe("» issuance is not opened", () => {
      before(async () => {
        await setup.issuer(this);
      });

      it("it reverts", async () => {
        await expect(this.issuer.issue()).to.be.revertedWith("Issuer: invalid issuance state");
      });
    });
  });

  describe("# enableFlashIssuance", () => {
    describe("» caller is issuance's guardian", () => {
      describe("» and issuance is opened", () => {
        describe("» and flash issuance is disabled", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register({ flash: false });

            this.data.tx = await this.issuer.contract.connect(this.signers.issuer.guardian).enableFlashIssuance(this.sERC20.address);
            this.data.receipt = await this.data.tx.wait();
          });

          it("it enables flash issuance", async () => {
            expect((await this.issuer.issuanceOf(this.sERC20.address)).flash).to.equal(true);
          });

          it("it emits a EnableFlashIssuance event", async () => {
            await expect(this.data.tx).to.emit(this.issuer.contract, "EnableFlashIssuance").withArgs(this.sERC20.address);
          });
        });

        describe("» but flash issuance is already enabled", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register();
          });

          it("it reverts", async () => {
            await expect(this.issuer.contract.connect(this.signers.issuer.guardian).enableFlashIssuance(this.sERC20.address)).to.be.revertedWith(
              "Issuer: flash issuance already enabled"
            );
          });
        });
      });

      describe("» but issuance is not opened", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register();
          await this.issuer.close();
        });

        it("it reverts", async () => {
          await expect(this.issuer.contract.connect(this.signers.issuer.guardian).enableFlashIssuance(this.sERC20.address)).to.be.revertedWith(
            "Issuer: invalid issuance state"
          );
        });
      });
    });

    describe("» caller is not issuance's guardian", () => {
      before(async () => {
        await setup.issuer(this);
        await this.issuer.register({ flash: false });
      });

      it("it reverts", async () => {
        await expect(this.issuer.contract.connect(this.signers.others[0]).enableFlashIssuance(this.sERC20.address)).to.be.revertedWith(
          "Issuer: must be issuance's guardian to enable flash issuance"
        );
      });
    });
  });

  describe("# setBank", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and bank is not the zero address", () => {
        before(async () => {
          await setup.issuer(this);
          this.data.tx = await this.issuer.contract.connect(this.signers.issuer.admin).setBank(this.signers.others[0].address);
          this.data.receipt = await this.data.tx.wait();
        });

        it("it sets bank", async () => {
          expect(await this.issuer.bank()).to.equal(this.signers.others[0].address);
        });

        it("it emits a SetBank event", async () => {
          await expect(this.data.tx).to.emit(this.issuer.contract, "SetBank").withArgs(this.signers.others[0].address);
        });
      });

      describe("» but bank is the zero address", () => {
        before(async () => {
          await setup.issuer(this);
        });

        it("it reverts", async () => {
          await expect(this.issuer.contract.connect(this.signers.issuer.admin).setBank(ethers.constants.AddressZero)).to.be.revertedWith(
            "Issuer: bank cannot be the zero address"
          );
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.issuer(this);
      });

      it("it reverts", async () => {
        await expect(this.issuer.contract.connect(this.signers.others[0]).setBank(this.signers.others[0].address)).to.be.revertedWith(
          "Issuer: must have DEFAULT_ADMIN_ROLE to set bank"
        );
      });
    });
  });

  describe("# setProtocolFee", () => {
    describe("» caller has DEFAULT_ADMIN_ROLE", () => {
      describe("» and protocol fee is inferior to 100%", () => {
        before(async () => {
          await setup.issuer(this);
          this.data.tx = await this.issuer.contract.connect(this.signers.issuer.admin).setProtocolFee(1000);
          this.data.receipt = await this.data.tx.wait();
        });

        it("it sets protocol fee", async () => {
          expect(await this.issuer.protocolFee()).to.equal(1000);
        });

        it("it emits a SetBank event", async () => {
          await expect(this.data.tx).to.emit(this.issuer.contract, "SetProtocolFee").withArgs(1000);
        });
      });

      describe("» but protocol fee is superior or equal to 100%", () => {
        before(async () => {
          await setup.issuer(this);
        });

        it("it reverts", async () => {
          await expect(this.issuer.contract.connect(this.signers.issuer.admin).setProtocolFee(this.constants.issuer.HUNDRED)).to.be.revertedWith(
            "Issuer: protocol fee must be inferior to 100%"
          );
        });
      });
    });

    describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
      before(async () => {
        await setup.issuer(this);
      });

      it("it reverts", async () => {
        await expect(this.issuer.contract.connect(this.signers.others[0]).setProtocolFee(this.params.issuer.protocolFee)).to.be.revertedWith(
          "Issuer: must have DEFAULT_ADMIN_ROLE to set protocol fee"
        );
      });
    });
  });

  describe.only("# twapOf", () => {
    describe("» issuance is opened", () => {
      describe("» sERC20 per ETH", () => {
        describe("» pool is not initialized yet", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register();
          });

          it("it returns the reserve price", async () => {
            expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20)).to.equal(this.params.issuer.reserve);
          });
        });

        describe("» pool is initialized", () => {
          describe("» and sERC20s are swapped out", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();
              await this.issuer.issue();

              this.data.previousTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20);
              this.data.previousSpotPrice = await this.pool.latestSpotPrice();

              await this.pool.swap();
              await advanceTime(180);
              await this.pool.swap();

              this.data.latestTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20);
              this.data.latestSpotPrice = await this.pool.latestSpotPrice();
            });

            it("it returns a lower spot price [in sERC20 per ETH]", async () => {
              expect(this.data.latestSpotPrice).to.be.lt(this.data.previousSpotPrice);
            });

            it("it returns a lower TWAP [in sERC20 per ETH]", async () => {
              expect(this.data.latestTWAP).to.be.lt(this.data.previousTWAP);
            });

            describe("» and times moves forward", () => {
              before(async () => {
                await advanceTime(20000);
              });

              it("it returns an even lower TWAP", async () => {
                expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20)).to.be.lt(this.data.latestTWAP);
              });

              describe("» and times moves forward up to 24h", () => {
                before(async () => {
                  await advanceTime(66400);
                });

                it("it returns the latest spot price", async () => {
                  expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20)).to.equal(this.data.latestSpotPrice);
                });
              });
            });
          });

          describe("» and sERC20s are swapped in", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();
              await this.issuer.issue();

              this.data.previousTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20);
              this.data.previousSpotPrice = await this.pool.latestSpotPrice();

              await this.pool.swap({ sERC20: true });
              await advanceTime(180);
              await this.pool.swap({ sERC20: true });

              this.data.latestTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20);
              this.data.latestSpotPrice = await this.pool.latestSpotPrice();
            });

            it("it returns a higher spot price [in sERC20 per ETH]", async () => {
              expect(this.data.latestSpotPrice).to.be.gt(this.data.previousSpotPrice);
            });

            it("it returns a higher TWAP [in sERC20 per ETH]", async () => {
              expect(this.data.latestTWAP).to.be.gt(this.data.previousTWAP);
            });

            describe("» and times moves forward", () => {
              before(async () => {
                await advanceTime(20000);
              });

              it("it returns an even higher TWAP", async () => {
                expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20)).to.be.gt(this.data.latestTWAP);
              });

              describe("» and times moves forward up to 24h", () => {
                before(async () => {
                  await advanceTime(66400);
                });

                it("it returns the latest spot price", async () => {
                  expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.sERC20)).to.equal(this.data.latestSpotPrice);
                });
              });
            });
          });
        });
      });

      describe("» ETH per sERC20", () => {
        describe("» pool is not initialized yet", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register();
          });

          it("it returns the reserve price", async () => {
            expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)).to.equal(
              this.constants.issuer.DECIMALS.mul(this.constants.issuer.DECIMALS).div(this.params.issuer.reserve)
            );
          });
        });

        describe("» pool is initialized", () => {
          describe("» and sERC20s are swapped out", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();
              await this.issuer.issue();

              this.data.previousTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH);
              this.data.previousSpotPrice = await this.pool.latestSpotPrice({ ETH: true });

              await this.pool.swap();
              await advanceTime(180);
              await this.pool.swap();

              this.data.latestTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH);
              this.data.latestSpotPrice = await this.pool.latestSpotPrice({ ETH: true });
            });

            it("it returns a higher spot price [in ETH per sERC20]", async () => {
              expect(this.data.latestSpotPrice).to.be.gt(this.data.previousSpotPrice);
            });

            it("it returns a higher TWAP [in ETH per sERC20]", async () => {
              expect(this.data.latestTWAP).to.be.gt(this.data.previousTWAP);
            });

            describe("» and times moves forward", () => {
              before(async () => {
                await advanceTime(20000);
              });

              it("it returns an even higher TWAP", async () => {
                expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)).to.be.gt(this.data.latestTWAP);
              });

              describe("» and times moves forward up to 24h", () => {
                before(async () => {
                  await advanceTime(66400);
                });

                it("it returns the latest spot price", async () => {
                  expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)).to.equal(this.data.latestSpotPrice);
                });
              });
            });
          });

          describe("» and sERC20s are swapped in", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register();
              await this.issuer.issue();

              this.data.previousTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH);
              this.data.previousSpotPrice = await this.pool.latestSpotPrice({ ETH: true });

              await this.pool.swap({ sERC20: true });
              await advanceTime(180);
              await this.pool.swap({ sERC20: true });

              this.data.latestTWAP = await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH);
              this.data.latestSpotPrice = await this.pool.latestSpotPrice({ ETH: true });
            });

            it("it returns a lower spot price [in ETH per sERC20]", async () => {
              expect(this.data.latestSpotPrice).to.be.lt(this.data.previousSpotPrice);
            });

            it("it returns a lower TWAP [in ETH per sERC20]", async () => {
              expect(this.data.latestTWAP).to.be.lt(this.data.previousTWAP);
            });

            describe("» and times moves forward", () => {
              before(async () => {
                await advanceTime(20000);
              });

              it("it returns an even lower TWAP", async () => {
                expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)).to.be.lt(this.data.latestTWAP);
              });

              describe("» and times moves forward up to 24h", () => {
                before(async () => {
                  await advanceTime(66400);
                });

                it("it returns the latest spot price", async () => {
                  expect(await this.issuer.twapOf(this.sERC20.address, this.constants.issuer.TwapKind.ETH)).to.equal(this.data.latestSpotPrice);
                });
              });
            });
          });
        });
      });
    });

    describe("» issuance is not opened", () => {
      before(async () => {
        await setup.issuer(this);
      });

      it("it reverts", async () => {
        await expect(this.issuer.contract.twapOf(ethers.constants.AddressZero, this.constants.issuer.TwapKind.sERC20)).to.be.revertedWith(
          "Issuer: invalid issuance state"
        );
      });
    });
  });
});
