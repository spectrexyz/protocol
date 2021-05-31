const { expect } = require('chai');
const { deployContract, createFixtureLoader } = require('ethereum-waffle');
const { ethers } = require('ethers');
const {
  initialize,
  allocate,
  mint,
  mock,
  safeBatchTransferFrom,
  safeTransferFrom,
  setApprovalForAll,
  setup,
  spectralize,
  transfer,
  unlock,
  withdraw,
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  CloneFactory,
  PaymentSplitter,
  SERC20,
} = require('./helpers');

// const setup = async (ctx) => {
//   ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);
//   ctx.contracts.CloneFactory = await deployContract(ctx.signers.root, CloneFactory);
//   ctx.contracts.PaymentSplitter = await deployContract(ctx.signers.root, PaymentSplitter);
// };

describe.only('AllocationSplitter', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ withdraw', () => {
    describe('» allocation exists', () => {
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

        it('it transfers sERC20s', async () => {});
        it('it emits a Withdraw event', async () => {});
      });
    });
  });
});
