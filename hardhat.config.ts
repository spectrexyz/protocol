import type { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";

import dotenv from "dotenv";

dotenv.config();

const testnetAccounts = [
  process.env.ACCOUNT_PK1,
  process.env.ACCOUNT_PK2,
  process.env.ACCOUNT_PK3,
].filter(Boolean) as string[];

if (testnetAccounts.length === 0) {
  throw new Error(
    "The env vars ACCOUNT_PK{1,2,3} are missing. Please specify at least one of them."
  );
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        count: 50,
        accountsBalance: "1000000000000000000000000",
      },
      allowUnlimitedContractSize: true,
    },
    goerli: {
      accounts: testnetAccounts,
      allowUnlimitedContractSize: true,
      gas: 21000000,
      url: process.env.RPC_GOERLI,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  gasReporter: {
    enabled: Boolean(process.env.REPORT_GAS),
  },
};

export default config;
