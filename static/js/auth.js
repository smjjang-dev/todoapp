import { supabase } from './supabaseClient.js';
import { isValidEmail, isValidPassword, isValidNickname } from './validators.js';

export async function signUp({ email, password, nickname }) {
  if (!isValidEmail(email)) throw new Error('이메일 형식이 올바르지 않습니다.');
  if (!isValidPassword(password)) throw new Error('비밀번호는 6자 이상이어야 합니다.');
  if (!isValidNickname(nickname)) throw new Error('닉네임을 입력해주세요.');

  return supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname: nickname.trim() } },
  });
}

export async function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'static/login.html';
    return null;
  }
  return session;
}

export async function redirectIfAuthed() {
  const session = await getSession();
  if (session) {
    window.location.href = '../index.html';
  }
}

export async function signInWithOAuth(provider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: new URL('../index.html', window.location.href).toString(),
    },
  });
}
