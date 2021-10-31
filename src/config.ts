import { CellDep, ChainID, DepType, OutPoint } from '@lay2/pw-core';

export class UPConfig {
  public aggregatorUrl: string;
  public ckbNodeUrl: string;
  public ckbIndexerUrl: string;
  public chainID: ChainID;
  public upLockCodeHash: string;
  public upLockDep: CellDep;

  constructor(
    aggregatorUrl: string,
    ckbNodeUrl: string,
    ckbIndexerUrl: string,
    chainID: ChainID,
    upLockCodeHash: string,
    upLockDep: CellDep
  ) {
    this.aggregatorUrl = aggregatorUrl;
    this.ckbNodeUrl = ckbNodeUrl;
    this.ckbIndexerUrl = ckbIndexerUrl;
    this.chainID = chainID;
    this.upLockCodeHash = upLockCodeHash;
    this.upLockDep = upLockDep;
  }
}

const upConfig: UPConfig = new UPConfig(
  '',
  'https://testnet.ckb.dev',
  'https://testnet.ckb.dev/indexer',
  ChainID.ckb_testnet,
  '',
  new CellDep(DepType.code, new OutPoint('txhash', 'txindex'))
);

export type UPConfigOption = {
  readonly aggregatorUrl?: string;
  readonly chainID?: ChainID;
  readonly ckbNodeUrl?: string;
  readonly [key: string]: any;
};

export function config(options?: UPConfigOption) {
  upConfig.aggregatorUrl = options?.aggregatorUrl || upConfig.aggregatorUrl;
  upConfig.chainID = options?.chainID || upConfig.chainID;
  upConfig.ckbNodeUrl = options?.ckbNodeUrl || upConfig.ckbNodeUrl;
  upConfig.ckbIndexerUrl = options?.ckbIndexerUrl || upConfig.ckbIndexerUrl;
  upConfig.upLockCodeHash = options?.upLockCodeHash || upConfig.upLockCodeHash;
  upConfig.upLockDep = options?.upLockDep || upConfig.upLockDep;
}

export function getConfig(): UPConfig {
  return upConfig;
}
