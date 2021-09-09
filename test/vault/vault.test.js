const { expect } = require("chai");
const { initialize, mock, setup } = require("../helpers");
const {
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itFractionalizesLikeExpected,
  itUnlocksLikeExpected,
} = require("./vault.behavior");

describe("Vault", () => {
  before(async () => {
    await initialize(this);
  });

  describe("⇛ constructor", () => {
    describe("» sERC20 base address is not the zero address", () => {
      before(async () => {
        await setup.vault(this, { fractionalize: false });
      });

      it("# it sets up sERC20 base address ", async () => {
        expect(await this.vault.sERC20Base()).to.equal(this.contracts.sERC20Base.address);
      });

      it("# it sets up unavailableURI ", async () => {
        expect(await this.vault.unavailableURI()).to.equal(this.params.vault.unavailableURI);
      });

      it("# it sets up unlockedURI", async () => {
        expect(await this.vault.unlockedURI()).to.equal(this.params.vault.unlockedURI);
      });

      it("# it sets up admin permissions", async () => {
        expect(await this.vault.hasRole(this.constants.vault.DEFAULT_ADMIN_ROLE, this.signers.vault.admin.address)).to.equal(true);
      });
    });

    describe("» sERC20 base address is the zero address", () => {
      it("it reverts", async () => {
        await expect(
          waffle.deployContract(this.signers.vault.admin, this.vault.artifact, [
            ethers.constants.AddressZero,
            this.params.vault.unavailableURI,
            this.params.vault.unlockedURI,
          ])
        ).to.be.revertedWith("Vault: sERC20 base cannot be the zero address");
      });
    });
  });

  describe("⇛ IERC165", () => {
    before(async () => {
      await setup.vault(this, { fractionalize: false });
    });

    it("it supports ERC165 interface", async () => {
      expect(await this.vault.supportsInterface(0x01ffc9a7)).to.equal(true);
    });

    it("it supports AccessControlEnumerable interface", async () => {
      expect(await this.vault.supportsInterface(0x5a05180f)).to.equal(true);
    });

    it("it supports ERC1155 interface", async () => {
      expect(await this.vault.supportsInterface(0xd9b67a26)).to.equal(true);
    });

    it("it supports ERC1155MetadataURI interface", async () => {
      expect(await this.vault.supportsInterface(0x0e89341c)).to.equal(true);
    });

    it("it supports ERC721TokenReceiver interface", async () => {
      expect(await this.vault.supportsInterface(0x150b7a02)).to.equal(true);
    });

    it("it does not support ERC1155TokenReceiver interface", async () => {
      expect(await this.vault.supportsInterface(0x4e2312e0)).to.equal(false);
    });
  });

  describe("⇛ IERC1155", () => {
    describe("# balanceOf", () => {
      describe("» the queried address is not the zero address", () => {
        describe("» and the queried token type exists", () => {
          before(async () => {
            await setup.vault(this);
            await this.sERC20.mint({
              to: this.signers.holders[0],
              amount: this.params.vault.amount1,
            });
            await this.sERC20.mint({
              to: this.signers.holders[1],
              amount: this.params.vault.amount2,
            });
          });

          it("it returns the amount of tokens owned by the queried address", async () => {
            expect(await this.vault.balanceOf(this.signers.holders[0].address, this.data.id)).to.equal(this.params.vault.amount1);
            expect(await this.vault.balanceOf(this.signers.holders[1].address, this.data.id)).to.equal(this.params.vault.amount2);
            expect(await this.vault.balanceOf(this.signers.holders[2].address, this.data.id)).to.equal(0);
          });
        });

        describe("# but the queried token type does not exist", () => {
          before(async () => {
            await setup.vault(this, { fractionalize: false });
          });

          it("it returns zero", async () => {
            expect(await this.vault.balanceOf(this.signers.holders[0].address, "123456789")).to.equal(0);
          });
        });
      });

      describe("» the queried address is the zero address", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(this.vault.balanceOf(ethers.constants.AddressZero, this.data.id)).to.be.revertedWith("Vault: balance query for the zero address");
        });
      });
    });

    describe("# balanceOfBatch", () => {
      describe("» input arrays match", () => {
        describe("» and no queried address is the zero address", () => {
          before(async () => {
            await setup.vault(this);

            this.data.id1 = this.data.id;
            await this.sERC20.mint({
              to: this.signers.holders[0],
              amount: this.params.vault.amount1,
            });
            await this.sERC20.mint({
              to: this.signers.holders[1],
              amount: this.params.vault.amount2,
            });

            await this.sERC721.mint();
            await this.vault.fractionalize();

            this.data.id2 = this.data.id;
            await this.sERC20.mint({
              to: this.signers.holders[0],
              amount: this.params.vault.amount3,
            });
            await this.sERC20.mint({
              to: this.signers.holders[2],
              amount: this.params.vault.amount4,
            });

            this.data.balances = await this.vault.balanceOfBatch(
              [this.signers.holders[0].address, this.signers.holders[1].address, this.signers.holders[2].address],
              [this.data.id1, this.data.id2, "123456789"]
            );
          });

          it("it returns the amount of tokens owned by the queried addresses", async () => {
            expect(this.data.balances[0]).to.equal(this.params.vault.amount1);
            expect(this.data.balances[1]).to.equal(0);
            expect(this.data.balances[2]).to.equal(0);
          });
        });

        describe("» but one of the queried address is the zero address", () => {
          before(async () => {
            await setup.vault(this);
          });

          it("it reverts", async () => {
            await expect(
              this.vault.balanceOfBatch([this.signers.holders[0].address, ethers.constants.AddressZero], [this.data.id, this.data.id])
            ).to.be.revertedWith("Vault: balance query for the zero address");
          });
        });
      });

      describe("» input arrays do not match", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(
            this.vault.balanceOfBatch([this.signers.holders[0].address, this.signers.holders[1].address], [this.data.id, this.data.id, this.data.id])
          ).to.be.revertedWith("Vault: accounts and ids length mismatch");
        });
      });
    });

    describe("# setApprovalForAll", () => {
      describe("» operator is not setting approval status for self", () => {
        before(async () => {
          await setup.vault(this);
          await this.vault.setApprovalForAll();
        });

        it("it registers approval status", async () => {
          expect(await this.vault.isApprovedForAll(this.signers.holders[0].address, this.signers.vault.operator.address)).to.equal(true);
        });

        it("it emits an ApprovalForAll event", async () => {
          await expect(this.data.tx)
            .to.emit(this.vault.contract, "ApprovalForAll")
            .withArgs(this.signers.holders[0].address, this.signers.vault.operator.address, true);
        });
      });

      describe("» operator is setting approval status for self", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(
            this.vault.setApprovalForAll({
              from: this.signers.vault.operator,
              operator: this.signers.vault.operator,
            })
          ).to.be.revertedWith("Vault: setting approval status for self");
        });
      });
    });

    describe("# safeTransferFrom", () => {
      describe("» recipient is not the zero address", () => {
        describe("» and transferred amount is inferior to sender's balance", () => {
          describe("» and transfer is triggered by sender", () => {
            describe("» and the receiver is an EOA", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint();
                await this.vault.safeTransferFrom();
              });

              itSafeTransfersFromLikeExpected(this);
            });

            describe("» and the receiver is a contract", () => {
              describe("» and the receiver contract implements onERC1155Received", () => {
                describe("» and the receiver contract returns a valid value", () => {
                  before(async () => {
                    await setup.vault(this);
                    await this.sERC20.mint();
                    await mock.deploy.ERC1155Receiver(this);
                    await this.vault.safeTransferFrom({
                      to: this.contracts.ERC1155Receiver,
                      data: "0x12345678",
                    });
                  });

                  itSafeTransfersFromLikeExpected(this, { mock: true });

                  it("it calls onERC1155Received", async () => {
                    await expect(this.data.tx)
                      .to.emit(this.contracts.ERC1155Receiver, "Received")
                      .withArgs(this.signers.holders[0].address, this.signers.holders[0].address, this.data.id, this.params.vault.amount, "0x12345678");
                  });
                });

                describe("» but the receiver contract returns an invalid value", () => {
                  before(async () => {
                    await setup.vault(this);
                    await this.sERC20.mint();
                    await mock.deploy.ERC1155Receiver(this, {
                      singleValue: "0x12345678",
                    });
                  });

                  it("it reverts", async () => {
                    await expect(
                      this.vault.safeTransferFrom({
                        to: this.contracts.ERC1155Receiver,
                        data: "0x12345678",
                      })
                    ).to.be.revertedWith("Vault: ERC1155Receiver rejected tokens");
                  });
                });

                describe("» but the receiver contract reverts", () => {
                  before(async () => {
                    await setup.vault(this);
                    await this.sERC20.mint();
                    await mock.deploy.ERC1155Receiver(this, {
                      singleReverts: true,
                    });
                  });

                  it("it reverts", async () => {
                    await expect(
                      this.vault.safeTransferFrom({
                        to: this.contracts.ERC1155Receiver,
                        data: "0x12345678",
                      })
                    ).to.be.revertedWith("ERC1155ReceiverMock: reverting on receive");
                  });
                });
              });

              describe("» but the receiver contract does not implement onERC1155Received", () => {
                before(async () => {
                  await setup.vault(this);
                  await this.sERC20.mint();
                });

                it("it reverts", async () => {
                  await expect(
                    this.vault.safeTransferFrom({
                      to: this.contracts.sERC20,
                      data: "0x12345678",
                    })
                  ).to.be.revertedWith("Vault: transfer to non ERC1155Receiver implementer");
                });
              });
            });
          });

          describe("» and transfer is triggered by an approved operator", () => {
            describe("» and the receiver is an EOA", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint();
                await this.vault.setApprovalForAll();
                await this.vault.safeTransferFrom({
                  operator: this.signers.vault.operator,
                });
              });

              itSafeTransfersFromLikeExpected(this, { operator: true });
            });

            describe("» and the receiver is a contract", () => {
              describe("» and the receiver contract implements onERC1155Received", () => {
                describe("» and the receiver contract returns a valid value", () => {
                  before(async () => {
                    await setup.vault(this);
                    await this.sERC20.mint();
                    await mock.deploy.ERC1155Receiver(this);
                    await this.vault.setApprovalForAll();
                    await this.vault.safeTransferFrom({
                      operator: this.signers.vault.operator,
                      to: this.contracts.ERC1155Receiver,
                      data: "0x12345678",
                    });
                  });

                  itSafeTransfersFromLikeExpected(this, {
                    mock: true,
                    operator: true,
                  });

                  it("it calls onERC1155Received", async () => {
                    await expect(this.data.tx)
                      .to.emit(this.contracts.ERC1155Receiver, "Received")
                      .withArgs(this.signers.vault.operator.address, this.signers.holders[0].address, this.data.id, this.params.vault.amount, "0x12345678");
                  });
                });
              });
            });
          });

          describe("» but transfer is triggered by an unapproved operator", () => {
            before(async () => {
              await setup.vault(this);
              await this.sERC20.mint();
            });

            it("it reverts", async () => {
              await expect(
                this.vault.safeTransferFrom({
                  operator: this.signers.vault.operator,
                })
              ).to.be.revertedWith("Vault: must be owner or approved to transfer");
            });
          });
        });

        describe("» but transferred amount is superior to sender's balance", () => {
          before(async () => {
            await setup.vault(this);
            await this.sERC20.mint();
          });

          it("it reverts", async () => {
            await expect(
              this.vault.safeTransferFrom({
                amount: this.params.sERC20.balance.add(1),
              })
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
          });
        });
      });

      describe("» recipient is the zero address", () => {
        before(async () => {
          await setup.vault(this);
          await this.sERC20.mint();
        });

        it("it reverts", async () => {
          await expect(
            this.vault.safeTransferFrom({
              from: this.signers.holders[0],
              to: { address: ethers.constants.AddressZero },
            })
          ).to.be.revertedWith("Vault: transfer to the zero address");
        });
      });
    });

    describe("# safeBatchTransferFrom", () => {
      describe("» input arrays match", () => {
        describe("» and recipient is not the zero address", () => {
          describe("» and no transferred amount is inferior to sender's balance", () => {
            describe("» and transfer is triggered by sender", () => {
              describe("» and the receiver is an EOA", () => {
                before(async () => {
                  await setup.vault(this);
                  await this.sERC20.mint();
                  this.data.sERC201 = this.sERC20;
                  this.data.id1 = this.data.id;

                  await this.sERC721.mint();
                  await this.vault.fractionalize();
                  await this.sERC20.mint();

                  this.data.sERC202 = this.sERC20;
                  this.data.id2 = this.data.id;

                  await this.vault.safeBatchTransferFrom();
                });

                itSafeBatchTransfersFromLikeExpected(this);
              });

              describe("» and the receiver is a contract", () => {
                describe("» and the receiver contract implements onERC1155Received", () => {
                  describe("» and the receiver contract returns a valid value", () => {
                    before(async () => {
                      await setup.vault(this);
                      await this.sERC20.mint();
                      this.data.sERC201 = this.sERC20;
                      this.data.id1 = this.data.id;

                      await this.sERC721.mint();
                      await this.vault.fractionalize();
                      await this.sERC20.mint();

                      this.data.sERC202 = this.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this);
                      await this.vault.safeBatchTransferFrom({
                        to: this.contracts.ERC1155Receiver,
                        data: "0x12345678",
                      });
                    });

                    itSafeBatchTransfersFromLikeExpected(this, { mock: true });

                    it("it calls onERC1155Received", async () => {
                      await expect(this.data.tx)
                        .to.emit(this.contracts.ERC1155Receiver, "BatchReceived")
                        .withArgs(
                          this.signers.holders[0].address,
                          this.signers.holders[0].address,
                          [this.data.id1, this.data.id2],
                          [this.params.vault.amount1, this.params.vault.amount2],
                          "0x12345678"
                        );
                    });
                  });

                  describe("» but the receiver contract returns an invalid value", () => {
                    before(async () => {
                      await setup.vault(this);
                      await this.sERC20.mint();
                      this.data.sERC201 = this.sERC20;
                      this.data.id1 = this.data.id;

                      await this.sERC721.mint();
                      await this.vault.fractionalize();
                      await this.sERC20.mint();

                      this.data.sERC202 = this.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this, {
                        batchValue: "0x12345678",
                      });
                    });

                    it("it reverts", async () => {
                      await expect(
                        this.vault.safeBatchTransferFrom({
                          to: this.contracts.ERC1155Receiver,
                          data: "0x12345678",
                        })
                      ).to.be.revertedWith("Vault: ERC1155Receiver rejected tokens");
                    });
                  });

                  describe("» but the receiver contract reverts", () => {
                    before(async () => {
                      await setup.vault(this);
                      await this.sERC20.mint();
                      this.data.sERC201 = this.sERC20;
                      this.data.id1 = this.data.id;

                      await this.sERC721.mint();
                      await this.vault.fractionalize();
                      await this.sERC20.mint();

                      this.data.sERC202 = this.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this, {
                        batchReverts: true,
                      });
                    });

                    it("it reverts", async () => {
                      await expect(
                        this.vault.safeBatchTransferFrom({
                          to: this.contracts.ERC1155Receiver,
                          data: "0x12345678",
                        })
                      ).to.be.revertedWith("ERC1155ReceiverMock: reverting on batch receive");
                    });
                  });
                });

                describe("» but the receiver does not implement onERC1155Received", () => {
                  before(async () => {
                    await setup.vault(this);
                    await this.sERC20.mint();
                    this.data.sERC201 = this.sERC20;
                    this.data.id1 = this.data.id;

                    await this.sERC721.mint();
                    await this.vault.fractionalize();
                    await this.sERC20.mint();

                    this.data.sERC202 = this.sERC20;
                    this.data.id2 = this.data.id;
                  });

                  it("it reverts", async () => {
                    await expect(
                      this.vault.safeBatchTransferFrom({
                        to: this.contracts.sERC20,
                        data: "0x12345678",
                      })
                    ).to.be.revertedWith("Vault: transfer to non ERC1155Receiver implementer");
                  });
                });
              });
            });

            describe("» and transfer is triggered by an approved operator", () => {
              describe("» and the receiver is an EOA", () => {
                before(async () => {
                  await setup.vault(this);
                  await this.sERC20.mint();
                  this.data.sERC201 = this.sERC20;
                  this.data.id1 = this.data.id;

                  await this.sERC721.mint();
                  await this.vault.fractionalize();
                  await this.sERC20.mint();

                  this.data.sERC202 = this.sERC20;
                  this.data.id2 = this.data.id;

                  await this.vault.setApprovalForAll();
                  await this.vault.safeBatchTransferFrom({
                    operator: this.signers.vault.operator,
                  });
                });

                itSafeBatchTransfersFromLikeExpected(this, { operator: true });
              });

              describe("» and the receiver is a contract", () => {
                describe("» and the receiver contract implements onERC1155Received", () => {
                  describe("» and the receiver contract returns a valid value", () => {
                    before(async () => {
                      await setup.vault(this);
                      await this.sERC20.mint();
                      this.data.sERC201 = this.sERC20;
                      this.data.id1 = this.data.id;

                      await this.sERC721.mint();
                      await this.vault.fractionalize();
                      await this.sERC20.mint();

                      this.data.sERC202 = this.sERC20;
                      this.data.id2 = this.data.id;

                      await this.vault.setApprovalForAll();
                      await mock.deploy.ERC1155Receiver(this);
                      await this.vault.safeBatchTransferFrom({
                        operator: this.signers.vault.operator,
                        to: this.contracts.ERC1155Receiver,
                        data: "0x12345678",
                      });
                    });

                    itSafeBatchTransfersFromLikeExpected(this, {
                      mock: true,
                      operator: true,
                    });

                    it("it calls onERC1155Received", async () => {
                      await expect(this.data.tx)
                        .to.emit(this.contracts.ERC1155Receiver, "BatchReceived")
                        .withArgs(
                          this.signers.vault.operator.address,
                          this.signers.holders[0].address,
                          [this.data.id1, this.data.id2],
                          [this.params.vault.amount1, this.params.vault.amount2],
                          "0x12345678"
                        );
                    });
                  });
                });
              });
            });

            describe("» but transfer is triggered by an unapproved operator", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint();
                this.data.sERC201 = this.sERC20;
                this.data.id1 = this.data.id;

                await this.sERC721.mint();
                await this.vault.fractionalize();
                await this.sERC20.mint();

                this.data.sERC202 = this.sERC20;
                this.data.id2 = this.data.id;
              });

              it("it reverts", async () => {
                await expect(
                  this.vault.safeBatchTransferFrom({
                    operator: this.signers.vault.operator,
                  })
                ).to.be.revertedWith("Vault: must be owner or approved to transfer");
              });
            });
          });

          describe("» but one transferred amount is superior to sender's balance", () => {
            before(async () => {
              await setup.vault(this);
              await this.sERC20.mint();
              this.data.sERC201 = this.sERC20;
              this.data.id1 = this.data.id;

              await this.sERC721.mint();
              await this.vault.fractionalize();
              await this.sERC20.mint();

              this.data.sERC202 = this.sERC20;
              this.data.id2 = this.data.id;
            });

            it("it reverts", async () => {
              await expect(
                this.vault.safeBatchTransferFrom({
                  amounts: [this.params.sERC20.balance.add(1), this.params.vault.amount2],
                })
              ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });
          });
        });

        describe("» but recipient is the zero address", () => {
          before(async () => {
            await setup.vault(this);
            await this.sERC20.mint();
            this.data.sERC201 = this.sERC20;
            this.data.id1 = this.data.id;

            await this.sERC721.mint();
            await this.vault.fractionalize();
            await this.sERC20.mint();

            this.data.sERC202 = this.sERC20;
            this.data.id2 = this.data.id;
          });

          it("it reverts", async () => {
            await expect(
              this.vault.safeBatchTransferFrom({
                to: { address: ethers.constants.AddressZero },
              })
            ).to.be.revertedWith("Vault: transfer to the zero address");
          });
        });
      });

      describe("» input arrays do not match", () => {
        before(async () => {
          await setup.vault(this);
          await this.sERC20.mint();
          this.data.sERC201 = this.sERC20;
          this.data.id1 = this.data.id;

          await this.sERC721.mint();
          await this.vault.fractionalize();
          await this.sERC20.mint();

          this.data.sERC202 = this.sERC20;
          this.data.id2 = this.data.id;
        });

        it("it reverts", async () => {
          await expect(
            this.vault.safeBatchTransferFrom({
              amounts: [this.params.vault.amount1],
            })
          ).to.be.revertedWith("Vault: ids and amounts length mismatch");
        });
      });
    });
  });

  describe("⇛ IERC1155MetadataURI", () => {
    describe("# uri", () => {
      describe("» token type exists", () => {
        describe("» and its associated ERC721 is still locked", () => {
          describe("» and its associated ERC721 implements IERC721Metadata", () => {
            before(async () => {
              await setup.vault(this);
            });

            it("it returns its associated ERC721 URI", async () => {
              expect(await this.vault.uri(this.data.id)).to.equal(this.params.sERC721.tokenURI);
            });
          });

          describe("» but its associated ERC721 does not implement IERC721Metadata", () => {
            before(async () => {
              await setup.vault(this, { fractionalize: false });
              await mock.deploy.ERC721(this);
              await this.vault.fractionalize({ mock: true });
            });

            it("it returns the default unavailable URI", async () => {
              expect(await this.vault.uri(this.data.id)).to.equal(this.params.vault.unavailableURI);
            });
          });
        });

        describe("» but its associated ERC721 is not locked anymore", () => {
          before(async () => {
            await setup.vault(this);
            await this.vault.unlock();
          });

          it("it returns the default unwrapped URI", async () => {
            expect(await this.vault.uri(this.data.id)).to.equal(this.params.vault.unlockedURI);
          });
        });
      });

      describe("» token type does not exist", () => {
        before(async () => {
          await setup.vault(this, { fractionalize: false });
        });

        it("it returns a blank string", async () => {
          expect(await this.vault.uri(this.data.id)).to.equal("");
        });
      });
    });
  });

  describe("⇛ IERC721Receiver", () => {
    describe("# onERC721Received", () => {
      describe("» is called by a standard-compliant ERC721", () => {
        describe("» and fractionalization data have a valid length", () => {
          describe("» and fractionalization data ends up with Derrida magic value", () => {
            before(async () => {
              await setup.vault(this, { fractionalize: false });
              await this.vault.fractionalize({ transfer: true });
            });

            itFractionalizesLikeExpected(this, { transfer: true });
          });

          describe("» but fractionalization data does not end up with Derrida magic value", () => {
            before(async () => {
              await setup.vault(this, { approve: false, fractionalize: false });
            });

            it("it reverts", async () => {
              await expect(
                this.vault.fractionalize({
                  transfer: true,
                  derrida: ethers.constants.HashZero,
                })
              ).to.be.revertedWith("Vault: invalid fractionalization data");
            });
          });
        });

        describe("» but fractionalization data does not have a valid length", () => {
          before(async () => {
            await setup.vault(this, { approve: false, fractionalize: false });
          });

          it("it reverts", async () => {
            await expect(this.vault.fractionalize({ transfer: true, short: true })).to.be.revertedWith("Vault: invalid fractionalization data length");
          });
        });
      });

      describe("» is called by a non-compliant ERC721", () => {
        before(async () => {
          await setup.vault(this, { approve: false, fractionalize: false });
          await mock.deploy.ERC721Sender(this);
        });

        it("it reverts", async () => {
          await expect(
            this.contracts.ERC721SenderMock.onERC721Received(
              this.vault.address,
              ethers.utils.concat([
                ethers.utils.formatBytes32String(this.params.sERC20.name),
                ethers.utils.formatBytes32String(this.params.sERC20.symbol),
                ethers.utils.defaultAbiCoder.encode(["uint256"], [this.params.sERC20.cap]),
                ethers.utils.defaultAbiCoder.encode(["address"], [this.signers.sERC20.admin.address]),
                ethers.utils.defaultAbiCoder.encode(["address"], [this.signers.vault.broker.address]),
                ethers.utils.defaultAbiCoder.encode(["bytes32"], [this.constants.vault.DERRIDA]),
              ])
            )
          ).to.be.revertedWith("Vault: NFT is not ERC721-compliant");
        });
      });
    });
  });

  describe("⇛ IVault", () => {
    describe("# fractionalize", () => {
      describe("» NFT has never been fractionalized", () => {
        describe("» and NFT is ERC721-compliant", () => {
          describe("» and the vault has been approved to transfer NFT", () => {
            describe("» and NFT is not owned by the vault", () => {
              before(async () => {
                await setup.vault(this);
              });

              itFractionalizesLikeExpected(this);
            });

            describe("» but NFT is owned by the vault", () => {
              before(async () => {
                await setup.vault(this, { fractionalize: false });
                await this.sERC721.transfer();
              });

              it("it reverts", async () => {
                await expect(this.vault.fractionalize()).to.be.revertedWith("Vault: NFT is already owned by this vault");
              });
            });
          });

          describe("» but the vault has not been approved to transfer NFT", () => {
            before(async () => {
              await setup.vault(this, { approve: false, fractionalize: false });
            });

            it("it reverts", async () => {
              await expect(this.vault.fractionalize()).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
            });
          });
        });

        describe("» but NFT is not ERC721-compliant", () => {
          before(async () => {
            await setup.vault(this);
          });

          it("it reverts", async () => {
            await expect(this.vault.fractionalize({ collection: this.sERC20.contract })).to.be.revertedWith("Vault: NFT is not ERC721-compliant");
          });
        });
      });

      describe("» NFT has already been fractionalized", () => {
        describe("» and NFT has been unlocked since", () => {
          before(async () => {
            await setup.vault(this);
            await this.vault.unlock();
            await this.sERC721.approve({
              from: this.signers.sERC721.owners[1],
            });
            await this.vault.fractionalize();
          });

          itFractionalizesLikeExpected(this);
        });

        describe("» but NFT still is locked", () => {
          before(async () => {
            await setup.vault(this);
          });

          it("it reverts", async () => {
            await expect(this.vault.fractionalize()).to.be.revertedWith("Vault: NFT is already locked");
          });
        });
      });
    });

    describe("# unlock [by id]", () => {
      describe("» spectre exists", () => {
        describe("» and spectre is locked", () => {
          describe("» and caller is spectre's broker", () => {
            before(async () => {
              await setup.vault(this);
              await this.vault.unlock();
            });

            itUnlocksLikeExpected(this);
          });

          describe("» but caller is not spectre's broker", () => {
            before(async () => {
              await setup.vault(this);
            });

            it("it reverts", async () => {
              await expect(this.vault.unlock({ from: this.signers.others[0] })).to.be.revertedWith("Vault: must be spectre's broker to unlock");
            });
          });
        });

        describe("» but spectre is not locked anymore", () => {
          before(async () => {
            await setup.vault(this);
            await this.vault.unlock();
          });

          it("it reverts", async () => {
            await expect(this.vault.unlock()).to.be.revertedWith("Vault: spectre is not locked");
          });
        });
      });

      describe("» spectre does not exists", () => {
        before(async () => {
          await setup.vault(this, { fractionalize: false });
        });

        it("it reverts", async () => {
          await expect(this.vault.unlock()).to.be.revertedWith("Vault: spectre is not locked");
        });
      });
    });

    describe("# unlock [by address]", () => {
      describe("» spectre exists", () => {
        describe("» and spectre is locked", () => {
          describe("» and caller is spectre's broker", () => {
            before(async () => {
              await setup.vault(this);
              await this.vault.unlock({ byAddress: true });
            });

            itUnlocksLikeExpected(this);
          });

          describe("» but caller is not spectre's broker", () => {
            before(async () => {
              await setup.vault(this);
            });

            it("it reverts", async () => {
              await expect(
                this.vault.unlock({
                  byAddress: true,
                  from: this.signers.others[0],
                })
              ).to.be.revertedWith("Vault: must be spectre's broker to unlock");
            });
          });
        });

        describe("» but spectre is not locked anymore", () => {
          before(async () => {
            await setup.vault(this);
            await this.vault.unlock(this);
          });

          it("it reverts", async () => {
            await expect(this.vault.unlock({ byAddress: true })).to.be.revertedWith("Vault: spectre is not locked");
          });
        });
      });

      describe("» spectre does not exists", () => {
        before(async () => {
          await setup.vault(this, { fractionalize: false });
        });

        it("it reverts", async () => {
          await expect(this.vault.unlock({ byAddress: true })).to.be.revertedWith("Vault: spectre is not locked");
        });
      });
    });

    describe("# escape", () => {
      describe("» caller has DEFAULT_ADMIN_ROLE", () => {
        describe("» and NFT is not locked", () => {
          describe("» and NFT is owned by the vault", () => {
            before(async () => {
              await setup.vault(this, { fractionalize: false });
              await this.sERC721.transfer();
              await this.vault.escape();
            });

            it("it transfers NFT", async () => {
              expect(await this.sERC721.ownerOf(this.data.tokenId)).to.equal(this.signers.others[0].address);
            });

            it("it emits an Escape event", async () => {
              await expect(this.data.tx)
                .to.emit(this.vault.contract, "Escape")
                .withArgs(this.sERC721.address, this.data.tokenId, this.signers.others[0].address);
            });
          });

          describe("» but NFT is not owned by the vault", () => {
            before(async () => {
              await setup.vault(this, { fractionalize: false });
            });

            it("it reverts", async () => {
              await expect(this.vault.escape()).to.be.revertedWith("Vault: NFT is not owned by this vault");
            });
          });
        });

        describe("» but NFT is locked", () => {
          before(async () => {
            await setup.vault(this);
          });

          it("it reverts", async () => {
            await expect(this.vault.escape()).to.be.revertedWith("Vault: NFT is locked");
          });
        });
      });

      describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
        before(async () => {
          await setup.vault(this, { fractionalize: false });
          await this.sERC721.transfer();
        });

        it("it reverts", async () => {
          await expect(this.vault.escape({ from: this.signers.others[0] })).to.be.revertedWith("Vault: must have DEFAULT_ADMIN_ROLE to escape NFTs");
        });
      });
    });

    describe("# setUnavailableURI", () => {
      describe("» caller has DEFAULT_ADMIN_ROLE", () => {
        before(async () => {
          await setup.vault(this);
          await this.vault.setUnavailableURI("ipfs://testunavailableURI");
        });

        it("it updates unavailableURI", async () => {
          expect(await this.vault.unavailableURI()).to.equal("ipfs://testunavailableURI");
        });
      });

      describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(
            this.vault.setUnavailableURI("ipfs://testunavailableURI", {
              from: this.signers.others[0],
            })
          ).to.be.revertedWith("Vault: must have DEFAULT_ADMIN_ROLE to set unavailableURI");
        });
      });
    });

    describe("# setUnlockedURI", () => {
      describe("» caller has DEFAULT_ADMIN_ROLE", () => {
        before(async () => {
          await setup.vault(this);
          await this.vault.setUnlockedURI("ipfs://testunlockedURI");
        });

        it("it updates unlockedURI", async () => {
          expect(await this.vault.unlockedURI()).to.equal("ipfs://testunlockedURI");
        });
      });

      describe("» caller does not have DEFAULT_ADMIN_ROLE", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(
            this.vault.setUnlockedURI("ipfs://testunlockedURI", {
              from: this.signers.others[0],
            })
          ).to.be.revertedWith("Vault: must have DEFAULT_ADMIN_ROLE to set unlockedURI");
        });
      });
    });

    describe("# onERC20Transferred", () => {
      describe("» caller is a registered sERC20", () => {
        describe("» and sERC20s are transferred", () => {
          describe("» and the receiver is an EOA", () => {
            before(async () => {
              await setup.vault(this);
              await this.sERC20.mint({ to: this.signers.holders[0] });
              await this.sERC20.transfer({ to: this.signers.holders[1] });
            });

            it("it emits a TransferSingle event", async () => {
              await expect(this.data.tx)
                .to.emit(this.vault.contract, "TransferSingle")
                .withArgs(this.sERC20.address, this.signers.holders[0].address, this.signers.holders[1].address, this.data.id, this.params.sERC20.amount);
            });
          });

          describe("» and the receiver is a contract", () => {
            describe("» and the receiver contract implements onERC1155Received", () => {
              describe("» and the receiver contract returns a valid value", () => {
                before(async () => {
                  await setup.vault(this);
                  await this.sERC20.mint({ to: this.signers.holders[0] });
                  await mock.deploy.ERC1155Receiver(this);
                  await this.sERC20.transfer({
                    to: this.contracts.ERC1155Receiver,
                  });
                });

                it("it emits a TransferSingle event", async () => {
                  await expect(this.data.tx)
                    .to.emit(this.vault.contract, "TransferSingle")
                    .withArgs(
                      this.sERC20.address,
                      this.signers.holders[0].address,
                      this.contracts.ERC1155Receiver.address,
                      this.data.id,
                      this.params.vault.amount
                    );
                });

                it("it calls onERC1155Received", async () => {
                  await expect(this.data.tx)
                    .to.emit(this.contracts.ERC1155Receiver, "Received")
                    .withArgs(this.sERC20.address, this.signers.holders[0].address, this.data.id, this.params.vault.amount, "0x");
                });
              });
            });

            describe("» but the receiver contract returns an invalid value", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint({ to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this, {
                  singleValue: "0x12345678",
                });
              });

              it("it reverts", async () => {
                await expect(this.sERC20.transfer({ to: this.contracts.ERC1155Receiver })).to.be.revertedWith("Vault: ERC1155Receiver rejected tokens");
              });
            });

            describe("» but the receiver contract reverts", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint({ to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this, {
                  singleReverts: true,
                });
              });

              it("it reverts", async () => {
                await expect(this.sERC20.transfer({ to: this.contracts.ERC1155Receiver })).to.be.revertedWith("ERC1155ReceiverMock: reverting on receive");
              });
            });

            describe("» but the receiver contract does not implement onERC1155Received", () => {
              before(async () => {
                await setup.vault(this);
                await this.sERC20.mint({ to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this);
                await this.sERC20.transfer({ to: this.contracts.sERC20 });
              });

              it("it emits a TransferSingle event", async () => {
                await expect(this.data.tx)
                  .to.emit(this.vault.contract, "TransferSingle")
                  .withArgs(this.sERC20.address, this.signers.holders[0].address, this.sERC20.address, this.data.id, this.params.vault.amount);
              });
            });
          });
        });

        describe("» and sERC20s are minted", () => {
          before(async () => {
            await setup.vault(this);
            await this.sERC20.mint({ to: this.signers.holders[0] });
          });

          it("it emits a TransferSingle event", async () => {
            await expect(this.data.tx)
              .to.emit(this.vault.contract, "TransferSingle")
              .withArgs(this.sERC20.address, ethers.constants.AddressZero, this.signers.holders[0].address, this.data.id, this.params.sERC20.balance);
          });
        });
      });

      describe("» caller is a not a registered sERC20", () => {
        before(async () => {
          await setup.vault(this);
        });

        it("it reverts", async () => {
          await expect(
            this.vault.contract.connect(this.signers.others[0]).onERC20Transferred(ethers.constants.AddressZero, ethers.constants.AddressZero, 0)
          ).to.be.revertedWith("Vault: must be sERC20 to use transfer hook");
        });
      });
    });

    describe("# spectreOf", () => {
      before(async () => {
        await setup.vault(this);
        this.data.spectre = await this.vault.contract["spectreOf(address)"](this.sERC20.address);
      });

      it("it returns the queried spectre", async () => {
        expect(this.data.spectre.state).to.equal(this.constants.vault.spectres.state.Locked);
        expect(this.data.spectre.collection).to.equal(this.sERC721.address);
        expect(this.data.spectre.tokenId).to.equal(this.data.tokenId);
        expect(this.data.spectre.broker).to.equal(this.signers.vault.broker.address);
      });
    });
  });
});
