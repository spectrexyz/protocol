module.exports = {
  skipFiles: [
    "mock/ERC721Mock.sol",
    "mock/ERC721SenderMock.sol",
    "mock/ERC1155ReceiverMock.sol",
    "mock/IssuerMock.sol",
    "mock/Imports.sol",
    "mock/OracleMock.sol",
    "mock/WETH.sol",
    "token/sERC721.sol",
    "issuer/interfaces/IBalancer.sol",
    "issuer/interfaces/ISpectralizationBootstrappingPool.sol",
    "pool/balancer/*.sol",
    "template/Template.sol",
  ],
};
