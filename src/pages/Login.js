import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth';
function isGmailAddress(email) {
    return /^[^\s@]+@gmail\.com$/i.test(email.trim());
}
export default function Login() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [phone, setPhone] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            if (!isGmailAddress(email)) {
                setError('Only Gmail addresses are allowed');
                return;
            }
            if (mode === 'login') {
                const result = await authService.login(email.trim(), password);
                if (!result.success) {
                    setError(result.error || 'Login failed');
                    return;
                }
                navigate('/dashboard', { replace: true });
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            const result = await authService.signup({
                fullName: fullName.trim(),
                email: email.trim(),
                password,
                confirmPassword,
                gender,
                dateOfBirth,
                phone,
            });
            if (!result.success) {
                setError(result.error || 'Signup failed');
                return;
            }
            navigate('/dashboard', { replace: true });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4", children: _jsx("div", { className: "w-full max-w-md", children: _jsxs("div", { className: "bg-white rounded-xl shadow-xl p-8", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-primary-700 mb-2", children: "Chaudhary" }), _jsx("p", { className: "text-gray-600", children: "Community Platform" })] }), _jsxs("div", { className: "mb-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1", children: [_jsx("button", { type: "button", onClick: () => {
                                    setMode('login');
                                    setError('');
                                }, className: `rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'}`, children: "Login" }), _jsx("button", { type: "button", onClick: () => {
                                    setMode('signup');
                                    setError('');
                                }, className: `rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'}`, children: "Signup" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [mode === 'signup' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Full Name" }), _jsx("input", { type: "text", required: true, value: fullName, onChange: (e) => setFullName(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", placeholder: "Your full name" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email Address" }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", placeholder: "you@gmail.com" }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Only Gmail addresses are allowed." })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), mode === 'signup' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Confirm Password" }), _jsx("input", { type: "password", required: true, value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Gender" }), _jsxs("select", { value: gender, onChange: (e) => setGender(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select" }), _jsx("option", { value: "male", children: "Male" }), _jsx("option", { value: "female", children: "Female" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Date of Birth" }), _jsx("input", { type: "date", value: dateOfBirth, onChange: (e) => setDateOfBirth(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Phone (optional)" }), _jsx("input", { type: "tel", value: phone, onChange: (e) => setPhone(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent", placeholder: "+91 98xxxxxx" })] })] })), error && (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600", children: error })), _jsx("button", { type: "submit", disabled: isSubmitting, className: "w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 rounded-lg transition-colors", children: isSubmitting
                                    ? 'Please wait...'
                                    : mode === 'login'
                                        ? 'Sign In'
                                        : 'Create Account' })] }), _jsx("p", { className: "text-center text-gray-600 text-sm mt-6", children: mode === 'login'
                            ? 'Use an existing account or switch to Signup to create one.'
                            : 'Signup creates a new user and logs in automatically.' })] }) }) }));
}
