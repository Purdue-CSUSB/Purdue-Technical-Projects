import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import AuthCard, { Banner } from '../components/ui/AuthCard.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import PasswordField from '../components/ui/PasswordField.jsx';
import { ALLOWED_EMAIL_DOMAIN, MIN_PASSWORD_LENGTH } from '../config.js';

// Two steps in one page: create the account, then type the code that was emailed. They share a
// route because the second step is useless without the first and a visitor who reloads
// mid-flow should land somewhere that can still finish the job - which is why the code step is
// also reachable directly, via the pendingEmail passed by the login page when someone tries to
// sign in to an account that was never verified.

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, verifyEmail, resendCode } = useAuth();

  const pendingEmail = location.state?.pendingEmail ?? '';
  const [step, setStep] = useState(pendingEmail ? 'verify' : 'signup');
  const [form, setForm] = useState({ username: '', email: pendingEmail, password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(pendingEmail ? 'This account still needs verifying. Enter the code we emailed you.' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Checked here purely to save a round trip; the server enforces both independently.
    if (!form.email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setError(`You must sign up with a ${ALLOWED_EMAIL_DOMAIN} email address.`);
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(form.username, form.email, form.password);
      setStep('verify');
      setNotice(`We emailed a 6-digit code to ${form.email.trim()}. It expires in 15 minutes.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      // Verifying returns a session, so there is no second trip through the login form.
      await verifyEmail(form.email, code.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    try {
      const data = await resendCode(form.email);
      setNotice(data.message || 'A new code has been sent.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (step === 'verify') {
    return (
      <AuthCard title="Check Your Email" subtitle="Enter the 6-digit code to finish setting up your account.">
        <Banner tone="error">{error}</Banner>
        <Banner tone="success">{notice}</Banner>

        <form onSubmit={handleVerify} noValidate className="space-y-4">
          <Field
            id="verify-email"
            name="email"
            type="email"
            label="Purdue Email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="you@purdue.edu"
          />
          <Field
            id="verify-code"
            label="Verification Code"
            required
            // inputMode numeric brings up the number pad on a phone; maxLength stops a paste
            // with stray characters from silently failing server-side.
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            placeholder="123456"
          />

          <Button type="submit" fullWidth disabled={isSubmitting || code.trim().length === 0}>
            {isSubmitting ? 'Verifying...' : 'Verify and Continue'}
          </Button>
        </form>

        <p className="mt-6 font-body text-sm text-usb-muted text-center">
          Didn't get it?{' '}
          <button type="button" onClick={handleResend} className="font-semibold text-usb-charcoal underline hover:text-black cursor-pointer">
            Send a new code
          </button>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Sign Up" subtitle={`Create an account with your ${ALLOWED_EMAIL_DOMAIN} email to post projects.`}>
      <Banner tone="error">{error}</Banner>

      <form onSubmit={handleSignup} noValidate className="space-y-4">
        <Field
          id="signup-username"
          name="username"
          label="Name"
          required
          autoComplete="name"
          value={form.username}
          onChange={handleChange}
          placeholder="Pete Purdue"
          maxLength={80}
        />
        <Field
          id="signup-email"
          name="email"
          type="email"
          label="Purdue Email"
          required
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@purdue.edu"
        />
        <PasswordField
          id="signup-password"
          name="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          hint={`(at least ${MIN_PASSWORD_LENGTH} characters)`}
        />

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 font-body text-sm text-usb-muted text-center">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-usb-charcoal underline hover:text-black">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
