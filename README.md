<h1 align="center">
  <br>
  <a href="https://spectre.xyz" target="_blank"><img src=".github/logo.png" alt="spectre ⇌ protocol" width="300"></a>
  <br>
  spectre ⇌ protocol
  <br>
  <p align="center">
    <a href="https://github.com/spectrexyz/protocol/actions/workflows/test.js.yml">
      <img src="https://github.com/spectrexyz/protocol/actions/workflows/test.js.yml/badge.svg?branch=master" />
    </a>
    <a href="https://www.gnu.org/licenses/gpl-3.0">
      <img src="https://img.shields.io/badge/License-GPLv3-green.svg" />
    </a>
  </p>
</h1>

<pre align="center">
  » where the one becomes multitude
  » built by punks on <a href="http://ethereum.org" target="_blank">Ethereum</a>
</pre>

## Introduction

For a deeper documentation of spectre ⇌ protocol see [here](https://spectre.xyz/litepaper).

## Usage

### Install

```
git clone https://github.com/spectrexyz/protocol.git
cd protocol && pnpm install
```

### Scripts

```
pnpm lint
pnpm compile
pnpm test
pnpm test:coverage
pnpm test:gas
```

#### Network specific

```
pnpm deploy:rinkeby
pnpm deploy:goerli

ETHERSCAN_KEY=<key> pnpm verify:rinkeby
ETHERSCAN_KEY=<key> pnpm verify:goerli

pnpm roles:rinkeby
pnpm roles:goerli

pnpm fractionalize:rinkeby
pnpm fractionalize:goerli

pnpm dashboard:rinkeby
pnpm dashboard:goerli

pnpm addresses:rinkeby
pnpm addresses:goerli
```
