// const API = 'http://localhost:9090'
const API = 'https://cosmos.ryanis.cool'

export class UserError extends Error {}

export type User = {
  success: false
  sponsor: undefined
} | {
  success: true
  sponsor: boolean
  method: string
  user: {
    login: string
    avatarUrl: string
  }
}

export async function getUser(): Promise<User> {
  const r = await fetch(API + '/user', { mode: 'cors', credentials: 'include', method: 'POST' })
  return await r.json()
}

export async function logoutUser() {
  const r = await fetch(API + '/logout', { mode: 'cors', credentials: 'include', method: 'POST' })
  return await r.text()
}

export function openLoginWin() {
  return window.open(API + '/login/github', 'githublogin', 'status=no,location=no,toolbar=no,menubar=no,width=400,height=600')
}

export function openStripeWin() {
  return window.open(API + '/pay/stripe', 'stripepay')
}

export async function sendVerificationEmail(email: string) {
  const r = await fetch(API + '/login/email', {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new UserError(await r.text())
  return await r.text()
}

export async function verifyEmailCode(code: string) {
  const r = await fetch(API + '/login/email/verify', {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!r.ok) throw new UserError(await r.text())
  return await r.json()
}
