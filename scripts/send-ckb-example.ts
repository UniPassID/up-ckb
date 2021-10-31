import {
  Address,
  AddressType,
  Amount,
  CellDep,
  DepType,
  OutPoint,
} from '@lay2/pw-core';
import UPCKB from '../build/main/';
import {UPCKBSecp256K1Provier} from './up-ckb-secp256k1-provider';

const CKB_NODE_URL = 'https://testnet.ckb.dev';
const CKB_INDEXER_URL = 'https://testnet.ckb.dev/indexer';
const AGGREGATOR_URL = 'http://47.243.172.144:3030';
const ASSET_LOCK_CODE_HASH =
  '0xd3f6d12ac220b3f7e104f3869e72487f8940adb13a526a2abd775c2cd5040f77';
const ASSET_LOCK_DEP_TX_HASH =
  '0xf4a9d95b5df48f9ed878ebcb23b3558b6d8ed11ecd7c26e0fd1b55778f8bedc6';

// eth address 0x08313c282553cD1f2a32B8E45d8b072012520a72
const username = 'upckbtest';
const privateKey =
  '';

const toAddress = new Address(
  'ckt1qyq8m9zkye6exf6wely5853kldwrn5u3y8usk56lwt',
  AddressType.ckb
);
const amount = new Amount('100');

(async () => {
  UPCKB.config({
    aggregatorUrl: AGGREGATOR_URL,
    ckbNodeUrl: CKB_NODE_URL,
    ckbIndexerUrl: CKB_INDEXER_URL,
    upLockCodeHash: ASSET_LOCK_CODE_HASH,
    upLockDep: new CellDep(
      DepType.code,
      new OutPoint(ASSET_LOCK_DEP_TX_HASH, '0x0')
    ),
  });

  const provider = new UPCKBSecp256K1Provier(
    privateKey,
    username,
    ASSET_LOCK_CODE_HASH
  );

  const txHash = await UPCKB.sendCKB(toAddress, amount, provider);

  console.log('txHash', txHash);
})();
