const _Authorizer_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json");
const _Vault_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json");
const _OracleMock_ = require("../../../artifacts/contracts/mock/OracleMock.sol/OracleMock.json");
const _WETH_ = require("../../../artifacts/contracts/mock/WETH.sol/WETH.json");

class Balancer {
  static async deploy(ctx, opts) {
    opts.mint ??= opts.minter ? false : true;

    ctx.contracts.authorizer = await waffle.deployContract(ctx.signers.root, _Authorizer_, [ctx.signers.root.address]);
    ctx.contracts.oracleMock = await waffle.deployContract(ctx.signers.root, _OracleMock_);
    ctx.contracts.WETH = await waffle.deployContract(ctx.signers.root, _WETH_);
    ctx.contracts.bvault = await waffle.deployContract(ctx.signers.root, _Vault_, [ctx.contracts.authorizer.address, ctx.contracts.WETH.address, 0, 0]);
  }
}

module.exports = Balancer;
