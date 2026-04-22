import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Matrimony from './pages/Matrimony';
import Events from './pages/Events';
import HelpCenter from './pages/HelpCenter';
import Business from './pages/Business';
import CommunityFeed from './pages/CommunityFeed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import authService from './services/auth';
function ProtectedRoute({ children }) {
    if (!authService.isAuthenticated()) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return children;
}
function PublicRoute({ children }) {
    if (authService.isAuthenticated()) {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    return children;
}
function App() {
    return (_jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicRoute, { children: _jsx(Login, {}) }) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(Layout, {}) }), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/matrimony", element: _jsx(Matrimony, {}) }), _jsx(Route, { path: "/events", element: _jsx(Events, {}) }), _jsx(Route, { path: "/help-and-need", element: _jsx(HelpCenter, {}) }), _jsx(Route, { path: "/help-center", element: _jsx(Navigate, { to: "/help-and-need", replace: true }) }), _jsx(Route, { path: "/business", element: _jsx(Business, {}) }), _jsx(Route, { path: "/community", element: _jsx(CommunityFeed, {}) }), _jsx(Route, { path: "/profile", element: _jsx(Profile, {}) }), _jsx(Route, { path: "/notifications", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) })] }) }));
}
export default App;
