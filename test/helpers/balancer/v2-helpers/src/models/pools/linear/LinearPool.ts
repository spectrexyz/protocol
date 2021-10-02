import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractTransaction } from 'ethers';

import { SwapKind } from '@balancer-labs/balancer-js';
import { BigNumberish } from '@balancer-labs/v2-helpers/src/numbers';
import { ZERO_ADDRESS } from '@balancer-labs/v2-helpers/src/constants';
import * as expectEvent from '@balancer-labs/v2-helpers/src/test/expectEvent';

import { GeneralSwap } from '../../vault/types';
import { Account, TxParams } from '../../types/types';
import { SwapLinearPool, RawLinearPoolDeployment } from './types';

import Vault from '../../vault/Vault';
import Token from '../../tokens/Token';
import TokenList from '../../tokens/TokenList';
import TypesConverter from '../../types/TypesConverter';
import LinearPoolDeployer from './LinearPoolDeployer';

export default class LinearPool {
  instance: Contract;
  poolId: string;
  mainToken: Token;
  wrappedToken: Token;
  bptToken: Token;
  lowerTarget: BigNumberish;
  upperTarget: BigNumberish;
  swapFeePercentage: BigNumberish;
  wrappedTokenRateProvider: string;
  wrappedTokenRateCacheDuration: BigNumberish;
  vault: Vault;
  owner?: SignerWithAddress;

  static async create(params: RawLinearPoolDeployment, mockedVault: boolean): Promise<LinearPool> {
    return LinearPoolDeployer.deploy(params, mockedVault);
  }

  constructor(
    instance: Contract,
    poolId: string,
    vault: Vault,
    mainToken: Token,
    wrappedToken: Token,
    bptToken: Token,
    lowerTarget: BigNumberish,
    upperTarget: BigNumberish,
    swapFeePercentage: BigNumberish,
    wrappedTokenRateProvider: string,
    wrappedTokenRateCacheDuration: BigNumberish,
    owner?: SignerWithAddress
  ) {
    this.instance = instance;
    this.poolId = poolId;
    this.vault = vault;
    this.mainToken = mainToken;
    this.wrappedToken = wrappedToken;
    this.bptToken = bptToken;
    this.lowerTarget = lowerTarget;
    this.upperTarget = upperTarget;
    this.swapFeePercentage = swapFeePercentage;
    this.wrappedTokenRateProvider = wrappedTokenRateProvider;
    this.wrappedTokenRateCacheDuration = wrappedTokenRateCacheDuration;
    this.owner = owner;
  }

  get address(): string {
    return this.instance.address;
  }

  get tokens(): TokenList {
    return new TokenList([this.wrappedToken, this.mainToken, this.bptToken]).sort();
  }

  get mainIndex(): number {
    return this.getTokenIndex(this.mainToken);
  }

  get wrappedIndex(): number {
    return this.getTokenIndex(this.wrappedToken);
  }

  get bptIndex(): number {
    return this.getTokenIndex(this.bptToken);
  }

  get tokenIndexes(): { mainIndex: number; wrappedIndex: number; bptIndex: number } {
    const mainIndex = this.mainIndex;
    const wrappedIndex = this.wrappedIndex;
    const bptIndex = this.bptIndex;
    return { mainIndex, wrappedIndex, bptIndex };
  }

  getTokenIndex(token: Token): number {
    const addresses = this.tokens.addresses;
    return addresses[0] == token.address ? 0 : addresses[1] == token.address ? 1 : 2;
  }

  async name(): Promise<string> {
    return this.instance.name();
  }

  async symbol(): Promise<string> {
    return this.instance.symbol();
  }

  async decimals(): Promise<number> {
    return this.instance.decimals();
  }

  async totalSupply(): Promise<BigNumber> {
    return this.instance.totalSupply();
  }

  async balanceOf(account: Account): Promise<BigNumber> {
    return this.instance.balanceOf(TypesConverter.toAddress(account));
  }

