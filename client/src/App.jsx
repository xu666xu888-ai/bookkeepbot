import { useState, useEffect } from 'react';
import { isLoggedIn, api } from './api';
import TelegramGate from './components/TelegramGate';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

/**
 * App — 三階段認證流程
 * 1. Telegram 環境檢測 + initData 驗簽
 * 2. BOT_ACCESS_TOKEN 授權（首次使用）
 * 3. TOTP 登入
 */
export default function App() {
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());
    // 'checking' | 'blocked' | 'need_token' | 'need_totp' | 'authorized'
    const [telegramStatus, setTelegramStatus] = useState('checking');
    const [telegramUser, setTelegramUser] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        checkTelegram();
    }, []);

    const checkTelegram = async () => {
        const tg = window.Telegram?.WebApp;

        console.log('[TG] WebApp:', !!tg, 'initData:', tg?.initData?.substring(0, 30));

        // 非 Telegram 環境
        if (!tg || !tg.initData) {
            setTelegramStatus('blocked');
            return;
        }

        // Telegram 環境初始化
        tg.ready();
        tg.expand();

        // 設定 Telegram 主題色
        if (tg.themeParams) {
            document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color || '#0a0a0a');
        }

        // 如果已經有 JWT 且有效，直接進入
        if (isLoggedIn()) {
            setTelegramStatus('authorized');
            setLoggedIn(true);
            return;
        }

        // 驗證 initData
        try {
            const result = await api.telegramAuth(tg.initData);
            console.log('[TG] auth result:', result.status);
            setTelegramUser(result.user);

            if (result.status === 'need_token') {
                setTelegramStatus('need_token');
            } else if (result.status === 'need_totp') {
                setTelegramStatus('need_totp');
            }
        } catch (err) {
            console.error('[TG] auth error:', err.message);
            setError(err.message);
            setTelegramStatus('blocked');
        }
    };

    const handleAuthorize = async (accessToken) => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        const result = await api.telegramAuth(tg.initData, accessToken);
        setTelegramUser(result.user);

        if (result.status === 'need_totp') {
            setTelegramStatus('need_totp');
        }
    };

    const handleLoginSuccess = () => {
        setLoggedIn(true);
        setTelegramStatus('authorized');
    };

    // 已登入 → Dashboard
    if (loggedIn && telegramStatus === 'authorized') {
        return <Dashboard />;
    }

    // 需要 TOTP 登入
    if (telegramStatus === 'need_totp') {
        return <LoginPage
            onSuccess={handleLoginSuccess}
            telegramUser={telegramUser}
        />;
    }

    // 其他狀態（blocked / need_token / checking）
    return <TelegramGate
        status={telegramStatus}
        user={telegramUser}
        onAuthorized={handleAuthorize}
        error={error}
    />;
}
