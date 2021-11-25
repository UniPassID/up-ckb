function dataLengthError(actual, required) {
  throw new Error(
    `Invalid data length! Required: ${required}, actual: ${actual}`
  );
}

function assertDataLength(actual, required) {
  if (actual !== required) {
    dataLengthError(actual, required);
  }
}

function assertArrayBuffer(reader) {
  if (reader instanceof Object && reader.toArrayBuffer instanceof Function) {
    reader = reader.toArrayBuffer();
  }
  if (!(reader instanceof ArrayBuffer)) {
    throw new Error(
      'Provided value must be an ArrayBuffer or can be transformed into ArrayBuffer!'
    );
  }
  return reader;
}

function verifyAndExtractOffsets(view, expectedFieldCount, compatible) {
  if (view.byteLength < 4) {
    dataLengthError(view.byteLength, '>4');
  }
  const requiredByteLength = view.getUint32(0, true);
  assertDataLength(view.byteLength, requiredByteLength);
  if (requiredByteLength === 4) {
    return [requiredByteLength];
  }
  if (requiredByteLength < 8) {
    dataLengthError(view.byteLength, '>8');
  }
  const firstOffset = view.getUint32(4, true);
  if (firstOffset % 4 !== 0 || firstOffset < 8) {
    throw new Error(`Invalid first offset: ${firstOffset}`);
  }
  const itemCount = firstOffset / 4 - 1;
  if (itemCount < expectedFieldCount) {
    throw new Error(
      `Item count not enough! Required: ${expectedFieldCount}, actual: ${itemCount}`
    );
  } else if (!compatible && itemCount > expectedFieldCount) {
    throw new Error(
      `Item count is more than required! Required: ${expectedFieldCount}, actual: ${itemCount}`
    );
  }
  if (requiredByteLength < firstOffset) {
    throw new Error(`First offset is larger than byte length: ${firstOffset}`);
  }
  const offsets = [];
  for (let i = 0; i < itemCount; i++) {
    const start = 4 + i * 4;
    offsets.push(view.getUint32(start, true));
  }
  offsets.push(requiredByteLength);
  for (let i = 0; i < offsets.length - 1; i++) {
    if (offsets[i] > offsets[i + 1]) {
      throw new Error(
        `Offset index ${i}: ${offsets[i]} is larger than offset index ${
          i + 1
        }: ${offsets[i + 1]}`
      );
    }
  }
  return offsets;
}

function serializeTable(buffers) {
  const itemCount = buffers.length;
  let totalSize = 4 * (itemCount + 1);
  const offsets = [];

  for (let i = 0; i < itemCount; i++) {
    offsets.push(totalSize);
    totalSize += buffers[i].byteLength;
  }

  const buffer = new ArrayBuffer(totalSize);
  const array = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint32(0, totalSize, true);
  for (let i = 0; i < itemCount; i++) {
    view.setUint32(4 + i * 4, offsets[i], true);
    array.set(new Uint8Array(buffers[i]), offsets[i]);
  }
  return buffer;
}

