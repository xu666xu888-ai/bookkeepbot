import { useState } from 'react';

/**
 * TelegramGate — Telegram 環境封鎖 + BOT_ACCESS_TOKEN 授權
 */
export default function TelegramGate({ status, user, onAuthorized, error: parentError }) {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // 非 Telegram 環境 — (已移除偽裝，App.jsx 會直接導向登入頁)
    if (status === 'blocked') {
        return null;
    }

    // 需要輸入 BOT_ACCESS_TOKEN
    if (status === 'need_token') {
        const handleSubmit = async (e) => {
            e?.preventDefault();
            if (!token.trim()) return;

            setLoading(true);
            setError('');

            try {
                await onAuthorized(token.trim());
            } catch (err) {
                setError(err.message);
                setToken('');
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="min-h-dvh flex items-center justify-center px-6">
                <div className="w-full max-w-xs animate-scale-in">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">🔑</div>
                        <h1 className="text-lg font-semibold text-text">
                            歡迎，{user?.first_name || '用戶'}
                        </h1>
                        <p className="text-sm text-text-dim mt-1">首次使用，請輸入存取碼</p>
                    </div>

                    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5">
                        <input
                            type="password"
                            autoComplete="off"
                            placeholder="存取碼"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            disabled={loading}
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-4
                           text-center text-lg text-text
                           focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow
                           transition-all duration-200 disabled:opacity-50"
                        />

                        {(error || parentError) && (
                            <p className="mt-3 text-sm text-expense text-center">
                                {error || parentError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !token.trim()}
                            className="w-full mt-4 py-3 rounded-xl bg-accent text-white font-medium
                           hover:bg-accent-hover transition-all disabled:opacity-50"
                        >
                            {loading ? '驗證中...' : '確認'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 加載中
    return (
        <div className="min-h-dvh flex items-center justify-center">
            <div className="text-center animate-scale-in">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-text-dim mt-4">正在驗證 Telegram 身份…</p>
            </div>
        </div>
    );
}
