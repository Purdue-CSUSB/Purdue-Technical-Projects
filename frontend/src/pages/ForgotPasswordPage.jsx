import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import AuthCard, { Banner } from '../components/ui/AuthCard.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import PasswordField from '../components/ui/PasswordField.jsx';
import { MIN_PASSWORD_LENGTH } from '../config.js';

// Request a code, then use it to set a new password. Two steps, one route: the second half is
// meaningless without the first, and the email is carried between them rather than retyped.
//
// Laid out to match the Research Resources page exactly.
export default function ForgotPasswordPage() {
  const { requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState('request');
  // Prefilled when arriving from a failed login, so the address doesn't have to be typed twice.
  // Not auto-submitted: landing on a page should never send mail on the user's behalf.
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  // Only ever set by Resend. Moving to the reset step is not itself worth a green banner - the
  // heading already says a code was sent, and the server's reply is deliberately vague about
  // whether the account exists, so echoing it here would say nothing useful.
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      // resetPassword signs them in, so send them to the board rather than back to an empty
      // login form to type the password they just chose.
      await resetPassword(email, code, newPassword);
      navigate('/projects');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await requestPasswordReset(email);
      setInfo('A new code has been sent.');
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  if (step === 'request') {
    return (
      <AuthCard title="Forgot Password" subtitle="Enter your Purdue email and we'll send you a reset code.">
        <Banner tone="error">{error}</Banner>

        <form onSubmit={handleRequest} className="space-y-5">
          <Field
            id="reset-email"
            label="Purdue Email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pete@purdue.edu"
          />
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Reset Code'}
          </Button>
        </form>

        <p className="font-body text-sm text-usb-muted mt-6 text-center">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-usb-charcoal underline">
            Log in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Password"
      subtitle={<>Enter the code sent to <span className="font-semibold text-usb-charcoal">{email}</span> and a new password.</>}
    >
      <Banner tone="error">{error}</Banner>
      <Banner tone="success">{info}</Banner>

      <form onSubmit={handleReset} className="space-y-5">
        <Field
          id="reset-code"
          label="Reset Code"
          required
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          controlClassName="text-center tracking-[0.5em]"
          placeholder="------"
        />
        <PasswordField
          id="reset-password"
          label="New Password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>

      <button
        onClick={handleResend}
        className="font-body text-sm text-usb-muted hover:text-usb-charcoal mt-6 w-full text-center transition-colors cursor-pointer"
      >
        Didn't get a code? Resend
      </button>
    </AuthCard>
  );
}
