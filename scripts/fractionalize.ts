import type { BigNumber } from "ethers";

import chalk from "chalk";
import dotenv from "dotenv";
import { deployments, ethers, network } from "hardhat";

dotenv.config();

type Signer = Awaited<ReturnType<typeof ethers.getSigners>>[number];

async function getContract(name: string) {
  const contract = await deployments.get(name);
  return ethers.getContractAt(contract.abi, contract.address);
}

const terminal = {
  print: (msg: string) => {
    process.stdout.write(msg);
  },
  info: (msg: string) => {
    console.log(msg);
  },
  newline: () => {
    console.log("");
  },
  success: (msg: string) => {
    console.log(chalk.green(msg));
  },
  title: (msg: string) => {
    console.log(chalk.cyan(`-]] ${msg.toUpperCase()} [[-`));
    console.log(chalk.cyan(`--------------`));
  },
  subtitle: (msg: string) => {
    console.log(chalk.yellow(msg));
  },
  error: (msg: string) => {
    console.log(chalk.red(msg));
  },
};

const data = (guardian: string) => ({
  guardian,
  name: "NFT Fraction",
  symbol: "FRCT",
  cap: ethers.utils.parseEther(String(1_000_000n)),
  buyoutReserve: ethers.utils.parseEther("10"),
  multiplier: ethers.utils.parseEther("1.5"),
  timelock: ethers.BigNumber.from("864000"), // 10 days
  sMaxNormalizedWeight: ethers.BigNumber.from("800000000000000000"),
  sMinNormalizedWeight: ethers.BigNumber.from("500000000000000000"),
  beneficiaries: [guardian],
  shares: [ethers.utils.parseEther("15")],
  swapFeePercentage: ethers.BigNumber.from("10000000000000000"),
  issuanceReserve: ethers.utils.parseEther(String(100_000n)), // issuance reserve = cap ÷ buyout reserve
  fee: ethers.utils.parseEther("5"), // percentage
  buyoutFlash: true,
  issuanceFlash: true,
});

const approve = async () => {
  const sERC721 = await getContract("sERC721");
  const vault = await getContract("Vault");

  terminal.print("» Approving vault to transfer NFTs… ");

  const [account] = await ethers.getSigners();
  const accountAddress = await account.getAddress();
  const isApproved = await sERC721.isApprovedForAll(
    accountAddress,
    vault.address,
  );
  if (isApproved) {
    terminal.success("N/A (already approved)");
    return;
  }

  const tx = await sERC721.setApprovalForAll(vault.address, true);
  await tx.wait();
  terminal.success("OK");
};

const fractionalize = async () => {
  const sERC721 = await getContract("sERC721");
  const channeler = await getContract("Channeler");
  const vault = await getContract("Vault");

  if (!process.env.TOKEN_URI) {
    throw new Error("The TOKEN_URI environment variable is missing.");
  }

  terminal.print(
    `» Fractionalizing NFT with URI ${process.env.TOKEN_URI}… `,
  );

  const [account] = await ethers.getSigners();
  const tx = await channeler.mintAndFractionalize(
    process.env.TOKEN_URI,
    data(await account.getAddress()),
  );
  await tx.wait();
  terminal.success("OK");

  const events1 = (await sERC721.queryFilter(sERC721.filters.Transfer()))
    .filter((event) => event.event === "Transfer");
  const tokenId = events1[events1.length - 1].args?.tokenId;

  const events2 = (await vault.queryFilter(vault.filters.Fractionalize()))
    .filter((event) => event.event === "Fractionalize");
  const id = events2[events2.length - 1].args?.id;
  const sERC20Address = await vault.sERC20Of(id);

  terminal.info(
    `»» ERC721: https://testnets.opensea.io/assets/${sERC721.address}/${tokenId}`,
  );
  terminal.info(
    `»» ERC1155: https://testnets.opensea.io/assets/${vault.address}/${id}`,
  );
  terminal.info(
    `»» sERC20: https://${network.name}.etherscan.io/token/${sERC20Address}`,
  );

  return sERC20Address;
};

const issue = async (
  sERC20: string,
  from: Signer,
  amount: BigNumber,
) => {
  const expected = ethers.BigNumber.from("0");
  const issuer = await getContract("Issuer");

  terminal.print(
    `» Buying ${
      ethers.utils.formatEther(amount)
    } ETH worth of sERC20 from ${await from.getAddress()}… `,
  );

  const tx = await issuer.connect(from).issue(sERC20, expected, {
    value: amount,
  });
  await tx.wait();

  terminal.success("OK");
};

const main = async () => {
  await approve();
  const sERC20 = await fractionalize();

  for (const [index, signer] of (await ethers.getSigners()).entries()) {
    await issue(
      sERC20,
      signer,
      ethers.utils.parseEther(["0.01", "0.02", "0.03"][index % 3]),
    );
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    terminal.error(error.message);
    process.exit(1);
  });
