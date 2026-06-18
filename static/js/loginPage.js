import { signIn, signInWithOAuth, redirectIfAuthed } from './auth.js';

redirectIfAuthed();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js');
}

const form = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await signIn({ email, password });
  if (error) {
    errorMessage.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    return;
  }
  window.location.href = '../index.html';
});

document.getElementById('google-login').addEventListener('click', async () => {
  errorMessage.textContent = '';
  const { error } = await signInWithOAuth('google');
  if (error) errorMessage.textContent = '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';
});

document.getElementById('github-login').addEventListener('click', async () => {
  errorMessage.textContent = '';
  const { error } = await signInWithOAuth('github');
  if (error) errorMessage.textContent = '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';
});
