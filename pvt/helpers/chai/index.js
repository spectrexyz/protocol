const Decimal = require('decimal.js');

function near(chai, utils) {
  chai.Assertion.addMethod('near', function(actual, relativeError) {
    const expected = new Decimal(this._obj.toString());
    const delta = new Decimal(actual.toString())
      .dividedBy(expected)
      .sub(1)
      .abs();
    this.assert(
      delta.lte(new Decimal(relativeError)),
      'expected #{exp} to be near #{act}',
      'expected #{exp} not to be near #{act}',
      expected.toString(),
      actual.toString()
    );
  });
}

module.exports = { near };
