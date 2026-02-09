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

        // 多重訊號偵測 Telegram 環境
        const hasInitData = tg && tg.initData && tg.initData.length > 0;
        const hasUnsafeUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
        const hasPlatform = tg && tg.platform && tg.platform !== 'unknown';

        console.log('[TG] SDK:', !!tg,
            'initData:', hasInitData,
            'unsafeUser:', !!hasUnsafeUser,
            'platform:', tg?.platform
        );

        // Telegram 環境初始化（如果有）
        if (tg) {
            tg.ready();
            tg.expand();
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color || '#0a0a0a');
            }
        }

        // 如果已經有 JWT 且有效，直接進入
        if (isLoggedIn()) {
            setTelegramStatus('authorized');
            setLoggedIn(true);
            return;
        }

        // 嘗試 Telegram 驗證，但失敗不封鎖，而是讓用戶手動登入
        if (hasInitData) {
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
                // 驗證失敗也不封鎖，轉為需要 TOTP 登入（或 Token）
                setTelegramStatus('need_totp');
            }
            return;
        }

        if (hasUnsafeUser) {
            setTelegramUser({
                id: tg.initDataUnsafe.user.id,
                first_name: tg.initDataUnsafe.user.first_name
            });
            // 讓用戶輸入 token 或直接登入
            setTelegramStatus('need_token');
            return;
        }

        // 完全沒有 Telegram 資訊，或是瀏覽器環境 -> 允許進入登入頁面
        setTelegramStatus('need_totp');
    };

    const handleAuthorize = async (accessToken) => {
        const tg = window.Telegram?.WebApp;
        const initData = tg?.initData || '';

        try {
            if (initData) {
                const result = await api.telegramAuth(initData, accessToken);
                setTelegramUser(result.user);
                if (result.status === 'need_totp') {
                    setTelegramStatus('need_totp');
                }
            } else {
                const result = await api.telegramAuth('', accessToken);
                if (result.user) setTelegramUser(result.user);
                if (result.status === 'need_totp') {
                    setTelegramStatus('need_totp');
                }
            }
        } catch (e) {
            console.error(e);
            alert('授權失敗: ' + e.message);
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

    // 如果已登入但在檢查中（通常 isLoggedIn 會先攔截），這裡兜底
    if (loggedIn) {
        return <Dashboard />;
    }

    // 需要 TOTP 登入 (預設狀態)
    if (telegramStatus === 'need_totp' || telegramStatus === 'blocked' || telegramStatus === 'checking') {
        return <LoginPage
            onSuccess={handleLoginSuccess}
            telegramUser={telegramUser}
        />;
    }

    // 其他狀態（need_token）
    return <TelegramGate
        status={telegramStatus}
        user={telegramUser}
        onAuthorized={handleAuthorize}
        error={error}
    />;
}
