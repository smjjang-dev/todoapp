const test = require('node:test');
const assert = require('node:assert/strict');

test('isValidEmail', async (t) => {
  const { isValidEmail } = await import('../js/validators.js');

  await t.test('정상 이메일은 통과한다', () => {
    assert.equal(isValidEmail('user@example.com'), true);
  });

  await t.test('@가 없는 문자열은 실패한다', () => {
    assert.equal(isValidEmail('user.example.com'), false);
  });

  await t.test('빈 문자열은 실패한다', () => {
    assert.equal(isValidEmail(''), false);
  });
});

test('isValidPassword', async (t) => {
  const { isValidPassword } = await import('../js/validators.js');

  await t.test('6자 이상이면 통과한다', () => {
    assert.equal(isValidPassword('123456'), true);
  });

  await t.test('5자 이하면 실패한다', () => {
    assert.equal(isValidPassword('12345'), false);
  });
});

test('isValidNickname', async (t) => {
  const { isValidNickname } = await import('../js/validators.js');

  await t.test('공백을 trim 후 비어있지 않으면 통과한다', () => {
    assert.equal(isValidNickname('  철수  '), true);
  });

  await t.test('공백만 있으면 실패한다', () => {
    assert.equal(isValidNickname('   '), false);
  });

  await t.test('빈 문자열은 실패한다', () => {
    assert.equal(isValidNickname(''), false);
  });
});
