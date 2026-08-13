import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import AuthCard, { Banner } from '../components/ui/AuthCard.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import PasswordField from '../components/ui/PasswordField.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where to go after signing in. Pages that bounce a signed-out visitor here pass the page
  // they wanted in location.state, so logging in returns them to it rather than dumping
  // everyone on the home page.
  const destination = location.state?.from ?? '/projects';

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await login(form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      // An unverified account is the one failure with a next step, so it gets a route rather
      // than just a message.
      if (/verify your email/i.test(err.message)) {
        navigate('/signup', { state: { pendingEmail: form.email.trim() } });
        return;
      }
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // A reset link belongs beside a wrong-password error, but NOT beside the unverified-account
  // one: resetting requires a verified email, so that person would request a code and never
  // receive it. They need the verification mail instead, which is why that case routes to the
  // signup page's code step rather than landing here.
  const isVerificationError = /verify your email/i.test(error);

  return (
    <AuthCard title="Log In" subtitle="Sign in with your Purdue account.">
      {error && (
        <Banner tone="error">
          {error}
          {!isVerificationError && (
            <>
              {' '}
              {/* The typed address is carried across so the reset page opens ready to send,
                  rather than making somebody who just mistyped a password retype their email. */}
              <Link
                to="/forgot-password"
                state={{ email: form.email }}
                className="font-semibold underline underline-offset-2 hover:text-red-900"
              >
                Forgot your password?
              </Link>
            </>
          )}
        </Banner>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Field
          id="login-email"
          name="email"
          type="email"
          label="Purdue Email"
          required
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          placeholder="pete@purdue.edu"
        />

        <PasswordField
          id="login-password"
          name="password"
          label="Password"
          required
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          labelRight={
            <Link to="/forgot-password" className="font-body text-xs font-semibold text-usb-charcoal hover:text-black underline">
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </Button>
      </form>

      <p className="font-body text-sm text-usb-muted mt-6 text-center">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-usb-charcoal underline">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