class AssetLockWitness {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new Pubkey(this.view.buffer.slice(offsets[0], offsets[1]), {
      validate: false,
    }).validate();
    new Bytes(this.view.buffer.slice(offsets[1], offsets[2]), {
      validate: false,
    }).validate();
    new Bytes32(this.view.buffer.slice(offsets[2], offsets[3]), {
      validate: false,
    }).validate();
    new UserInfo(this.view.buffer.slice(offsets[3], offsets[4]), {
      validate: false,
    }).validate();
    new Bytes(this.view.buffer.slice(offsets[4], offsets[5]), {
      validate: false,
    }).validate();
  }

  getPubkey() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Pubkey(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getSig() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Bytes(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getUsername() {
    const start = 12;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Bytes32(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getUserInfo() {
    const start = 16;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new UserInfo(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getUserInfoSmtProof() {
    const start = 20;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new Bytes(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

export function SerializeAssetLockWitness(value) {
  const buffers = [];
  buffers.push(SerializePubkey(value.pubkey));
  buffers.push(SerializeBytes(value.sig));
  buffers.push(SerializeBytes32(value.username));

  // NOTE: since user_info has been encoded as molecule format,
  // serialize user info is not needed here.
  // buffers.push(SerializeUserInfo(value.user_info));
  buffers.push(value.user_info.toArrayBuffer());

  buffers.push(SerializeBytes(value.user_info_smt_proof));
  return serializeTable(buffers);
}

class UserInfo {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new Bytes32(this.view.buffer.slice(offsets[0], offsets[1]), {
      validate: false,
    }).validate();
    new PubkeyVec(this.view.buffer.slice(offsets[1], offsets[2]), {
      validate: false,
    }).validate();
    if (offsets[3] - offsets[2] !== 1) {
      throw new Error(
        `Invalid offset for quick_login: ${offsets[2]} - ${offsets[3]}`
      );
    }
    new RecoveryEmailOpt(this.view.buffer.slice(offsets[3], offsets[4]), {
      validate: false,
    }).validate();
    new PendingStateOpt(this.view.buffer.slice(offsets[4], offsets[5]), {
      validate: false,
    }).validate();
    new Uint32(this.view.buffer.slice(offsets[5], offsets[6]), {
      validate: false,
    }).validate();
    new Bytes(this.view.buffer.slice(offsets[6], offsets[7]), {
      validate: false,
    }).validate();
  }

  getRegisterEmail() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Bytes32(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getLocalKeys() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new PubkeyVec(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getQuickLogin() {
    const start = 12;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new DataView(this.view.buffer.slice(offset, offset_end)).getUint8(0);
  }

  getRecoveryEmail() {
    const start = 16;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new RecoveryEmailOpt(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getPendingState() {
    const start = 20;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new PendingStateOpt(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getNonce() {
    const start = 24;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Uint32(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getSource() {
    const start = 28;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new Bytes(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

function SerializeUserInfo(value) {
  const buffers = [];
  buffers.push(SerializeBytes32(value.register_email));
  buffers.push(SerializePubkeyVec(value.local_keys));
  const quickLoginView = new DataView(new ArrayBuffer(1));
  quickLoginView.setUint8(0, value.quick_login);
  buffers.push(quickLoginView.buffer);
  buffers.push(SerializeRecoveryEmailOpt(value.recovery_email));
  buffers.push(SerializePendingStateOpt(value.pending_state));
  buffers.push(SerializeUint32(value.nonce));
  buffers.push(SerializeBytes(value.source));
  return serializeTable(buffers);
}

class PendingState {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new Pubkey(this.view.buffer.slice(offsets[0], offsets[1]), {
      validate: false,
    }).validate();
    new Uint64(this.view.buffer.slice(offsets[1], offsets[2]), {
      validate: false,
    }).validate();
    if (offsets[3] - offsets[2] !== 1) {
      throw new Error(
        `Invalid offset for replace_old: ${offsets[2]} - ${offsets[3]}`
      );
    }
  }

  getPendingKey() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Pubkey(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getStartBlock() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Uint64(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getReplaceOld() {
    const start = 12;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new DataView(this.view.buffer.slice(offset, offset_end)).getUint8(0);
  }
}

function SerializePendingState(value) {
  const buffers = [];
  buffers.push(SerializePubkey(value.pending_key));
  buffers.push(SerializeUint64(value.start_block));
  const replaceOldView = new DataView(new ArrayBuffer(1));
  replaceOldView.setUint8(0, value.replace_old);
  buffers.push(replaceOldView.buffer);
  return serializeTable(buffers);
}

class PendingStateOpt {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.hasValue()) {
      this.value().validate(compatible);
    }
  }

  value() {
    return new PendingState(this.view.buffer, { validate: false });
  }

  hasValue() {
    return this.view.byteLength > 0;
  }
}

function SerializePendingStateOpt(value) {
  if (value) {
    return SerializePendingState(value);
  } else {
    return new ArrayBuffer(0);
  }
}

class TypeId {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 32);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 32;
  }
}

function SerializeTypeId(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 32);
  return buffer;
}

class UserInfoOpt {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.hasValue()) {
      this.value().validate(compatible);
    }
  }

  value() {
    return new UserInfo(this.view.buffer, { validate: false });
  }

  hasValue() {
    return this.view.byteLength > 0;
  }
}

function SerializeUserInfoOpt(value) {
  if (value) {
    return SerializeUserInfo(value);
  } else {
    return new ArrayBuffer(0);
  }
}

class RecoveryEmail {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    if (offsets[1] - offsets[0] !== 1) {
      throw new Error(
        `Invalid offset for threshold: ${offsets[0]} - ${offsets[1]}`
      );
    }
    new Bytes32Vec(this.view.buffer.slice(offsets[1], offsets[2]), {
      validate: false,
    }).validate();
  }

  getThreshold() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new DataView(this.view.buffer.slice(offset, offset_end)).getUint8(0);
  }

  getEmails() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new Bytes32Vec(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

function SerializeRecoveryEmail(value) {
  const buffers = [];
  const thresholdView = new DataView(new ArrayBuffer(1));
  thresholdView.setUint8(0, value.threshold);
  buffers.push(thresholdView.buffer);
  buffers.push(SerializeBytes32Vec(value.emails));
  return serializeTable(buffers);
}

class RecoveryEmailOpt {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.hasValue()) {
      this.value().validate(compatible);
    }
  }

  value() {
    return new RecoveryEmail(this.view.buffer, { validate: false });
  }

  hasValue() {
    return this.view.byteLength > 0;
  }
}

function SerializeRecoveryEmailOpt(value) {
  if (value) {
    return SerializeRecoveryEmail(value);
  } else {
    return new ArrayBuffer(0);
  }
}

class Bytes20 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 20);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 20;
  }
}

function SerializeBytes20(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 20);
  return buffer;
}

class Bytes32 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 32);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 32;
  }
}

function SerializeBytes32(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 32);
  return buffer;
}

class Bytes256 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 256);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 256;
  }
}

