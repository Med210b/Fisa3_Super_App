import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, Lock, Smartphone, Chrome, ArrowRight, 
  ChevronLeft, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { BRAND, SUPER_ADMIN_EMAILS, RIDER_EMAILS, MERCHANT_EMAILS } from '../constants';

type AuthMode = 'login' | 'signup' | 'phone' | 'reset';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const { user, isAdmin, isRider, isMerchant } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      if (isAdmin) {
        navigate('/admin');
      } else if (isRider) {
        navigate('/rider');
      } else if (isMerchant) {
        navigate('/merchant');
      } else {
        navigate('/');
      }
    }
  }, [user, isAdmin, isRider, isMerchant, loading, navigate]);

  // Initialize Recaptcha for Phone Auth
  useEffect(() => {
    if (mode === 'phone') {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': () => {
            // reCAPTCHA solved, allow signInWithPhoneNumber.
          }
        });
      }
      if (phone === '') {
        setPhone('+216 ');
      }
    }
  }, [mode, phone]);

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    console.log('Starting email auth...', mode);
    setLoading(true);
    setError(null);

    // Create a timeout to prevent infinite hangs
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Connection timed out. Please check your internet or Firebase configuration.');
      }
    }, 15000);

    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (cleanPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      clearTimeout(timeoutId);
      return;
    }

    try {
      if (mode === 'login') {
        console.log('Signing in with', cleanEmail);
        await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      } else {
        console.log('Creating account with', cleanEmail);
        await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      }
      clearTimeout(timeoutId);
      console.log('Auth successful, redirecting based on role...');
      
      const userEmail = cleanEmail.toLowerCase();
      if (SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/admin');
      } else if (RIDER_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/rider');
      } else if (MERCHANT_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/merchant');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Auth error detail:', err.code, err.message);
      
      // provide more user-friendly error messages
      let friendlyError = 'Authentication failed. Please try again.';
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';

      if (errorCode === 'auth/invalid-api-key' || errorMessage.includes('invalid-api-key')) {
        friendlyError = 'Firebase API Key is missing or invalid. Please check your configuration.';
      } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
        friendlyError = 'Network error. Please check your connection.';
      } else if (
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' ||
        errorMessage.includes('auth/invalid-credential') ||
        errorMessage.includes('invalid-credential')
      ) {
        friendlyError = mode === 'login' 
          ? 'Identifiants invalides. Si vous n\'avez pas encore de compte, passez en mode "Création de compte".' 
          : 'Données d\'inscription non valides ou compte déjà existant avec un autre fournisseur.';
      } else if (errorCode === 'auth/email-already-in-use') {
        friendlyError = 'Cet email est déjà utilisé. Essayez de vous connecter.';
      } else if (errorCode === 'auth/too-many-requests') {
        friendlyError = 'Compte temporairement bloqué suite à de trop nombreuses tentatives. Essayez plus tard.';
      } else if (errorCode === 'auth/operation-not-allowed') {
        friendlyError = 'Cette méthode de connexion n\'est pas activée dans votre console Firebase.';
      } else {
        friendlyError = errorMessage.replace('Firebase: ', '') || friendlyError;
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log('Starting Google auth...');
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    
    // Create a timeout
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Google login timed out. Please check if popups are blocked.');
      }
    }, 20000);

    try {
      const result = await signInWithPopup(auth, provider);
      clearTimeout(timeoutId);
      console.log('Google auth successful');
      
      const userEmail = (result.user.email || '').toLowerCase();
      if (SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/admin');
      } else if (RIDER_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/rider');
      } else if (MERCHANT_EMAILS.some(e => e.toLowerCase() === userEmail)) {
        navigate('/merchant');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Google auth error:', err);
      let friendlyError = err.message || 'Google login failed';
      if (err.code === 'auth/popup-blocked') {
        friendlyError = 'The login popup was blocked by your browser. Please allow popups for this site.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        friendlyError = 'The login window was closed before completion.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        friendlyError = 'Login attempt cancelled.';
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
      setVerificationId(confirmation);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Always keep +216 if it's there, or add it if empty
    if (!value.startsWith('+216')) {
      if (value === '') {
        setPhone('+216 ');
        return;
      }
      // If they somehow typed something else, force it or ignore
      if (!value.includes('+216')) {
        value = '+216 ' + value.replace(/\D/g, '');
      }
    }

    // Extract only digits after +216
    const digits = value.slice(4).replace(/\D/g, '');
    
    // Format: +216 XX XXX XXX
    let formatted = '+216 ';
    if (digits.length > 0) {
      formatted += digits.substring(0, 2);
    }
    if (digits.length > 2) {
      formatted += ' ' + digits.substring(2, 5);
    }
    if (digits.length > 5) {
      formatted += ' ' + digits.substring(5, 8);
    }

    // Limit to max length (+216 XX XXX XXX)
    setPhone(formatted);
  };

  const handleOtpVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (verificationId) {
        await verificationId.confirm(otp);
        navigate('/');
      }
    } catch (err: any) {
      setError('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-4">
      <div id="recaptcha-container"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100 overflow-hidden relative"
      >
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand/5 rounded-full -ml-16 -mb-16 blur-2xl" />

        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200/50 mx-auto mb-6">
              <img src={BRAND.logo} alt="FISA3" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">
              {mode === 'login' ? 'Welcome Back!' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Reset Password' : 'Phone Login'}
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">
              {mode === 'login' ? 'Great to see you again!' : 
               mode === 'signup' ? 'Join the FISA3 community today.' : 
               mode === 'reset' ? 'Enter your email to receive a reset link.' : 
               'Fast and secure login via SMS.'}
            </p>
          </div>

          {/* Social Auth */}
          {(!otpSent && mode !== 'reset') && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button 
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 bg-white border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-600 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Chrome size={18} className="text-red-500" />
                  <span className="text-xs uppercase tracking-wider">Google</span>
                </button>
                <button 
                  onClick={() => setMode('phone')}
                  className="flex items-center justify-center gap-3 bg-white border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-600 active:scale-95 shadow-sm"
                >
                  <Smartphone size={18} className="text-brand" />
                  <span className="text-xs uppercase tracking-wider">Phone</span>
                </button>
              </div>

              {/* Quick access buttons removed */}
            </>
          )}

          {(!otpSent && (mode === 'login' || mode === 'signup')) && (
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-black tracking-widest">Or continue with</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {auth.app.options.apiKey === 'MOCK_KEY' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col gap-2 text-amber-700 text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>Firebase Not Configured</span>
                </div>
                <p className="font-medium opacity-80 leading-relaxed">
                  The application is running with a mock configuration. Authentication will not work until you successfully complete the Firebase setup.
                </p>
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-semibold"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-xs font-semibold"
              >
                <CheckCircle2 size={16} />
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms */}
          {(mode === 'login' || mode === 'signup') ? (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all font-medium text-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div className="text-right">
                  <button 
                    type="button" 
                    onClick={() => setMode('reset')}
                    className="text-[10px] font-black text-brand uppercase tracking-widest hover:opacity-80"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-6 bg-slate-900 text-white rounded-2xl py-4 font-bold shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <span>{mode === 'login' ? 'Access Account' : 'Join Now'}</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : mode === 'reset' ? (
            /* Forgot Password Form */
            <div className="space-y-6">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all font-medium text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
                </button>
              </form>
              <button 
                onClick={() => setMode('login')}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
              >
                <ChevronLeft size={14} />
                Back to Login
              </button>
            </div>
          ) : (
            /* Phone Auth Form */
            <div className="space-y-6">
              <form onSubmit={otpSent ? handleOtpVerify : handlePhoneSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="tel" 
                      required
                      disabled={otpSent}
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="+216 20 000 000"
                      className={cn(
                        "w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all font-medium text-sm",
                        otpSent && "opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </div>

                {otpSent ? (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verification Code</label>
                      <input 
                        type="text" 
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="- - - - - -"
                        className={cn(
                          "w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all font-sans",
                          error === 'Invalid verification code' && "border-red-200 bg-red-50 focus:ring-red-100"
                        )}
                      />
                      {error === 'Invalid verification code' && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-bold text-red-500 mt-2 ml-1 uppercase tracking-wider flex items-center gap-1"
                        >
                          <AlertCircle size={12} />
                          Invalid code. Please try again.
                        </motion.p>
                      )}
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand text-white rounded-2xl py-4 font-bold shadow-xl shadow-brand/10 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                          <CheckCircle2 size={18} />
                          Verify & Login
                        </>
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setOtpSent(false);
                        setError(null);
                      }} 
                      className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                    >
                      Change Number / Resend
                    </button>
                  </motion.div>
                ) : (
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                )}
              </form>
              
              <button 
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setOtpSent(false);
                }}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
              >
                <ChevronLeft size={14} />
                Back to Email Login
              </button>
            </div>
          )}

          {/* Toggle mode */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-10 text-center">
              <p className="text-slate-500 text-sm font-medium">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              </p>
              <button 
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="mt-2 text-brand font-bold text-sm underline underline-offset-4 decoration-2 decoration-brand/20 hover:decoration-brand transition-all"
              >
                {mode === 'login' ? 'Create a new account' : 'Sign in to existing one'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
