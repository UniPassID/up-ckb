import {
  Address,
  Amount,
  Builder,
  DefaultSigner,
  IndexerCollector,
  RPC,
  Transaction
} from '@lay2/pw-core';
import UPCore from 'up-core';

import { getConfig } from './config';
import { config } from './config';
import { UPCKBBaseProvider, UPCoreSimpleProvier } from './providers';
import { sendUPLockTransaction } from './up-lock-proof';
import { UPLockSimpleBuilder } from './up-lock-simple-builder';

async function getUPUsername(): Promise<string> {
  const account = await UPCore.connect();
  return account.username;
}

async function sendCKB(
  to: Address,
  amount: Amount,
  provider?: UPCKBBaseProvider
): Promise<string> {
  if (!provider) {
    provider = new UPCoreSimpleProvier(
      await getUPUsername(),
      getConfig().upLockCodeHash
    );
  }

  const builder = new UPLockSimpleBuilder(to, amount, provider!, {
    collector: new IndexerCollector(getConfig().ckbIndexerUrl),
    witnessArgs: Builder.WITNESS_ARGS.RawSecp256k1
  });
  const tx = await builder.build();

  return sendTransaction(tx, provider!);
}

async function sendTransaction(
  tx: Transaction,
  provider: UPCKBBaseProvider
): Promise<string> {
  // const oldCellDeps = tx.raw.cellDeps;
  tx.raw.cellDeps = [];
  const signer = new DefaultSigner(provider);
  const signedTx = await signer.sign(tx);

  const rpc = new RPC(getConfig().ckbNodeUrl);
  return await sendUPLockTransaction(provider.usernameHash, signedTx, rpc);
}

export * from './providers';
const functions = {
  config,
  sendCKB,
  sendTransaction
};
export default functions;
