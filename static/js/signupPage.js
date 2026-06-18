import { signUp, signInWithOAuth, redirectIfAuthed } from './auth.js';

redirectIfAuthed();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js');
}

const form = document.getElementById('signup-form');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  successMessage.textContent = '';

  const nickname = document.getElementById('nickname').value;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const { data, error } = await signUp({ email, password, nickname });
    if (error) {
      errorMessage.textContent = '회원가입에 실패했습니다. 입력 정보를 확인하거나 잠시 후 다시 시도해주세요.';
      return;
    }
    if (data.session) {
      window.location.href = '../index.html';
      return;
    }
    successMessage.textContent = '회원가입이 완료되었습니다. 로그인 페이지로 이동해주세요.';
    form.reset();
  } catch (err) {
    errorMessage.textContent = err.message;
  }
});

document.getElementById('google-login').addEventListener('click', async () => {
  errorMessage.textContent = '';
  const { error } = await signInWithOAuth('google');
  if (error) errorMessage.textContent = '소셜 회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.';
});

document.getElementById('github-login').addEventListener('click', async () => {
  errorMessage.textContent = '';
  const { error } = await signInWithOAuth('github');
  if (error) errorMessage.textContent = '소셜 회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.';
});
