import {Provider, Reader} from '@lay2/pw-core';
import {UPCKBBaseProvider} from '../build/main';
import {UPAuthResponse} from 'up-core';
import {ecsign, hashPersonalMessage, toRpcSig} from 'ethereumjs-util';
const privateKeyToAddress = require('ethereum-private-key-to-address');

export class UPCKBSecp256K1Provier extends UPCKBBaseProvider {
  constructor(
    public readonly secp256K1PrivateKey: string,
    username: string,
    assetLockCodeHash: string
  ) {
    super(username, assetLockCodeHash);
  }

  async init(): Promise<Provider> {
    return this;
  }

  async authorize(message: string): Promise<UPAuthResponse> {
    console.log('before signed message: ', message);

    const keyType = 'Secp256k1Pubkey';
    const pubkey = privateKeyToAddress(this.secp256K1PrivateKey);
    const sigHex = this.k1PersonalSign(message);

    let v = Number.parseInt(sigHex.slice(-2), 16);
    if (v >= 27) v -= 27;
    const sig = new Reader(
      sigHex.slice(0, -2) + v.toString(16).padStart(2, '0')
    ).serializeJson();

    // convert to hex string
    return {keyType, pubkey, sig};
  }

  k1PersonalSign(hash: string) {
    const personalHash = hashPersonalMessage(this.hexToBuffer(hash));
    const sig = ecsign(
      personalHash,
      this.hexToBuffer(this.secp256K1PrivateKey)
    );
    return toRpcSig(sig.v, sig.r, sig.s);
  }

  hexToBuffer(hex: string) {
    return Buffer.from(hex.replace('0x', ''), 'hex');
  }
}
