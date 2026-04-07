import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/auth'

function isGmailAddress(email: string): boolean {
  return /^[^\s@]+@gmail\.com$/i.test(email.trim())
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [error, setError] = useState('')
  const [otpNotice, setOtpNotice] = useState('')
  const [otpSentForMode, setOtpSentForMode] = useState<'login' | 'signup' | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')

  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')

  const handleSendOtp = async () => {
    setError('')
    setOtpNotice('')

    if (!isGmailAddress(email)) {
      setError('Enter a valid Gmail address first')
      return
    }

    setIsSendingOtp(true)
    const result = await authService.requestEmailOtp(email.trim(), mode)
    setIsSendingOtp(false)

    if (!result.success) {
      setError(result.error || 'Unable to send OTP')
      return
    }

    setOtpSentForMode(mode)
    const fallbackMessage = result.sentViaFallback
      ? ' SMTP is not configured, using local fallback.'
      : ''
    const debugMessage = result.debugOtp ? ` Debug OTP: ${result.debugOtp}` : ''
    setOtpNotice(`OTP sent to ${email.trim()}.${fallbackMessage}${debugMessage}`)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (!isGmailAddress(email)) {
        setError('Only Gmail addresses are allowed')
        return
      }

      if (!otpCode.trim()) {
        setError('OTP is required')
        return
      }

      if (otpSentForMode !== mode) {
        setError('Please request OTP for this mode before submitting')
        return
      }

      if (mode === 'login') {
        const result = await authService.login(email.trim(), password, otpCode.trim())
        if (!result.success) {
          setError(result.error || 'Login failed')
          return
        }

        navigate('/dashboard', { replace: true })
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      const result = await authService.signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        otpCode: otpCode.trim(),
        confirmPassword,
        gender,
        dateOfBirth,
        phone,
      })

      if (!result.success) {
        setError(result.error || 'Signup failed')
        return
      }

      navigate('/dashboard', { replace: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-700 mb-2">Chaudhary</h1>
            <p className="text-gray-600">Community Platform</p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setOtpNotice('')
                setOtpSentForMode(null)
                setOtpCode('')
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError('')
                setOtpNotice('')
                setOtpSentForMode(null)
                setOtpCode('')
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              Signup
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your full name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setOtpSentForMode(null)
                    setOtpCode('')
                    setOtpNotice('')
                  }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="you@gmail.com"
              />
              <p className="mt-1 text-xs text-gray-500">Only Gmail addresses are allowed.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="6-digit OTP"
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp}
                className="h-fit self-end px-4 py-2 rounded-lg border border-primary-600 text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-60"
              >
                {isSendingOtp ? 'Sending...' : 'Send OTP'}
              </button>
            </div>

            {otpNotice && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {otpNotice}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="+91 98xxxxxx"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !otpSentForMode}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-gray-600 text-sm mt-6">
            {mode === 'login'
              ? 'Use an existing account or switch to Signup to create one.'
              : 'Signup creates a new user and logs in automatically.'}
          </p>
        </div>
      </div>
    </div>
  )
}
