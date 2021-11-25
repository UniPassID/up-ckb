import {
  Blake2bHasher,
  Hasher,
  HashType,
  Platform,
  Provider,
  Script,
} from '@lay2/pw-core';
import { UPAuthResponse } from 'up-core-test';

import { sha256 } from '../utils';

export class UPCKBBaseProvider extends Provider {
  public readonly usernameHash: string;

  hasher(): Hasher {
    return new Blake2bHasher();
  }

  constructor(
    public readonly username: string,
    public readonly assetLockCodeHash: string,
    public readonly hashType: HashType = HashType.type
  ) {
    super(Platform.ckb);

    this.usernameHash = sha256(username);
    const script = new Script(
      assetLockCodeHash,
      this.usernameHash.slice(0, 42),
      hashType
    );
    this.address = script.toAddress();
  }

  async init(): Promise<Provider> {
    return this;
  }

  /**
   * call UniPass authorize a CKB transaction
   *
   * @param _message message to be signed
   * @returns UniPass Authorize Response
   */
  async authorize(_message: string): Promise<UPAuthResponse> {
    throw new Error('Not Implemented');
  }

  async sign(message: string): Promise<string> {
    return (
      '0x' +
      Buffer.from(JSON.stringify(await this.authorize(message))).toString('hex')
    );
  }

  async close() {
    console.log('do nothing');
  }
}
