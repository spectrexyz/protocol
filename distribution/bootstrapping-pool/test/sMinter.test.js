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
    before(async () => {
      await setup(this, { balancer: true, minter: true });
    });
    it('it sets the pool name', async () => {
      // console.log((await this.sBootstrappingPool.getLatest(this.constants.sBootstrappingPool.ORACLE_VARIABLE.PAIR_PRICE)).toString());
      await advanceTime(86400);
      await this.sMinter.mint();
      // expect(await this.sBootstrappingPool.name()).to.equal(this.params.sBootstrappingPool.name);
    });
  });
});
