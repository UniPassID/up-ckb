import { CellDep, ChainID, DepType, OutPoint } from '@lay2/pw-core';

export class UPConfig {
  constructor(
    public aggregatorUrl: string,
    public ckbNodeUrl: string,
    public ckbIndexerUrl: string,
    public chainID: ChainID,
    public upLockCodeHash: string,
    public upLockDep: CellDep
  ) {}
}

const upConfig: UPConfig = new UPConfig(
  '',
  'https://testnet.ckb.dev',
  'https://testnet.ckb.dev/indexer',
  ChainID.ckb_testnet,
  '0xd3f6d12ac220b3f7e104f3869e72487f8940adb13a526a2abd775c2cd5040f77',
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
