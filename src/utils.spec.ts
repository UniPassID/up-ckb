import test from 'ava';
import { sha256 } from './utils';

test('test sha256', (t) => {
  const hash = sha256('hello world');

  t.is(
    hash,
    '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
  );
});
