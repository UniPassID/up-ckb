import { createHash } from 'crypto';

export function sha256(message: string) {
  return `0x${createHash('SHA256').update(Buffer.from(message)).digest('hex')}`;
}
