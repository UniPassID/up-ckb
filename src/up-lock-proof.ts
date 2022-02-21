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
import { UPAuthResponse } from 'up-core-test';

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

/**
 * fetch UniPass smt proof/cell deps/user info from UniPass snapshot server
 *
 * @param usernameHash UniPass username sha256 hash
 * @returns formated AssetLockProof
 */
export async function fetchAssetLockProof(
  usernameHash: string
): Promise<AssetLockProof> {
  const data = await axios.post(getConfig().upSnapshotUrl, {
    jsonrpc: '2.0',
    method: 'get_asset_lock_tx_info',
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
    lockInfo.push({ userInfo: user_info, username });
  }

  const proof: AssetLockProof = {
    cellDeps,
    lockInfo,
    userInfoSmtProof: user_info_smt_proof,
  };

  return proof;
}

/**
 * complete transaction with UniPass smt proof
 *
 * @param signedTx signed transaction
 * @param assetLockProof UniPass smt proof from UniPass snapshot server url
 * @param usernameHash UniPass username sha256 hash
 * @returns
 */
export function completeTxWithProof(
  signedTx: Transaction,
  assetLockProof: AssetLockProof,
  usernameHash: string
) {
  const { pubkey, sig } = extractSigFromWitness(signedTx.witnesses[0]);
  signedTx.raw.cellDeps.push(...assetLockProof.cellDeps);
  // push asset-lock bin as cell deps

  // rebuild witness, username/userinfo/proof
  const witnessLock = UPLockWitness.SerializeAssetLockWitness({
    pubkey,
    sig,
    username: new Reader(usernameHash),
    user_info: new Reader(assetLockProof.lockInfo[0].userInfo),
    user_info_smt_proof: new Reader(assetLockProof.userInfoSmtProof),
  });

  // Fill witnesses
  signedTx.witnesses[0] = new Reader(
    SerializeWitnessArgs(
      normalizers.NormalizeWitnessArgs({
        ...(signedTx.witnessArgs[0] as WitnessArgs),
        lock: witnessLock,
      })
    )
  ).serializeJson();

  return signedTx;
}

/**
 * decode UniPass pubkey and signature from witness.lock in hex format
 *
 * @param witness CKB transaction witness from PWCore signer
 * @returns pubkey in molecule format
 */
function extractSigFromWitness(witness: string) {
  const witnessArgs = new LumosCore.WitnessArgs(new Reader(witness));

  const lockHex = new Reader(
    witnessArgs.getLock().value().raw()
  ).serializeJson();

  const { keyType, pubkey, sig } = JSON.parse(
    Buffer.from(lockHex.replace('0x', ''), 'hex').toString()
  ) as UPAuthResponse;

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

/**
 * complete transaction with cell deps and witness including smt proof
 * and send transaction to ckb chain
 *
 * @param usernameHash UniPass username sha256 hash
 * @param signedTx signed CKB transaction
 * @param rpc
 * @returns CKB transaction hash
 */
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

  // fill tx cell deps and witness
  const completedSignedTx = completeTxWithProof(
    signedTx,
    assetLockProof,
    usernameHash
  );

  const transformedTx = transformers.TransformTransaction(completedSignedTx);
  const txHash = await rpc.send_transaction(transformedTx, 'passthrough');
  return txHash;
}