function SerializeBytes256(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 256);
  return buffer;
}

class Uint32 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 4);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  toBigEndianUint32() {
    return this.view.getUint32(0, false);
  }

  toLittleEndianUint32() {
    return this.view.getUint32(0, true);
  }

  static size() {
    return 4;
  }
}

function SerializeUint32(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 4);
  return buffer;
}

class Uint64 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 8);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 8;
  }
}

function SerializeUint64(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 8);
  return buffer;
}

class Bytes {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.view.byteLength < 4) {
      dataLengthError(this.view.byteLength, '>4');
    }
    const requiredByteLength = this.length() + 4;
    assertDataLength(this.view.byteLength, requiredByteLength);
  }

  raw() {
    return this.view.buffer.slice(4);
  }

  indexAt(i) {
    return this.view.getUint8(4 + i);
  }

  length() {
    return this.view.getUint32(0, true);
  }
}

function SerializeBytes(value) {
  const item = assertArrayBuffer(value);
  const array = new Uint8Array(4 + item.byteLength);
  new DataView(array.buffer).setUint32(0, item.byteLength, true);
  array.set(new Uint8Array(item), 4);
  return array.buffer;
}

class BytesOpt {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.hasValue()) {
      this.value().validate(compatible);
    }
  }

  value() {
    return new Bytes(this.view.buffer, { validate: false });
  }

  hasValue() {
    return this.view.byteLength > 0;
  }
}

function SerializeBytesOpt(value) {
  if (value) {
    return SerializeBytes(value);
  } else {
    return new ArrayBuffer(0);
  }
}

class Bytes32Vec {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.view.byteLength < 4) {
      dataLengthError(this.view.byteLength, '>4');
    }
    const requiredByteLength = this.length() * Bytes32.size() + 4;
    assertDataLength(this.view.byteLength, requiredByteLength);
    for (let i = 0; i < 0; i++) {
      const item = this.indexAt(i);
      item.validate(compatible);
    }
  }

  indexAt(i) {
    return new Bytes32(
      this.view.buffer.slice(
        4 + i * Bytes32.size(),
        4 + (i + 1) * Bytes32.size()
      ),
      { validate: false }
    );
  }

  length() {
    return this.view.getUint32(0, true);
  }
}

function SerializeBytes32Vec(value) {
  const array = new Uint8Array(4 + Bytes32.size() * value.length);
  new DataView(array.buffer).setUint32(0, value.length, true);
  for (let i = 0; i < value.length; i++) {
    const itemBuffer = SerializeBytes32(value[i]);
    array.set(new Uint8Array(itemBuffer), 4 + i * Bytes32.size());
  }
  return array.buffer;
}

class BytesVec {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    for (let i = 0; i < offsets.length - 1; i++) {
      new Bytes(this.view.buffer.slice(offsets[i], offsets[i + 1]), {
        validate: false,
      }).validate();
    }
  }

  length() {
    if (this.view.byteLength < 8) {
      return 0;
    } else {
      return this.view.getUint32(4, true) / 4 - 1;
    }
  }

  indexAt(i) {
    const start = 4 + i * 4;
    const offset = this.view.getUint32(start, true);
    let offset_end = this.view.byteLength;
    if (i + 1 < this.length()) {
      offset_end = this.view.getUint32(start + 4, true);
    }
    return new Bytes(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

function SerializeBytesVec(value) {
  return serializeTable(value.map((item) => SerializeBytes(item)));
}

class RsaPubkey {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new Uint32(this.view.buffer.slice(offsets[0], offsets[1]), {
      validate: false,
    }).validate();
    new Bytes(this.view.buffer.slice(offsets[1], offsets[2]), {
      validate: false,
    }).validate();
  }

  getE() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Uint32(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }

  getN() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new Bytes(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

function SerializeRsaPubkey(value) {
  const buffers = [];
  buffers.push(SerializeUint32(value.e));
  buffers.push(SerializeBytes(value.n));
  return serializeTable(buffers);
}

class Secp256k1Pubkey {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 20);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 20;
  }
}

function SerializeSecp256k1Pubkey(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 20);
  return buffer;
}

