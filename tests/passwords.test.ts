import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordChange } from '../src/lib/passwords.ts';

test('password changes require current password, matching confirmation and a different new password', () => {
  assert.ok(validatePasswordChange('', 'NewPassword123!', 'NewPassword123!'));
  assert.ok(validatePasswordChange('Existing123!', 'short', 'short'));
  assert.ok(validatePasswordChange('Existing123!', 'Existing123!', 'Existing123!'));
  assert.ok(validatePasswordChange('Existing123!', 'NewPassword123!', 'Different123!'));
  assert.equal(validatePasswordChange('Existing123!', 'NewPassword123!', 'NewPassword123!'), null);
});
test('password limit counts UTF-8 bytes and passwords are never trimmed', () => {
  assert.ok(validatePasswordChange('Existing123!', '가'.repeat(25), '가'.repeat(25)));
  assert.equal(validatePasswordChange('Existing123!', ' NewPassword123! ', ' NewPassword123! '), null);
});
