import { Reader } from '@lay2/pw-core';
export class Bytes {
  constructor(reader: Reader);
  validate(compatible: boolean);
  raw(): ArrayBuffer;
  indexAt(i: number): number;
  length(): number;
}

export class BytesOpt {
  constructor(reader: Reader);
  validate(compatible: boolean);
  value(): Bytes;
  hasValue(): boolean;
}

export class WitnessArgs {
  constructor(reader: Reader);
  validate(compatible: boolean);
  getLock(): BytesOpt;
  getInputType(): BytesOpt;
  getOutputType(): BytesOpt;
}