class Secp256r1Pubkey {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 64);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 64;
  }
}

function SerializeSecp256r1Pubkey(value) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 64);
  return buffer;
}

class Pubkey {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.view.byteLength < 4) {
      assertDataLength(this.view.byteLength, '>4');
    }
    const t = this.view.getUint32(0, true);
    switch (t) {
      case 0:
        new RsaPubkey(this.view.buffer.slice(4), {
          validate: false,
        }).validate();
        break;
      case 1:
        new Secp256k1Pubkey(this.view.buffer.slice(4), {
          validate: false,
        }).validate();
        break;
      case 2:
        new Secp256r1Pubkey(this.view.buffer.slice(4), {
          validate: false,
        }).validate();
        break;
      default:
        throw new Error(`Invalid type: ${t}`);
    }
  }

  unionType() {
    const t = this.view.getUint32(0, true);
    switch (t) {
      case 0:
        return 'RsaPubkey';
      case 1:
        return 'Secp256k1Pubkey';
      case 2:
        return 'Secp256r1Pubkey';
      default:
        throw new Error(`Invalid type: ${t}`);
    }
  }

  value() {
    const t = this.view.getUint32(0, true);
    switch (t) {
      case 0:
        return new RsaPubkey(this.view.buffer.slice(4), { validate: false });
      case 1:
        return new Secp256k1Pubkey(this.view.buffer.slice(4), {
          validate: false,
        });
      case 2:
        return new Secp256r1Pubkey(this.view.buffer.slice(4), {
          validate: false,
        });
      default:
        throw new Error(`Invalid type: ${t}`);
    }
  }
}

export function SerializePubkey(value) {
  switch (value.type) {
    case 'RsaPubkey': {
      const itemBuffer = SerializeRsaPubkey(value.value);
      const array = new Uint8Array(4 + itemBuffer.byteLength);
      const view = new DataView(array.buffer);
      view.setUint32(0, 0, true);
      array.set(new Uint8Array(itemBuffer), 4);
      return array.buffer;
    }
    case 'Secp256k1Pubkey': {
      const itemBuffer = SerializeSecp256k1Pubkey(value.value);
      const array = new Uint8Array(4 + itemBuffer.byteLength);
      const view = new DataView(array.buffer);
      view.setUint32(0, 1, true);
      array.set(new Uint8Array(itemBuffer), 4);
      return array.buffer;
    }
    case 'Secp256r1Pubkey': {
      const itemBuffer = SerializeSecp256r1Pubkey(value.value);
      const array = new Uint8Array(4 + itemBuffer.byteLength);
      const view = new DataView(array.buffer);
      view.setUint32(0, 2, true);
      array.set(new Uint8Array(itemBuffer), 4);
      return array.buffer;
    }
    default:
      throw new Error(`Invalid type: ${value.type}`);
  }
}

class PubkeyVec {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    for (let i = 0; i < offsets.length - 1; i++) {
      new Pubkey(this.view.buffer.slice(offsets[i], offsets[i + 1]), {
        validate: false,
      }).validate();
    }
  }

  length() {
    if (this.view.byteLength < 8) {
      return 0;
    } else {
      return this.view.getUint32(4, true) / 4 - 1;
    }
  }

  indexAt(i) {
    const start = 4 + i * 4;
    const offset = this.view.getUint32(start, true);
    let offset_end = this.view.byteLength;
    if (i + 1 < this.length()) {
      offset_end = this.view.getUint32(start + 4, true);
    }
    return new Pubkey(this.view.buffer.slice(offset, offset_end), {
      validate: false,
    });
  }
}

function SerializePubkeyVec(value) {
  return serializeTable(value.map((item) => SerializePubkey(item)));
}

// module.exports = {
//   SerializeAssetLockWitness,
//   SerializePubkey
// }
