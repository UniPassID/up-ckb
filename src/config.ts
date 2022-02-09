import { ChainID } from '@lay2/pw-core';

export class UPCKBConfig {
  constructor(
    public upSnapshotUrl: string, // UniPass Snapshot server url
    public ckbNodeUrl: string, // CKB node url
    public ckbIndexerUrl: string, // CKB indexer url
    public chainID: ChainID, // CKB Chain ID
    public upLockCodeHash: string // UniPass Asset Lock TypeID
  ) {}
}

const upConfig: UPCKBConfig = new UPCKBConfig(
  '',
  'https://testnet.ckb.dev',
  'https://testnet.ckb.dev/indexer',
  ChainID.ckb_testnet,
  '0xd3f6d12ac220b3f7e104f3869e72487f8940adb13a526a2abd775c2cd5040f77'
);

export type UPCKBConfigOption = {
  readonly upSnapshotUrl?: string; // UniPass Snapshot server url
  readonly chainID?: ChainID; // CKB chain ID
  readonly ckbNodeUrl?: string; // CKB node url
  readonly [key: string]: any; // other options
};

/**
 * set configuration for UPCKB
 * @param options UniPass CKB Config Options
 */
export function config(options?: UPCKBConfigOption) {
  upConfig.upSnapshotUrl = options?.upSnapshotUrl || upConfig.upSnapshotUrl;
  upConfig.chainID = options?.chainID || upConfig.chainID;
  upConfig.ckbNodeUrl = options?.ckbNodeUrl || upConfig.ckbNodeUrl;
  upConfig.ckbIndexerUrl = options?.ckbIndexerUrl || upConfig.ckbIndexerUrl;
  upConfig.upLockCodeHash = options?.upLockCodeHash || upConfig.upLockCodeHash;
}

export function getConfig(): UPCKBConfig {
  return upConfig;
}
