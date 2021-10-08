const { expect } = require("chai");
const { initialize, setup } = require("../helpers");
const { Issuer } = require("../helpers/models");
const { advanceTime } = require("../helpers/time");
const { itRegistersLikeExpected, itIssuesLikeExpected } = require("./issuer.behavior");

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
              describe("» and flash issuance is enabled", () => {
                before(async () => {
                  await setup.issuer(this);
                  await this.issuer.register();
                  this.data.issuance = await this.issuer.issuanceOf(this.sERC20.contract.address);
                });

                itRegistersLikeExpected(this);

                it("it enables flash Issuance", async () => {
                  expect(this.data.issuance.flash).to.equal(true);
                });

                it("it emits a EnableFlashIssuance event", async () => {
                  await expect(this.data.tx).to.emit(this.issuer.contract, "EnableFlashIssuance").withArgs(this.sERC20.address);
                });
              });

              describe("» and flash issuance is disabled", () => {
                before(async () => {
                  await setup.issuer(this);
                  await this.issuer.register({ flash: false });
                  this.data.issuance = await this.issuer.issuanceOf(this.sERC20.contract.address);
                });

                itRegistersLikeExpected(this);

                it("it disables flash Issuance", async () => {
                  expect(this.data.issuance.flash).to.equal(false);
                });

                it("it emits no EnableFlashIssuance event", async () => {
                  await expect(this.data.tx).to.not.emit(this.issuer.contract, "EnableFlashIssuance");
                });
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
        describe("» and issuance value is not null", () => {
          describe("» and issued amount is more than expected", () => {
            describe("» and pool is not initialized yet", () => {
              before(async () => {
                await setup.issuer(this);
                await this.issuer.register();

                this.data.previousWeights = await this.pool.getNormalizedWeights();
                this.data.previousPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
                this.data.previousBankBalance = await this.signers.issuer.bank.getBalance();
                this.data.previousBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
                this.data.previousGuardianBalance = await this.signers.issuer.guardian.getBalance();
                this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);

                await this.issuer.issue();

                this.data.latestTotalSupply = await this.sERC20.totalSupply();
                this.data.latestPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
                this.data.latestWeights = await this.pool.getNormalizedWeights();
                this.data.latestBankBalance = await this.signers.issuer.bank.getBalance();
                this.data.latestBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
                this.data.latestGuardianBalance = await this.signers.issuer.guardian.getBalance();
                this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);
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

              itIssuesLikeExpected(this);

              it("it collects issuance fee BTPs towards issuer's bank", async () => {
                expect(this.data.latestBankBTPBalance).to.be.gt(this.data.previousBankBTPBalance);
              });
            });

            describe("» and pool is already initialized", () => {
              before(async () => {
                await setup.issuer(this);
                await this.issuer.register();

                await this.issuer.issue();
                await this.issuer.issue();

                // let's leave time for the twap to stablize
                await advanceTime(86400);

                this.data.previousIssuancePrice = await this.issuer.priceOf(this.sERC20.address);
                this.data.previousSpotPrice = await this.pool.latestSpotPrice();
                this.data.previousBPTSupply = await this.pool.totalSupply();
                this.data.previousWeights = await this.pool.getNormalizedWeights();
                this.data.previousPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
                this.data.previousBankBalance = await this.signers.issuer.bank.getBalance();
                this.data.previousBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
                this.data.previousGuardianBalance = await this.signers.issuer.guardian.getBalance();
                this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);
                this.data.previousPoolBalance = {
                  sERC20: this.pool.sERC20IsToken0 ? this.data.previousPoolBalances[0] : this.data.previousPoolBalances[1],
                  ETH: this.pool.sERC20IsToken0 ? this.data.previousPoolBalances[1] : this.data.previousPoolBalances[0],
                };
                await this.issuer.issue();

                this.data.latestSpotPrice = await this.pool.latestSpotPrice();
                this.data.latestTotalSupply = await this.sERC20.totalSupply();
                this.data.latestBPTSupply = await this.pool.totalSupply();
                this.data.latestPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
                this.data.latestWeights = await this.pool.getNormalizedWeights();
                this.data.latestBankBalance = await this.signers.issuer.bank.getBalance();
                this.data.latestBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
                this.data.latestGuardianBalance = await this.signers.issuer.guardian.getBalance();
                this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);
                this.data.expectedFee = this.params.issuer.value.mul(this.params.issuer.fee).div(this.constants.issuer.HUNDRED);
                this.data.expectedProtocolFee = this.params.issuer.value
                  .sub(this.data.expectedFee)
                  .mul(this.params.issuer.protocolFee)
                  .div(this.constants.issuer.HUNDRED);
                this.data.expectedAmount = this.params.issuer.value
                  .sub(this.data.expectedProtocolFee)
                  .sub(this.data.expectedFee)
                  .mul(this.data.previousIssuancePrice)
                  .div(this.constants.issuer.DECIMALS);
                this.data.expectedReward = this.data.expectedFee.mul(this.data.previousPoolBalance.sERC20).div(this.data.previousPoolBalance.ETH);
                this.data.expectedGuardianProceeds = this.params.issuer.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
              });

              itIssuesLikeExpected(this);

              it("it mints no BPT", async () => {
                expect(this.data.latestBPTSupply).to.equal(this.data.previousBPTSupply);
              });

              it("it creates a downward price pressure", async () => {
                expect(this.data.latestSpotPrice).to.gt(this.data.previousSpotPrice);
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

        describe("» but issuance value is null", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register();
          });

          it("it reverts", async () => {
            await expect(this.issuer.issue({ value: 0 })).to.be.revertedWith("Issuer: issuance value cannot be null");
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

  describe("# createProposal", () => {
    describe("» issuance is opened", () => {
      describe("» and flash issuance is disabled", () => {
        describe("» and issuance value is not null", () => {
          describe("» and issuance price is valid", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register({ flash: false });
              await this.issuer.createProposal();

              this.data.issuance = await this.issuer.issuanceOf(this.sERC20.address);
              this.data.proposal = await this.issuer.proposalFor(this.sERC20.address, this.data.proposalId);
              this.data.expectedExpiration = ethers.BigNumber.from((await ethers.provider.getBlock(this.data.receipt.blockNumber)).timestamp).add(
                this.params.issuer.lifespan
              );
            });

            it("it creates a new proposal", async () => {
              expect(this.data.issuance.nbOfProposals).to.equal(1);
              expect(this.data.proposal.state).to.equal(this.constants.issuer.proposals.state.Pending);
              expect(this.data.proposal.buyer).to.equal(this.signers.issuer.buyer.address);
              expect(this.data.proposal.value).to.equal(this.params.issuer.value);
              expect(this.data.proposal.price).to.equal(this.params.issuer.price);
              expect(this.data.proposal.expiration).to.equal(this.data.expectedExpiration);
            });

            it("it emits a CreateProposal event", async () => {
              await expect(this.data.tx)
                .to.emit(this.issuer.contract, "CreateProposal")
                .withArgs(
                  this.sERC20.address,
                  this.data.proposalId,
                  this.signers.issuer.buyer.address,
                  this.params.issuer.value,
                  this.params.issuer.price,
                  this.data.expectedExpiration
                );
            });
          });

          describe("» but issuance price is invalid", () => {
            describe("» because issuance price is null", () => {
              before(async () => {
                await setup.issuer(this);
                await this.issuer.register({ flash: false });
              });

              it("it reverts", async () => {
                await expect(this.issuer.createProposal({ price: 0 })).to.be.revertedWith("Issuer: invalid issuance price");
              });
            });

            describe("» because issuance price is lower than current price", () => {
              before(async () => {
                await setup.issuer(this);
                await this.issuer.register({ flash: false });
              });

              it("it reverts", async () => {
                await expect(this.issuer.createProposal({ price: this.params.issuer.reserve.add(this.constants.ONE) })).to.be.revertedWith(
                  "Issuer: invalid issuance price"
                );
              });
            });
          });
        });

        describe("» but issuance value is null", () => {
          before(async () => {
            await setup.issuer(this);
            await this.issuer.register({ flash: false });
          });

          it("it reverts", async () => {
            await expect(this.issuer.createProposal({ value: 0 })).to.be.revertedWith("Issuer: issuance value cannot be null");
          });
        });
      });

      describe("» but flash issuance is enabled", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register();
        });

        it("it reverts", async () => {
          await expect(this.issuer.createProposal()).to.be.revertedWith("Issuer: flash issuance is enabled");
        });
      });
    });

    describe("» issuance is not opened", () => {
      before(async () => {
        await setup.issuer(this);
        await this.issuer.register({ flash: false });
        await this.issuer.close();
      });

      it("it reverts", async () => {
        await expect(this.issuer.createProposal()).to.be.revertedWith("Issuer: invalid issuance state");
      });
    });
  });

  describe("# acceptProposal", () => {
    describe("» caller is issuance's guardian", () => {
      describe("» and issuance is opened", () => {
        describe("» and proposal is pending", () => {
          describe("» and flash issuance is disabled", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register({ flash: false });
              await this.issuer.createProposal();

              this.data.previousWeights = await this.pool.getNormalizedWeights();
              this.data.previousPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
              this.data.previousBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.previousBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.previousGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.previousRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);

              await this.issuer.acceptProposal();

              this.data.proposal = await this.issuer.proposalFor(this.sERC20.address, this.data.proposalId);
              this.data.latestTotalSupply = await this.sERC20.totalSupply();
              this.data.latestPoolBalances = (await this.contracts.bVault.getPoolTokens(this.data.poolId)).balances;
              this.data.latestWeights = await this.pool.getNormalizedWeights();
              this.data.latestBankBalance = await this.signers.issuer.bank.getBalance();
              this.data.latestBankBTPBalance = await this.pool.balanceOf(this.signers.issuer.bank.address);
              this.data.latestGuardianBalance = await this.signers.issuer.guardian.getBalance();
              this.data.latestRecipientBalance = await this.sERC20.balanceOf(this.signers.issuer.buyer.address);
              this.data.expectedFee = this.params.issuer.value.mul(this.params.issuer.fee).div(this.constants.issuer.HUNDRED);
              this.data.expectedProtocolFee = this.params.issuer.value
                .sub(this.data.expectedFee)
                .mul(this.params.issuer.protocolFee)
                .div(this.constants.issuer.HUNDRED);
              this.data.expectedAmount = this.params.issuer.value
                .sub(this.data.expectedProtocolFee)
                .sub(this.data.expectedFee)
                .mul(this.params.issuer.price)
                .div(this.constants.issuer.DECIMALS);
              this.data.expectedReward = this.data.expectedFee
                .mul(this.params.issuer.price)
                .mul(this.params.pool.sMaxNormalizedWeight)
                .div(this.constants.pool.ONE.sub(this.params.pool.sMaxNormalizedWeight))
                .div(this.constants.issuer.DECIMALS);
              this.data.expectedGuardianProceeds = this.params.issuer.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
            });

            it("it updates proposal state", async () => {
              expect(this.data.proposal.state).to.equal(this.constants.issuer.proposals.state.Accepted);
            });

            it("it emits a AcceptProposal event", async () => {
              await expect(this.data.tx).to.emit(this.issuer.contract, "AcceptProposal").withArgs(this.sERC20.address, this.data.proposalId);
            });

            itIssuesLikeExpected(this, { gas: true });
          });

          describe("» but flash issuance is enabled", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register({ flash: false });
              await this.issuer.createProposal();
              await this.issuer.enableFlashIssuance();
            });

            it("it reverts", async () => {
              await expect(this.issuer.acceptProposal()).to.be.revertedWith("Issuer: flash issuance is enabled");
            });
          });
        });

        describe("» but proposal is not pending", () => {
          describe("» because proposal is lapsed", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register({ flash: false });
              await this.issuer.createProposal();
              await advanceTime(this.params.broker.lifespan.add(this.constants.ONE));
            });

            it("it reverts", async () => {
              await expect(this.issuer.acceptProposal()).to.be.revertedWith("Issuer: invalid proposal state");
            });
          });

          describe("» because proposal is already accepted", () => {
            before(async () => {
              await setup.issuer(this);
              await this.issuer.register({ flash: false });
              await this.issuer.createProposal();
              await this.issuer.acceptProposal();
            });

            it("it reverts", async () => {
              await expect(this.issuer.acceptProposal()).to.be.revertedWith("Issuer: invalid proposal state");
            });
          });
        });
      });

      describe("» but issuance is not opened", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register({ flash: false });
          await this.issuer.createProposal();
          await this.issuer.close();
        });

        it("it reverts", async () => {
          await expect(this.issuer.acceptProposal()).to.be.revertedWith("Issuer: invalid issuance state");
        });
      });
    });

    describe("» caller is not sale's guardian", () => {
      before(async () => {
        await setup.issuer(this);
        await this.issuer.register({ flash: false });
        await this.issuer.createProposal();
      });

      it("it reverts", async () => {
        await expect(this.issuer.acceptProposal({ from: this.signers.others[0] })).to.be.revertedWith("Issuer: must be issuance's guardian to accept proposal");
      });
    });
  });

  describe("# close", () => {
    describe("» caller has CLOSE_ROLE", () => {
      describe("» and issuance is opened", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register();
          await this.issuer.close();
        });

        it("it closes issuance", async () => {
          expect((await this.issuer.issuanceOf(this.sERC20.address)).state).to.equal(this.constants.issuer.issuances.state.Closed);
        });

        it("it emits a Close event", async () => {
          await expect(this.data.tx).to.emit(this.issuer.contract, "Close").withArgs(this.sERC20.address);
        });
      });

      describe("» but issuance is not opened", () => {
        before(async () => {
          await setup.issuer(this);
          await this.issuer.register();
          await this.issuer.close();
        });

        it("it reverts", async () => {
          await expect(this.issuer.close()).to.be.revertedWith("Issuer: invalid issuance state");
        });
      });
    });

    describe("» caller does not have CLOSE_ROLE", () => {
      before(async () => {
        await setup.issuer(this);
        await this.issuer.register();
      });

      it("it reverts", async () => {
        await expect(this.issuer.close({ from: this.signers.others[0] })).to.be.revertedWith("Issuer: must have CLOSE_ROLE to close issuance");
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
            await this.issuer.enableFlashIssuance();
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
            await expect(this.issuer.enableFlashIssuance()).to.be.revertedWith("Issuer: flash issuance already enabled");
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
          await expect(this.issuer.enableFlashIssuance()).to.be.revertedWith("Issuer: invalid issuance state");
        });
      });
    });

    describe("» caller is not issuance's guardian", () => {
      before(async () => {
        await setup.issuer(this);
        await this.issuer.register({ flash: false });
      });

      it("it reverts", async () => {
        await expect(this.issuer.enableFlashIssuance({ from: this.signers.others[0] })).to.be.revertedWith(
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

  describe("# twapOf", () => {
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