  async getVault(): Promise<string> {
    return this.instance.getVault();
  }

  async getRegisteredInfo(): Promise<{ address: string; specialization: BigNumber }> {
    return this.vault.getPool(this.poolId);
  }

  async getPoolId(): Promise<string> {
    return this.instance.getPoolId();
  }

  async getSwapFeePercentage(): Promise<BigNumber> {
    return this.instance.getSwapFeePercentage();
  }

  async getScalingFactors(): Promise<BigNumber[]> {
    return this.instance.getScalingFactors();
  }

  async getScalingFactor(token: Token): Promise<BigNumber> {
    return this.instance.getScalingFactor(token.address);
  }

  async getWrappedTokenRateProvider(): Promise<string> {
    return this.instance.getWrappedTokenRateProvider();
  }

  async getWrappedTokenRateCache(): Promise<{ rate: BigNumber; duration: BigNumber; expires: BigNumber }> {
    return this.instance.getWrappedTokenRateCache();
  }

  async getTokens(): Promise<{ tokens: string[]; balances: BigNumber[]; lastChangeBlock: BigNumber }> {
    return this.vault.getPoolTokens(this.poolId);
  }

  async getBalances(): Promise<BigNumber[]> {
    const { balances } = await this.getTokens();
    return balances;
  }

  async getTokenInfo(
    token: Token
  ): Promise<{ cash: BigNumber; managed: BigNumber; lastChangeBlock: BigNumber; assetManager: string }> {
    return this.vault.getPoolTokenInfo(this.poolId, token);
  }

  async getRate(): Promise<BigNumber> {
    return this.instance.getRate();
  }

  async getTargets(): Promise<{ lowerTarget: BigNumber; upperTarget: BigNumber }> {
    return this.instance.getTargets();
  }

  async setTargets(
    lowerTarget: BigNumber,
    upperTarget: BigNumber,
    txParams: TxParams = {}
  ): Promise<ContractTransaction> {
    const sender = txParams.from || this.owner;
    const pool = sender ? this.instance.connect(sender) : this.instance;
    return pool.setTargets(lowerTarget, upperTarget);
  }

  async initialize(): Promise<void> {
    return this.instance.initialize();
  }

  async setWrappedTokenRateCacheDuration(duration: number, { from }: TxParams = {}): Promise<ContractTransaction> {
    const pool = from ? this.instance.connect(from) : this.instance;
    return pool.setWrappedTokenRateCacheDuration(duration);
  }

  async updateWrappedTokenRateCache(): Promise<ContractTransaction> {
    return this.instance.updateWrappedTokenRateCache();
  }

  async swapGivenIn(params: SwapLinearPool): Promise<BigNumber> {
    return this.swap(this._buildSwapParams(SwapKind.GivenIn, params));
  }

  async swapGivenOut(params: SwapLinearPool): Promise<BigNumber> {
    return this.swap(this._buildSwapParams(SwapKind.GivenOut, params));
  }

  async swap(params: GeneralSwap): Promise<BigNumber> {
    const tx = await this.vault.generalSwap(params);
    const receipt = await (await tx).wait();
    const { amount } = expectEvent.inReceipt(receipt, 'Swap').args;
    return amount;
  }

  private _buildSwapParams(kind: number, params: SwapLinearPool): GeneralSwap {
    return {
      kind,
      poolAddress: this.address,
      poolId: this.poolId,
      from: params.from,
      to: params.recipient ?? ZERO_ADDRESS,
      tokenIn: params.in < this.tokens.length ? this.tokens.get(params.in)?.address ?? ZERO_ADDRESS : ZERO_ADDRESS,
      tokenOut: params.out < this.tokens.length ? this.tokens.get(params.out)?.address ?? ZERO_ADDRESS : ZERO_ADDRESS,
      lastChangeBlock: params.lastChangeBlock ?? 0,
      data: params.data ?? '0x',
      amount: params.amount,
      balances: params.balances,
      indexIn: params.in,
      indexOut: params.out,
    };
  }
}
