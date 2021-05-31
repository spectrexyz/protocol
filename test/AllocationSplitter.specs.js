const { expect } = require('chai');
const { ethers } = require('ethers');
const { initialize, allocate, mint, setup, spectralize, transfer, withdraw } = require('./helpers');

describe.only('AllocationSplitter', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ constructor', () => {
    before(async () => {
      await setup(this);
    });

    it('# it sets up permissions', async () => {
      expect(await this.contracts.AllocationSplitter.hasRole(await this.contracts.AllocationSplitter.DEFAULT_ADMIN_ROLE(), this.signers.root.address)).to.equal(
        true
      );
      expect(await this.contracts.AllocationSplitter.hasRole(await this.contracts.AllocationSplitter.ALLOCATE_ROLE(), this.signers.admin.address)).to.equal(
        true
      );
    });
  });

  describe('⇛ allocate', () => {});

  describe('⇛ withdraw', () => {
    describe('» token is allocated', () => {
      describe('» and there is something to withdraw', () => {
        before(async () => {
          await setup(this);
          await spectralize(this);
          await allocate(this);
          await mint.sERC20(this);
        });

        it('it updates allocation history', async () => {
          await transfer.sERC20(this, { amount: '1000' });
          const allocation1 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation1.received).to.equal(1000);
          expect(allocation1.withdrawn).to.equal(0);

          await withdraw(this);
          const allocation2 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation2.received).to.equal(1000);
          expect(allocation2.withdrawn).to.equal(300);
          expect(await this.contracts.AllocationSplitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[0].address)).to.equal(300);

          await transfer.sERC20(this, { amount: '5000' });
          const allocation3 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation3.received).to.equal(6000);
          expect(allocation3.withdrawn).to.equal(300);

          await withdraw(this, { from: this.signers.beneficiaries[1] });
          const allocation4 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation4.received).to.equal(6000);
          expect(allocation4.withdrawn).to.equal(900);
          expect(await this.contracts.AllocationSplitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[1].address)).to.equal(600);

          await transfer.sERC20(this, { amount: '6000' });
          const allocation5 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation5.received).to.equal(12000);
          expect(allocation5.withdrawn).to.equal(900);

          await withdraw(this, { from: this.signers.beneficiaries[0] });
          await withdraw(this, { from: this.signers.beneficiaries[1] });
          await withdraw(this, { from: this.signers.beneficiaries[2] });
          const allocation6 = await this.contracts.AllocationSplitter.allocationOf(this.contracts.sERC20.address);
          expect(allocation6.received).to.equal(12000);
          expect(allocation6.withdrawn).to.equal(12000);
          expect(await this.contracts.AllocationSplitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[0].address)).to.equal(3600);
          expect(await this.contracts.AllocationSplitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[1].address)).to.equal(1200);
          expect(await this.contracts.AllocationSplitter.withdrawnBy(this.contracts.sERC20.address, this.signers.beneficiaries[2].address)).to.equal(7200);
        });

        it('it transfers sERC20s', async () => {
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[0].address)).to.equal(3600);
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[1].address)).to.equal(1200);
          expect(await this.contracts.sERC20.balanceOf(this.signers.beneficiaries[2].address)).to.equal(7200);
        });

        it('it emits a Withdraw event', async () => {
          await expect(this.data.tx)
            .to.emit(this.contracts.AllocationSplitter, 'Withdraw')
            .withArgs(this.contracts.sERC20.address, this.signers.beneficiaries[2].address, 7200);
        });
      });
    });

    describe('» token is not allocated', () => {
      before(async () => {
        await setup(this);
      });

      it('it reverts', async () => {
        await expect(withdraw(this)).to.be.revertedWith('AllocationSplitter: non-allocated token');
      });
    });
  });
});
