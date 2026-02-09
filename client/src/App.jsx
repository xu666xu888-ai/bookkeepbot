import { useState } from 'react';
import { isLoggedIn } from './api';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

export default function App() {
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());

    if (!loggedIn) {
        return <LoginPage onSuccess={() => setLoggedIn(true)} />;
    }

    return <Dashboard />;
}
