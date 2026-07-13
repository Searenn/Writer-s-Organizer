import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError('Не удалось войти. Попробуйте ещё раз.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Animated background orbs */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="14" fill="url(#loginGrad)" />
            <path
              d="M14 16C14 14.9 14.9 14 16 14H26C28.2 14 30 15.8 30 18V20C30 22.2 28.2 24 26 24H18V34H14V16Z"
              fill="white"
              fillOpacity="0.9"
            />
            <path
              d="M26 24H30L34 34H29.5L26 24Z"
              fill="white"
              fillOpacity="0.6"
            />
            <defs>
              <linearGradient id="loginGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Heading */}
        <h1 className="login-title">Pisaka</h1>
        <p className="login-subtitle">Органайзер для писателей</p>

        {/* Features list */}
        <ul className="login-features">
          <li>
            <span className="login-feature-icon">✍️</span>
            Книги, главы и персонажи
          </li>
          <li>
            <span className="login-feature-icon">📊</span>
            Статистика и финансы
          </li>
          <li>
            <span className="login-feature-icon">🔒</span>
            Ваши данные защищены
          </li>
        </ul>

        {/* Divider */}
        <div className="login-divider">
          <span>Войдите чтобы продолжить</span>
        </div>

        {/* Google Sign-In button */}
        <button
          id="google-signin-btn"
          className="login-google-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="login-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
              <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
            </svg>
          )}
          {loading ? 'Вход...' : 'Войти через Google'}
        </button>

        {error && (
          <p className="login-error">{error}</p>
        )}

        <p className="login-note">
          Данные синхронизируются между всеми вашими устройствами
        </p>
      </div>
    </div>
  );
};
