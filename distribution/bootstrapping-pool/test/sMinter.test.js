const chai = require('chai');
const { expect } = require('chai');
const { initialize, setup } = require('@spectrexyz/protocol-helpers');
const { near } = require('@spectrexyz/protocol-helpers/chai');
const { advanceTime, currentTimestamp } = require('@spectrexyz/protocol-helpers/time');

const MAX_RELATIVE_ERROR = 0.00005;

chai.use(near);

describe.only('sBootstrappingPool', () => {
  before(async () => {
    await initialize(this);
  });

  describe('⇛ mint', () => {
    describe('» pool is not initialized yet', () => {
      before(async () => {
        await setup(this, { balancer: true, minter: true });
        // this.data.previousPairPrice = await this.sBootstrappingPool.pairPrice();
        // this.data.previousTotalSupply = await this.sERC20.totalSupply();
        this.data.previousBankBalance = await this.signers.sMinter.bank.getBalance();
        this.data.previousBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();
        await advanceTime(86400);
        await this.sMinter.mint();
        // this.data.latestPairPrice = await this.sBootstrappingPool.pairPrice();
        // this.data.latestTotalSupply = await this.sERC20.totalSupply();
        this.data.latestBankBalance = await this.signers.sMinter.bank.getBalance();
        this.data.latestBeneficiaryBalance = await this.signers.sMinter.beneficiary.getBalance();

        this.data.expectedProtocolFee = this.params.sMinter.value.mul(this.params.sMinter.protocolFee).div(this.constants.sMinter.ONE);
        this.data.expectedFee = this.params.sMinter.value.mul(this.params.sMinter.fee).div(this.constants.sMinter.ONE);
        this.data.expectedBeneficiaryPay = this.params.sMinter.value.sub(this.data.expectedProtocolFee).sub(this.data.expectedFee);
      });

      it('it collects protocol fee', async () => {
        expect(this.data.latestBankBalance.sub(this.data.previousBankBalance)).to.equal(this.data.expectedProtocolFee);
      });

      it('it updates pool balance', async () => {
        const { balances } = await this.contracts.Vault.getPoolTokens(this.data.poolId);
        const sBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[0] : balances[1];
        const eBalance = this.sBootstrappingPool.sERC20IsToken0 ? balances[1] : balances[0];

        expect(eBalance).to.equal(this.data.expectedFee);
      });

      it('it pays beneficiary', async () => {
        expect(this.data.latestBeneficiaryBalance.sub(this.data.previousBeneficiaryBalance)).to.equal(this.data.expectedBeneficiaryPay);
      });

      it('it mints BPT towards sMinter bank', async () => {
        expect(await this.sBootstrappingPool.balanceOf(this.signers.sMinter.bank.address)).to.not.equal(0);
      });

      it('it preserves pair price', async () => {
        console.log(this.sBootstrappingPool.sERC20IsToken0);
        console.log((await this.sBootstrappingPool.pairPrice()).toString());
      });
    });
  });
});
