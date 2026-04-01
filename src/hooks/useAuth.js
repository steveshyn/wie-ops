import { useState } from 'react'

// ARCHITECTURE NOTE:
// Replace login() body with a POST /auth/login API call
// to enable server-side JWT validation and multi-user auth.
// No component changes needed — only this hook changes.

export function useAuth() {
  const [isAuthed, setIsAuthed] = useState(
    () => localStorage.getItem('wie_ops_authed') === 'true'
  )

  const login = (password, apiKey) => {
    const correctPassword = import.meta.env.VITE_OPS_PASSWORD
    if (password === correctPassword) {
      localStorage.setItem('wie_api_key', apiKey)
      localStorage.setItem('wie_ops_authed', 'true')
      setIsAuthed(true)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('wie_api_key')
    localStorage.removeItem('wie_ops_authed')
    setIsAuthed(false)
  }

  return { isAuthed, login, logout }
}
