/**
 * API 封裝層
 * - 自動攜帶 JWT Token
 * - 自動讀取 X-New-Token 實現滑動視窗刷新
 */

let token = localStorage.getItem('token');

export function getToken() {
    return token;
}

export function setToken(newToken) {
    token = newToken;
    if (newToken) {
        localStorage.setItem('token', newToken);
    } else {
        localStorage.removeItem('token');
    }
}

export function isLoggedIn() {
    return !!token;
}

export function logout() {
    setToken(null);
    window.location.reload();
}

async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(path, { ...options, headers });

    // 滑動視窗：讀取新 Token
    const newToken = res.headers.get('X-New-Token');
    if (newToken) {
        setToken(newToken);
    }

    // 401 → 登出
    if (res.status === 401) {
        setToken(null);
        window.location.reload();
        throw new Error('未授權');
    }

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || '請求失敗');
    }

    return data;
}

// === Auth ===
export const api = {
    login: (code) => request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ code })
    }),

    // === Transactions ===
    getTransactions: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/transactions${qs ? '?' + qs : ''}`);
    },
    createTransaction: (data) => request('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateTransaction: (id, data) => request(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteTransaction: (id) => request(`/api/transactions/${id}`, {
        method: 'DELETE'
    }),

    // === Accounts ===
    getAccounts: () => request('/api/accounts'),
    createAccount: (name) => request('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name })
    }),
    updateAccount: (id, name) => request(`/api/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
    }),
    deleteAccount: (id) => request(`/api/accounts/${id}`, {
        method: 'DELETE'
    }),

    // === Categories ===
    getCategories: () => request('/api/categories'),
    createCategory: (name) => request('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name })
    }),
    deleteCategory: (id) => request(`/api/categories/${id}`, {
        method: 'DELETE'
    }),

    // === AI ===
    aiParse: (text) => request('/api/ai/parse', {
        method: 'POST',
        body: JSON.stringify({ text })
    }),
};
