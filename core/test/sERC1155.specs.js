const { expect } = require('chai');
const { ethers } = require('ethers');
const { deployContract } = require('ethereum-waffle');
const {
  initialize,
  mint,
  mock,
  safeBatchTransferFrom,
  safeTransferFrom,
  setApprovalForAll,
  setup,
  spectralize,
  unlock,
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  itUnlocksLikeExpected,
  transfer,
} = require('@spectrexyz/protocol-helpers');

describe('sERC1155', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    describe('» sERC20 base address is not the zero address', () => {
      before(async () => {
        await setup(this);
      });

      it('# it initializes sERC1155', async () => {
        expect(await this.contracts.sERC1155.sERC20Base()).to.equal(this.contracts.sERC20Base.address);
        expect(await this.contracts.sERC1155.unavailableURI()).to.equal(this.constants.unavailableURI);
        expect(await this.contracts.sERC1155.unlockedURI()).to.equal(this.constants.unlockedURI);
      });

      it('# it sets up admin permissions', async () => {
        expect(await this.contracts.sERC1155.hasRole(await this.contracts.sERC1155.ADMIN_ROLE(), this.signers.root.address)).to.equal(true);
        expect(await this.contracts.sERC1155.getRoleAdmin(await this.contracts.sERC1155.ADMIN_ROLE())).to.equal(await this.contracts.sERC1155.ADMIN_ROLE());
      });
    });

    describe('» sERC20 base address is the zero address', () => {
      it('it reverts', async () => {
        await expect(deployContract(this.signers.root, this.artifacts.SERC1155, [ethers.constants.AddressZero, this.constants.unlockedURI])).to.be.revertedWith(
          'sERC1155: sERC20 base cannot be the zero address'
        );
      });
    });
  });

  describe('⇛ ERC165', () => {
    before(async () => {
      await setup(this);
    });

    it('it supports ERC165 interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x01ffc9a7)).to.equal(true);
    });

    it('it supports AccessControlEnumerable interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x5a05180f)).to.equal(true);
    });

    it('it supports ERC1155 interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0xd9b67a26)).to.equal(true);
    });

    it('it supports ERC1155MetadataURI interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x0e89341c)).to.equal(true);
    });

    it('it supports ERC721TokenReceiver interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x150b7a02)).to.equal(true);
    });

    it('it does not support ERC1155TokenReceiver interface', async () => {
      expect(await this.contracts.sERC1155.supportsInterface(0x4e2312e0)).to.equal(false);
    });
  });

  describe('⇛ ERC1155', () => {
    describe('# balanceOf', () => {
      describe('» the queried address is not the zero address', () => {
        describe('» and the queried token type exists', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this, { to: this.signers.holders[0], amount: '1000' });
            await mint.sERC20(this, { to: this.signers.holders[1], amount: '1500' });
          });

          it('it returns the amount of tokens owned by the queried address', async () => {
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[0].address, this.data.id)).to.equal(1000);
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[1].address, this.data.id)).to.equal(1500);
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[2].address, this.data.id)).to.equal(0);
          });
        });

        describe('# but the queried token type does not exist', () => {
          before(async () => {
            await setup(this);
          });

          it('it returns zero', async () => {
            expect(await this.contracts.sERC1155.balanceOf(this.signers.holders[0].address, '123456789')).to.equal(0);
          });
        });
      });

      describe('» the queried address is the zero address', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
        });

        it('it reverts', async () => {
          await expect(this.contracts.sERC1155.balanceOf(ethers.constants.AddressZero, this.data.id)).to.be.revertedWith(
            'sERC1155: balance query for the zero address'
          );
        });
      });
    });

    describe('# balanceOfBatch', () => {
      describe('» input arrays match', () => {
        describe('» and no queried address is the zero address', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            this.data.id1 = this.data.id;
            await mint.sERC20(this, { to: this.signers.holders[0], amount: '1000' });
            await mint.sERC20(this, { to: this.signers.holders[1], amount: '1500' });

            await mint.sERC721(this);
            await spectralize(this);
            this.data.id2 = this.data.id;
            await mint.sERC20(this, { to: this.signers.holders[0], amount: '700' });
            await mint.sERC20(this, { to: this.signers.holders[2], amount: '2000' });
          });

          it('it returns the amount of tokens owned by the queried addresses', async () => {
            const balances = await this.contracts.sERC1155.balanceOfBatch(
              [this.signers.holders[0].address, this.signers.holders[1].address, this.signers.holders[2].address],
              [this.data.id1, this.data.id2, '123456789']
            );

            expect(balances[0]).to.equal(1000);
            expect(balances[1]).to.equal(0);
            expect(balances[2]).to.equal(0);
          });
        });

        describe('» but one of the queried address is the zero address', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
          });

          it('it reverts', async () => {
            await expect(
              this.contracts.sERC1155.balanceOfBatch([this.signers.holders[0].address, ethers.constants.AddressZero], [this.data.id, this.data.id])
            ).to.be.revertedWith('sERC1155: balance query for the zero address');
          });
        });
      });

      describe('» input arrays do not match', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
        });

        it('it reverts', async () => {
          await expect(
            this.contracts.sERC1155.balanceOfBatch(
              [this.signers.holders[0].address, this.signers.holders[1].address],
              [this.data.id, this.data.id, this.data.id]
            )
          ).to.be.revertedWith('sERC1155: accounts and ids length mismatch');
        });
      });
    });

    describe('# setApprovalForAll', () => {
      describe('» operator is not setting approval status for self', () => {
        before(async () => {
          await setup(this);
          await setApprovalForAll(this);
        });

        it('it registers approval status', async () => {
          expect(await this.contracts.sERC1155.isApprovedForAll(this.signers.holders[0].address, this.signers.operator.address)).to.equal(true);
        });

        it('it emits an ApprovalForAll event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.sERC1155, 'ApprovalForAll')
            .withArgs(this.signers.holders[0].address, this.signers.operator.address, true);
        });
      });

      describe('» operator is setting approval status for self', () => {
        before(async () => {
          await setup(this);
        });

        it('it reverts', async () => {
          await expect(setApprovalForAll(this, { from: this.signers.operator, operator: this.signers.operator })).to.be.revertedWith(
            'sERC1155: setting approval status for self'
          );
        });
      });
    });

    describe('# safeTransferFrom', () => {
      describe('» recipient is not the zero address', () => {
        describe("» and transferred amount is inferior to sender's balance", () => {
          describe('» and transfer is triggered by sender', () => {
            describe('» and the receiver is an EOA', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this);
                await safeTransferFrom(this);
              });

              itSafeTransfersFromLikeExpected(this);
            });

            describe('» and the receiver is a contract', () => {
              describe('» and the receiver contract implements onERC1155Received', () => {
                describe('» and the receiver contract returns a valid value', () => {
                  before(async () => {
                    await setup(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    await mock.deploy.ERC1155Receiver(this);
                    await safeTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' });
                  });

                  itSafeTransfersFromLikeExpected(this, { mock: true });

                  it('it calls onERC1155Received', async () => {
                    await expect(this.data.tx)
                      .to.emit(this.contracts.ERC1155Receiver, 'Received')
                      .withArgs(this.signers.holders[0].address, this.signers.holders[0].address, this.data.id, this.constants.amount, '0x12345678');
                  });
                });

                describe('» but the receiver contract returns an invalid value', () => {
                  before(async () => {
                    await setup(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    await mock.deploy.ERC1155Receiver(this, { singleValue: '0x12345678' });
                  });

                  it('it reverts', async () => {
                    await expect(safeTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' })).to.be.revertedWith(
                      'sERC1155: ERC1155Receiver rejected tokens'
                    );
                  });
                });

                describe('» but the receiver contract reverts', () => {
                  before(async () => {
                    await setup(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    await mock.deploy.ERC1155Receiver(this, { singleReverts: true });
                  });

                  it('it reverts', async () => {
                    await expect(safeTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' })).to.be.revertedWith(
                      'ERC1155ReceiverMock: reverting on receive'
                    );
                  });
                });
              });

              describe('» but the receiver contract does not implement onERC1155Received', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                  await mint.sERC20(this);
                });

                it('it reverts', async () => {
                  await expect(safeTransferFrom(this, { to: this.contracts.sERC20, data: '0x12345678' })).to.be.revertedWith(
                    'sERC1155: transfer to non ERC1155Receiver implementer'
                  );
                });
              });
            });
          });

          describe('» and transfer is triggered by an approved operator', () => {
            describe('» and the receiver is an EOA', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this);
                await setApprovalForAll(this);
                await safeTransferFrom(this, { operator: this.signers.operator });
              });

              itSafeTransfersFromLikeExpected(this, { operator: true });
            });

            describe('» and the receiver is a contract', () => {
              describe('» and the receiver contract implements onERC1155Received', () => {
                describe('» and the receiver contract returns a valid value', () => {
                  before(async () => {
                    await setup(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    await mock.deploy.ERC1155Receiver(this);
                    await setApprovalForAll(this);
                    await safeTransferFrom(this, { operator: this.signers.operator, to: this.contracts.ERC1155Receiver, data: '0x12345678' });
                  });

                  itSafeTransfersFromLikeExpected(this, { mock: true, operator: true });

                  it('it calls onERC1155Received', async () => {
                    await expect(this.data.tx)
                      .to.emit(this.contracts.ERC1155Receiver, 'Received')
                      .withArgs(this.signers.operator.address, this.signers.holders[0].address, this.data.id, this.constants.amount, '0x12345678');
                  });
                });
              });
            });
          });

          describe('» but transfer is triggered by an unapproved operator', () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
              await mint.sERC20(this);
            });

            it('it reverts', async () => {
              await expect(safeTransferFrom(this, { operator: this.signers.operator })).to.be.revertedWith('sERC1155: must be owner or approved to transfer');
            });
          });
        });

        describe("» but transferred amount is superior to sender's balance", () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this);
          });

          it('it reverts', async () => {
            await expect(safeTransferFrom(this, { amount: this.constants.balance.add(1) })).to.be.revertedWith('ERC20: transfer amount exceeds balance');
          });
        });
      });

      describe('» recipient is the zero address', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await mint.sERC20(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.holders[0]);
        });

        it('it reverts', async () => {
          await expect(safeTransferFrom(this, { to: { address: ethers.constants.AddressZero } })).to.be.revertedWith('sERC1155: transfer to the zero address');
        });
      });
    });

    describe('# safeBatchTransferFrom', () => {
      describe('» input arrays match', () => {
        describe('» and recipient is not the zero address', () => {
          describe("» and no transferred amount is inferior to sender's balance", () => {
            describe('» and transfer is triggered by sender', () => {
              describe('» and the receiver is an EOA', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                  await mint.sERC20(this);
                  this.data.sERC201 = this.contracts.sERC20;
                  this.data.id1 = this.data.id;

                  await mint.sERC721(this);
                  await spectralize(this);
                  await mint.sERC20(this);
                  this.data.sERC202 = this.contracts.sERC20;
                  this.data.id2 = this.data.id;

                  await safeBatchTransferFrom(this);
                });

                itSafeBatchTransfersFromLikeExpected(this);
              });

              describe('» and the receiver is a contract', () => {
                describe('» and the receiver contract implements onERC1155Received', () => {
                  describe('» and the receiver contract returns a valid value', () => {
                    before(async () => {
                      await setup(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC201 = this.contracts.sERC20;
                      this.data.id1 = this.data.id;

                      await mint.sERC721(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC202 = this.contracts.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this);

                      await safeBatchTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' });
                    });

                    itSafeBatchTransfersFromLikeExpected(this, { mock: true });

                    it('it calls onERC1155Received', async () => {
                      await expect(this.data.tx)
                        .to.emit(this.contracts.ERC1155Receiver, 'BatchReceived')
                        .withArgs(
                          this.signers.holders[0].address,
                          this.signers.holders[0].address,
                          [this.data.id1, this.data.id2],
                          [this.constants.amount1, this.constants.amount2],
                          '0x12345678'
                        );
                    });
                  });

                  describe('» but the receiver contract returns an invalid value', () => {
                    before(async () => {
                      await setup(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC201 = this.contracts.sERC20;
                      this.data.id1 = this.data.id;

                      await mint.sERC721(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC202 = this.contracts.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this, { batchValue: '0x12345678' });
                    });

                    it('it reverts', async () => {
                      await expect(safeBatchTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' })).to.be.revertedWith(
                        'sERC1155: ERC1155Receiver rejected tokens'
                      );
                    });
                  });

                  describe('» but the receiver contract reverts', () => {
                    before(async () => {
                      await setup(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC201 = this.contracts.sERC20;
                      this.data.id1 = this.data.id;

                      await mint.sERC721(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC202 = this.contracts.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this, { batchReverts: true });
                    });

                    it('it reverts', async () => {
                      await expect(safeBatchTransferFrom(this, { to: this.contracts.ERC1155Receiver, data: '0x12345678' })).to.be.revertedWith(
                        'ERC1155ReceiverMock: reverting on batch receive'
                      );
                    });
                  });
                });

                describe('» but the receiver does not implement onERC1155Received', () => {
                  before(async () => {
                    await setup(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    this.data.sERC201 = this.contracts.sERC20;
                    this.data.id1 = this.data.id;

                    await mint.sERC721(this);
                    await spectralize(this);
                    await mint.sERC20(this);
                    this.data.sERC202 = this.contracts.sERC20;
                    this.data.id2 = this.data.id;
                  });

                  it('it reverts', async () => {
                    await expect(safeBatchTransferFrom(this, { to: this.contracts.sERC20, data: '0x12345678' })).to.be.revertedWith(
                      'sERC1155: transfer to non ERC1155Receiver implementer'
                    );
                  });
                });
              });
            });

            describe('» and transfer is triggered by an approved operator', () => {
              describe('» and the receiver is an EOA', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                  await mint.sERC20(this);
                  this.data.sERC201 = this.contracts.sERC20;
                  this.data.id1 = this.data.id;

                  await mint.sERC721(this);
                  await spectralize(this);
                  await mint.sERC20(this);
                  this.data.sERC202 = this.contracts.sERC20;
                  this.data.id2 = this.data.id;

                  await setApprovalForAll(this);

                  await safeBatchTransferFrom(this, { operator: this.signers.operator });
                });

                itSafeBatchTransfersFromLikeExpected(this, { operator: true });
              });

              describe('» and the receiver is a contract', () => {
                describe('» and the receiver contract implements onERC1155Received', () => {
                  describe('» and the receiver contract returns a valid value', () => {
                    before(async () => {
                      await setup(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC201 = this.contracts.sERC20;
                      this.data.id1 = this.data.id;

                      await mint.sERC721(this);
                      await spectralize(this);
                      await mint.sERC20(this);
                      this.data.sERC202 = this.contracts.sERC20;
                      this.data.id2 = this.data.id;

                      await mock.deploy.ERC1155Receiver(this);

                      await setApprovalForAll(this);
                      await safeBatchTransferFrom(this, { operator: this.signers.operator, to: this.contracts.ERC1155Receiver, data: '0x12345678' });
                    });

                    itSafeBatchTransfersFromLikeExpected(this, { mock: true, operator: true });

                    it('it calls onERC1155Received', async () => {
                      await expect(this.data.tx)
                        .to.emit(this.contracts.ERC1155Receiver, 'BatchReceived')
                        .withArgs(
                          this.signers.operator.address,
                          this.signers.holders[0].address,
                          [this.data.id1, this.data.id2],
                          [this.constants.amount1, this.constants.amount2],
                          '0x12345678'
                        );
                    });
                  });
                });
              });
            });

            describe('» but transfer is triggered by an unapproved operator', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this);
                this.data.sERC201 = this.contracts.sERC20;
                this.data.id1 = this.data.id;

                await mint.sERC721(this);
                await spectralize(this);
                await mint.sERC20(this);
                this.data.sERC202 = this.contracts.sERC20;
                this.data.id2 = this.data.id;
              });

              it('it reverts', async () => {
                await expect(safeBatchTransferFrom(this, { operator: this.signers.operator })).to.be.revertedWith(
                  'sERC1155: must be owner or approved to transfer'
                );
              });
            });
          });

          describe("» but one transferred amount is superior to sender's balance", () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
              await mint.sERC20(this);
              this.data.sERC201 = this.contracts.sERC20;
              this.data.id1 = this.data.id;

              await mint.sERC721(this);
              await spectralize(this);
              await mint.sERC20(this);
              this.data.sERC202 = this.contracts.sERC20;
              this.data.id2 = this.data.id;
            });

            it('it reverts', async () => {
              await expect(safeBatchTransferFrom(this, { amounts: [this.constants.balance.add(1), this.constants.amount2] })).to.be.revertedWith(
                'ERC20: transfer amount exceeds balance'
              );
            });
          });
        });

        describe('» but recipient is the zero address', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this);
            this.data.sERC201 = this.contracts.sERC20;
            this.data.id1 = this.data.id;

            await mint.sERC721(this);
            await spectralize(this);
            await mint.sERC20(this);
            this.data.sERC202 = this.contracts.sERC20;
            this.data.id2 = this.data.id;
          });

          it('it reverts', async () => {
            await expect(safeBatchTransferFrom(this, { to: { address: ethers.constants.AddressZero } })).to.be.revertedWith(
              'sERC1155: transfer to the zero address'
            );
          });
        });
      });

      describe('» input arrays do not match', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await mint.sERC20(this);
          this.data.sERC201 = this.contracts.sERC20;
          this.data.id1 = this.data.id;

          await mint.sERC721(this);
          await spectralize(this);
          await mint.sERC20(this);
          this.data.sERC202 = this.contracts.sERC20;
          this.data.id2 = this.data.id;
        });

        it('it reverts', async () => {
          await expect(safeBatchTransferFrom(this, { amounts: [this.constants.amount1] })).to.be.revertedWith('sERC1155: ids and amounts length mismatch');
        });
      });
    });
  });

  describe('⇛ ERC1155MetadataURI', () => {
    describe('# uri', () => {
      describe('» token type exists', () => {
        describe('» and its associated ERC721 is still locked', () => {
          describe('» and its associated ERC721 implements IERC721Metadata', () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
            });

            it('it returns its associated ERC721 URI', async () => {
              expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal(this.constants.tokenURI);
            });
          });

          describe('» but its associated ERC721 does not implement IERC721Metadata', () => {
            before(async () => {
              await setup(this);
              await spectralize(this, { mock: true });
            });

            it('it returns the default unavailable URI', async () => {
              expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal(this.constants.unavailableURI);
            });
          });
        });

        describe('» but its associated ERC721 is not locked anymore', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await unlock(this);
          });

          it('it returns the default unwrapped URI', async () => {
            expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal(this.constants.unlockedURI);
          });
        });
      });

      describe('» token type does not exist', () => {
        before(async () => {
          await setup(this);
        });

        it('it returns a blank string', async () => {
          expect(await this.contracts.sERC1155.uri(this.data.id)).to.equal('');
        });
      });
    });
  });

  describe('⇛ ERC721Receiver', () => {
    describe('# onERC721Received', () => {
      describe('» is called by a standard-compliant ERC721', () => {
        describe('» and spectralization data have a valid length', () => {
          describe('» and spectralization data ends up with Derrida magic value', () => {
            before(async () => {
              await setup(this, { approve: false });
              await spectralize(this, { transfer: true });
            });

            itSpectralizesLikeExpected(this, { transfer: true });
          });

          describe('» but spectralization data does not end up with Derrida magic value', () => {
            before(async () => {
              await setup(this, { approve: false });
            });

            it('it reverts', async () => {
              await expect(spectralize(this, { transfer: true, derrida: ethers.constants.HashZero })).to.be.revertedWith(
                'sERC1155: invalid spectralization data'
              );
            });
          });
        });

        describe('» but spectralization data does not have a valid length', () => {
          before(async () => {
            await setup(this, { approve: false });
          });

          it('it reverts', async () => {
            await expect(spectralize(this, { transfer: true, short: true })).to.be.revertedWith('sERC1155: invalid spectralization data length');
          });
        });
      });

      describe('» is called by a non-compliant ERC721', () => {
        before(async () => {
          await setup(this, { approve: false });
        });

        it('it reverts', async () => {
          await expect(
            this.contracts.sERC1155.onERC721Received(this.signers.others[0].address, ethers.constants.AddressZero, 0, ethers.constants.HashZero)
          ).to.be.revertedWith('sERC1155: NFT is not ERC721-compliant');
        });
      });
    });
  });

  describe('⇛ sERC1155', () => {
    describe('# spectralize', () => {
      describe('» NFT has never been spectralized', () => {
        describe('» and NFT is ERC721-compliant', () => {
          describe('» and sERC1155 has been approved to transfer NFT', () => {
            describe('» and NFT is not owned by sERC1155', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
              });

              itSpectralizesLikeExpected(this);
            });

            describe('» but NFT is owned by sERC1155', () => {
              before(async () => {
                await setup(this);
                await transfer.sERC721(this);
              });

              it('it reverts', async () => {
                await expect(spectralize(this)).to.be.revertedWith('sERC1155: NFT is already owned by sERC1155');
              });
            });
          });

          describe('» but sERC1155 has not been approved to transfer NFT', () => {
            before(async () => {
              await setup(this, { approve: false });
            });

            it('it reverts', async () => {
              await expect(spectralize(this)).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
            });
          });
        });

        describe('» but NFT is not ERC721-compliant', () => {
          before(async () => {
            await setup(this);
          });

          it('it reverts', async () => {
            await expect(spectralize(this, { collection: this.signers.others[0] })).to.be.revertedWith('sERC1155: NFT is not ERC721-compliant');
          });
        });
      });

      describe('» NFT has already been spectralized', () => {
        describe('» and NFT has been unlocked since', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await unlock(this);
            this.contracts.sERC721 = this.contracts.sERC721.connect(this.signers.owners[2]);
            await (await this.contracts.sERC721.approve(this.contracts.sERC1155.address, this.data.tokenId)).wait();
            await spectralize(this);
          });

          itSpectralizesLikeExpected(this);
        });

        describe('» but NFT still is locked', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.owners[1]);
          });

          it('it reverts', async () => {
            await expect(spectralize(this)).to.be.revertedWith('sERC1155: NFT is already locked');
          });
        });
      });
    });

    describe('# unlock [by id]', () => {
      describe('» spectre exists', () => {
        describe('» and spectre is locked', () => {
          describe("» and caller is spectre's guardian", () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
              await unlock(this);
            });

            itUnlocksLikeExpected(this);
          });

          describe("» but caller is not spectre's guardian", () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
            });

            it('it reverts', async () => {
              await expect(unlock(this, { from: this.signers.others[0] })).to.be.revertedWith('sERC1155: must be guardian to unlock');
            });
          });
        });

        describe('» but spectre is not locked anymore', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await unlock(this);
          });

          it('it reverts', async () => {
            await expect(unlock(this)).to.be.revertedWith('sERC1155: spectre is not locked');
          });
        });
      });

      describe('» spectre does not exists', () => {
        before(async () => {
          await setup(this);
        });

        it('it reverts', async () => {
          await expect(unlock(this)).to.be.revertedWith('sERC1155: spectre is not locked');
        });
      });
    });

    describe('# unlock [by address]', () => {
      describe('» spectre exists', () => {
        describe('» and spectre is locked', () => {
          describe("» and caller is spectre's guardian", () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
              await unlock(this, { byAddress: true });
            });

            itUnlocksLikeExpected(this);
          });

          describe("» but caller is not spectre's guardian", () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
            });

            it('it reverts', async () => {
              await expect(unlock(this, { byAddress: true, from: this.signers.others[0] })).to.be.revertedWith('sERC1155: must be guardian to unlock');
            });
          });
        });

        describe('» but spectre is not locked anymore', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await unlock(this);
          });

          it('it reverts', async () => {
            await expect(unlock(this, { byAddress: true })).to.be.revertedWith('sERC1155: spectre is not locked');
          });
        });
      });

      describe('» spectre does not exists', () => {
        before(async () => {
          await setup(this);
        });

        it('it reverts', async () => {
          await expect(unlock(this, { byAddress: true })).to.be.revertedWith('sERC1155: spectre is not locked');
        });
      });
    });

    describe('# updateUnavailableURI', () => {
      describe('» caller has ADMIN_ROLE', () => {
        before(async () => {
          await setup(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.root);
          await (await this.contracts.sERC1155.updateUnavailableURI('ipfs://testunavailableURI')).wait();
        });

        it('it updates unavailableURI', async () => {
          expect(await this.contracts.sERC1155.unavailableURI()).to.equal('ipfs://testunavailableURI');
        });
      });

      describe('» caller does not have ADMIN_ROLE', () => {
        before(async () => {
          await setup(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.others[0]);
        });

        it('it reverts', async () => {
          await expect(this.contracts.sERC1155.updateUnavailableURI('ipfs://testunavailableURI')).to.be.revertedWith(
            'sERC1155: must have admin role to update unavailableURI'
          );
        });
      });
    });

    describe('# updateUnlockedURI', () => {
      describe('» caller has ADMIN_ROLE', () => {
        before(async () => {
          await setup(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.root);
          await (await this.contracts.sERC1155.updateUnlockedURI('ipfs://testunlockedURI')).wait();
        });

        it('it updates unlockedURI', async () => {
          expect(await this.contracts.sERC1155.unlockedURI()).to.equal('ipfs://testunlockedURI');
        });
      });

      describe('» caller does not have ADMIN_ROLE', () => {
        before(async () => {
          await setup(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.others[0]);
        });

        it('it reverts', async () => {
          await expect(this.contracts.sERC1155.updateUnlockedURI('ipfs://testunlockedURI')).to.be.revertedWith(
            'sERC1155: must have admin role to update unlockedURI'
          );
        });
      });
    });

    describe('# onSERC20Transferred', () => {
      describe('» caller is a registered sERC20', () => {
        describe('» and sERC20s are transferred', () => {
          describe('» and the receiver is an EOA', () => {
            before(async () => {
              await setup(this);
              await spectralize(this);
              await mint.sERC20(this, { to: this.signers.holders[0] });
              await transfer.sERC20(this, { to: this.signers.holders[1] });
            });

            it('it emits a TransferSingle event', async () => {
              await expect(this.data.tx)
                .to.emit(this.contracts.sERC1155, 'TransferSingle')
                .withArgs(this.contracts.sERC20.address, this.signers.holders[0].address, this.signers.holders[1].address, this.data.id, this.constants.amount);
            });
          });

          describe('» and the receiver is a contract', () => {
            describe('» and the receiver contract implements onERC1155Received', () => {
              describe('» and the receiver contract returns a valid value', () => {
                before(async () => {
                  await setup(this);
                  await spectralize(this);
                  await mint.sERC20(this, { to: this.signers.holders[0] });
                  await mock.deploy.ERC1155Receiver(this);
                  await transfer.sERC20(this, { to: this.contracts.ERC1155Receiver });
                });

                it('it emits a TransferSingle event', async () => {
                  await expect(this.data.tx)
                    .to.emit(this.contracts.sERC1155, 'TransferSingle')
                    .withArgs(
                      this.contracts.sERC20.address,
                      this.signers.holders[0].address,
                      this.contracts.ERC1155Receiver.address,
                      this.data.id,
                      this.constants.amount
                    );
                });

                it('it calls onERC1155Received', async () => {
                  await expect(this.data.tx)
                    .to.emit(this.contracts.ERC1155Receiver, 'Received')
                    .withArgs(this.contracts.sERC20.address, this.signers.holders[0].address, this.data.id, this.constants.amount, '0x');
                });
              });
            });

            describe('» but the receiver contract returns an invalid value', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this, { to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this, { singleValue: '0x12345678' });
              });

              it('it reverts', async () => {
                await expect(transfer.sERC20(this, { to: this.contracts.ERC1155Receiver })).to.be.revertedWith('sERC1155: ERC1155Receiver rejected tokens');
              });
            });

            describe('» but the receiver contract reverts', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this, { to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this, { singleReverts: true });
              });

              it('it reverts', async () => {
                await expect(transfer.sERC20(this, { to: this.contracts.ERC1155Receiver })).to.be.revertedWith('ERC1155ReceiverMock: reverting on receive');
              });
            });

            describe('» but the receiver contract does not implement onERC1155Received', () => {
              before(async () => {
                await setup(this);
                await spectralize(this);
                await mint.sERC20(this, { to: this.signers.holders[0] });
                await mock.deploy.ERC1155Receiver(this);
                await transfer.sERC20(this, { to: this.contracts.sERC20 });
              });

              it('it emits a TransferSingle event', async () => {
                await expect(this.data.tx)
                  .to.emit(this.contracts.sERC1155, 'TransferSingle')
                  .withArgs(this.contracts.sERC20.address, this.signers.holders[0].address, this.contracts.sERC20.address, this.data.id, this.constants.amount);
              });
            });
          });
        });

        describe('» and sERC20s are minted', () => {
          before(async () => {
            await setup(this);
            await spectralize(this);
            await mint.sERC20(this, { to: this.signers.holders[0] });
          });

          it('it emits a TransferSingle event', async () => {
            await expect(this.data.tx)
              .to.emit(this.contracts.sERC1155, 'TransferSingle')
              .withArgs(this.contracts.sERC20.address, ethers.constants.AddressZero, this.signers.holders[0].address, this.data.id, this.constants.balance);
          });
        });
      });

      describe('» caller is a not a registered sERC20', () => {
        before(async () => {
          await setup(this);
          this.contracts.sERC1155 = this.contracts.sERC1155.connect(this.signers.others[0]);
        });

        it('it reverts', async () => {
          await expect(this.contracts.sERC1155.onSERC20Transferred(ethers.constants.AddressZero, ethers.constants.AddressZero, 0)).to.be.revertedWith(
            'sERC1155: must be sERC20 to use transfer hook'
          );
        });
      });
    });
  });
});
