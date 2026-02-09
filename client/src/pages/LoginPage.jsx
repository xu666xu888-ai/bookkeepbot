import { useState, useRef, useEffect } from 'react';
import { api, setToken } from '../api';

export default function LoginPage({ onSuccess, telegramUser }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!code.trim()) return;

        setLoading(true);
        setError('');

        try {
            const { token } = await api.login(code.trim());
            setToken(token);
            onSuccess();
        } catch (err) {
            setError(err.message);
            setCode('');
            inputRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center px-6">
            <div className="w-full max-w-xs animate-scale-in">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold tracking-tight text-text">
                        史萊姆-好玩遊戲區
                    </h1>
                    {telegramUser && (
                        <p className="text-sm text-text-dim mt-2">
                            👋 {telegramUser.first_name}，請輸入驗證碼
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="glass rounded-2xl p-5">
                    <input
                        ref={inputRef}
                        type="password"
                        autoComplete="off"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        disabled={loading}
                        className="w-full bg-surface-2 border border-border rounded-xl px-4 py-4
                       text-center text-lg
                       text-text
                       focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow
                       transition-all duration-200
                       disabled:opacity-50"
                    />

                    {error && (
                        <p className="mt-3 text-sm text-expense text-center">
                            {error}
                        </p>
                    )}

                    {loading && (
                        <div className="mt-4 flex justify-center">
                            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
