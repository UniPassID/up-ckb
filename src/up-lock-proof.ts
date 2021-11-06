import {
  CellDep,
  DepType,
  normalizers,
  OutPoint,
  Reader,
  RPC,
  SerializeWitnessArgs,
  Transaction,
  transformers,
  WitnessArgs,
} from '@lay2/pw-core';
import axios from 'axios';
import { UPAuthResponse } from 'up-core';

import { getConfig } from './config';
import * as LumosCore from './js-scripts/lumos-core';
import * as UPLockWitness from './js-scripts/up-lock-witness';

export type LockInfo = {
  readonly userInfo: string;
  readonly username: string;
};

export type AssetLockProof = {
  readonly cellDeps: readonly CellDep[];
  readonly lockInfo: readonly LockInfo[];
  readonly userInfoSmtProof: string;
};

async function fetchAssetLockProof(
  usernameHash: string
): Promise<AssetLockProof> {
  const data = await axios.post(getConfig().aggregatorUrl, {
    jsonrpc: '2.0',
    method: 'get_assert_lock_tx_info',
    params: [usernameHash],
    id: '1',
  });

  // convert data to AssetLockProf
  const { cell_deps, lock_info, user_info_smt_proof } = data.data.result;

  const cellDeps = [];
  for (const {
    dep_type,
    out_point: { tx_hash, index },
  } of cell_deps) {
    const depType = dep_type === DepType.code ? DepType.code : DepType.depGroup;
    cellDeps.push(new CellDep(depType, new OutPoint(tx_hash, index)));
  }

  const lockInfo = [];
  for (const { user_info, username } of lock_info) {
    lockInfo.push({ userInfo: user_info, username } as LockInfo);
  }

  const proof: AssetLockProof = {
    cellDeps,
    lockInfo: lockInfo,
    userInfoSmtProof: user_info_smt_proof,
  };

  return proof;
}

function completeTxWithProof(
  signedTx: Transaction,
  assetLockProof: AssetLockProof,
  usernameHash: string
) {
  const { pubkey, sig } = extractSigFromWitness(signedTx.witnesses[0]);
  signedTx.raw.cellDeps.push(...assetLockProof.cellDeps);
  // push asset-lock bin as cell deps
  signedTx.raw.cellDeps.push(getConfig().upLockDep);

  console.log('[up-ckb] proof', assetLockProof);

  console.log('[up-ckb] pubkey', pubkey);
  console.log('[up-ckb] sig', sig);

  // rebuild witness, username/userinfo/proof
  const witness_lock = UPLockWitness.SerializeAssetLockWitness({
    pubkey,
    sig,
    username: new Reader(usernameHash),
    user_info: new Reader(assetLockProof.lockInfo[0].userInfo),
    user_info_smt_proof: new Reader(assetLockProof.userInfoSmtProof),
  });

  console.log('[up-ckb] witness_lock', new Reader(witness_lock).serializeJson());

  // Fill witnesses
  signedTx.witnesses[0] = new Reader(
    SerializeWitnessArgs(
      normalizers.NormalizeWitnessArgs({
        ...(signedTx.witnessArgs[0] as WitnessArgs),
        lock: witness_lock,
      })
    )
  ).serializeJson();

  return signedTx;
}

function extractSigFromWitness(witness: string) {
  console.log('[up-ckb] signedTx.witnesses[0]', witness);
  const witnessArgs = new LumosCore.WitnessArgs(new Reader(witness));
  console.log('[up-ckb] witnessArgs', witnessArgs.getLock().value().raw());

  const lockHex = new Reader(
    witnessArgs.getLock().value().raw()
  ).serializeJson();

  const { keyType, pubkey, sig } = JSON.parse(
    Buffer.from(lockHex.replace('0x', ''), 'hex').toString()
  ) as UPAuthResponse;

  console.log('[up-ckb] UPAuthResponse', { keyType, pubkey, sig });
  // convert type to UPAuthResponse
  let pubKeyValue;
  switch (keyType) {
    case 'RsaPubkey':
      pubKeyValue = {
        e: new Reader(pubkey.slice(0, 10)),
        n: new Reader(`0x${pubkey.slice(10)}`),
      };
      break;
    case 'Secp256k1Pubkey':
      pubKeyValue = new Reader(pubkey);
      break;
    case 'Secp256r1Pubkey':
      break;
  }
  const pubKey = {
    type: keyType,
    value: pubKeyValue,
  };

  return { pubkey: pubKey, sig: new Reader(sig) };
}

export async function sendUPLockTransaction(
  usernameHash: string,
  signedTx: Transaction,
  rpc: RPC
) {
  // fetch cellDeps/userinfo/proof from aggregator
  const assetLockProof: AssetLockProof = await fetchAssetLockProof(
    usernameHash
  );
  if (new Reader(assetLockProof.lockInfo[0].userInfo).length() === 0) {
    throw new Error('user not registered');
  }

  // fill tx cellDeps
  const completedSignedTx = completeTxWithProof(
    signedTx,
    assetLockProof,
    usernameHash
  );

  const transformedTx = transformers.TransformTransaction(completedSignedTx);
  console.log('[up-ckb] tx', JSON.stringify(transformedTx, null, 2));
  const txHash = await rpc.send_transaction(transformedTx, 'passthrough');
  console.log('[up-ckb] txHash', txHash);
  return txHash;
}
