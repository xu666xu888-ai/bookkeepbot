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

        // 完全不在 Telegram 中 → 顯示 debug 資訊（臨時）
        if (!tg || (!hasInitData && !hasUnsafeUser && !hasPlatform)) {
            // 臨時 debug：在頁面顯示偵測值
            const debugEl = document.createElement('pre');
            debugEl.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:20px;background:#111;color:#0f0;font-size:12px;z-index:9999;white-space:pre-wrap;word-break:break-all';
            debugEl.textContent = JSON.stringify({
                hasTG: !!window.Telegram,
                hasWebApp: !!tg,
                initData: tg?.initData || '(empty)',
                initDataUnsafe: tg?.initDataUnsafe || '(empty)',
                platform: tg?.platform || '(unknown)',
                version: tg?.version || '(none)',
                colorScheme: tg?.colorScheme || '(none)',
                hash: location.hash?.substring(0, 100) || '(no hash)',
                hasTGProxy: !!window.TelegramWebviewProxy,
                ua: navigator.userAgent
            }, null, 2);
            document.body.appendChild(debugEl);
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

        // 有 initData → 走正式驗證流程
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
                setError(err.message);
                setTelegramStatus('blocked');
            }
            return;
        }

        // 在 Telegram 中但沒有 initData（可能是 Menu Button 配置問題）
        // 直接用 unsafeUser 做初步識別，跳到 need_token 讓用戶輸入存取碼
        if (hasUnsafeUser) {
            setTelegramUser({
                id: tg.initDataUnsafe.user.id,
                first_name: tg.initDataUnsafe.user.first_name
            });
            setTelegramStatus('need_token');
            return;
        }

        // 在 Telegram 中但完全沒有用戶資訊 → 直接進入 need_token
        setTelegramStatus('need_token');
    };

    const handleAuthorize = async (accessToken) => {
        const tg = window.Telegram?.WebApp;
        const initData = tg?.initData || '';

        if (initData) {
            // 有 initData → 正式驗證
            const result = await api.telegramAuth(initData, accessToken);
            setTelegramUser(result.user);
            if (result.status === 'need_totp') {
                setTelegramStatus('need_totp');
            }
        } else {
            // 無 initData（fallback）→ 直接用 token 驗證
            const result = await api.telegramAuth('', accessToken);
            if (result.user) setTelegramUser(result.user);
            if (result.status === 'need_totp') {
                setTelegramStatus('need_totp');
            }
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
