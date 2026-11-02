import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./Auth.css";

function Auth({ isPasswordRecovery = false, onRecoveryComplete }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(isPasswordRecovery);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Keep Auth.jsx in sync with Supabase's recovery event. This is important
  // because opening a password-reset link creates a temporary authenticated
  // session, but it is NOT a normal login.
  useEffect(() => {
    if (isPasswordRecovery) {
      setIsResetPassword(true);
      setIsForgotPassword(false);
      setIsLogin(true);
      setError("");
      setMessage("");
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResetPassword(true);
        setIsForgotPassword(false);
        setIsLogin(true);
        setError("");
        setMessage("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const goToLogin = async () => {
    // A recovery link creates an authenticated session. If the user chooses
    // to leave the recovery flow, sign that temporary session out so the app
    // cannot silently log them in.
    if (isResetPassword || isPasswordRecovery) {
      await supabase.auth.signOut();
      onRecoveryComplete?.();
    }

    setIsLogin(true);
    setIsForgotPassword(false);
    setIsResetPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    clearMessages();

    // Remove recovery tokens/code from the browser URL.
    if (window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

 const handleSubmit = async (event) => {
  event.preventDefault();
  clearMessages();

  if (isResetPassword) {
    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      setMessage(
        "Password updated successfully. Please sign in with your new password."
      );

      setNewPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();

      if (window.history?.replaceState) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      onRecoveryComplete?.();
      setIsResetPassword(false);
      setIsForgotPassword(false);
      setIsLogin(true);

      setTimeout(() => {
        setMessage(
          "Password updated successfully. Please sign in with your new password."
        );
      }, 0);
    } catch (authError) {
      console.error("AURA password update error:", authError);

      setError(
        authError.message ||
          "Unable to update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }

    return;
  }

  if (isForgotPassword) {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: redirectUrl,
          }
        );

      if (resetError) {
        throw resetError;
      }

      setMessage(
        "Password reset email sent. Check your inbox and follow the link to create a new password."
      );
    } catch (authError) {
      console.error("AURA password reset error:", authError);

      setError(
        authError.message ||
          "Unable to send the password reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }

    return;
  }

  if (!email.trim() || !password.trim()) {
    setError("Please enter your email and password.");
    return;
  }

  if (!isLogin && !fullName.trim()) {
    setError("Please enter your name.");
    return;
  }

  setLoading(true);

  try {
    if (isLogin) {
      // ==========================================
      // 1. LOGIN WITH SUPABASE
      // ==========================================
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      // ==========================================
      // 2. SEND LOGIN NOTIFICATION
      // ==========================================
      if (data?.session?.access_token) {
        try {
          await fetch(
            "http://localhost:5000/api/email/login-notification",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${data.session.access_token}`,
              },
            }
          );

          console.log("AURA login notification request sent.");
        } catch (notificationError) {
          // Don't prevent the user from logging in
          // if the notification email fails.
          console.error(
            "AURA login notification failed:",
            notificationError
          );
        }
      }
    } else {
      // ==========================================
      // 3. CREATE ACCOUNT
      // ==========================================
      const { data, error: signupError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        setMessage("Account created successfully.");
      } else {
        setMessage(
          "Account created successfully. Please check your email if confirmation is required."
        );
      }
    }
  } catch (authError) {
    console.error("AURA authentication error:", authError);

    setError(
      authError.message ||
        "Authentication failed. Please try again."
    );
  } finally {
    setLoading(false);
  }
};

  const title = isResetPassword
    ? "Create a new password"
    : isForgotPassword
      ? "Reset your password"
      : isLogin
        ? "Welcome back"
        : "Create your account";

  const subtitle = isResetPassword
    ? "Choose a new password for your AURA account."
    : isForgotPassword
      ? "Enter your email and we'll send you a password reset link."
      : isLogin
        ? "Sign in to continue your research."
        : "Create an account to save your research in the cloud.";

  return (
    <div className="auth-page">
      <div className="auth-background-glow auth-glow-one" />
      <div className="auth-background-glow auth-glow-two" />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">✦</div>

          <div>
            <h1>AURA</h1>
            <span>AI Research Engine</span>
          </div>
        </div>

        <div className="auth-heading">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isResetPassword ? (
            <>
              <div className="auth-field">
                <label htmlFor="newPassword">New password</label>

                <input
                  id="newPassword"
                  type="password"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirmPassword">
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : (
            <>
              {!isLogin && !isForgotPassword && (
                <div className="auth-field">
                  <label htmlFor="fullName">Full name</label>

                  <input
                    id="fullName"
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="email">Email</label>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                />
              </div>

              {!isForgotPassword && (
                <div className="auth-field">
                  <label htmlFor="password">Password</label>

                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete={
                      isLogin
                        ? "current-password"
                        : "new-password"
                    }
                  />
                </div>
              )}

              {isLogin && (
                <div className="auth-forgot-row">
                  <button
                    type="button"
                    className="auth-forgot-button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setIsResetPassword(false);
                      clearMessages();
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="auth-message auth-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-message auth-success">
              {message}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isResetPassword
                ? "Update password"
                : isForgotPassword
                  ? "Send reset link"
                  : isLogin
                    ? "Sign in"
                    : "Create account"}
          </button>
        </form>

        {isResetPassword ? (
          <div className="auth-switch">
            <button type="button" onClick={goToLogin}>
              ← Back to sign in
            </button>
          </div>
        ) : isForgotPassword ? (
          <div className="auth-switch">
            <span>Remember your password?</span>

            <button type="button" onClick={goToLogin}>
              Sign in
            </button>
          </div>
        ) : (
          <div className="auth-switch">
            <span>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setIsForgotPassword(false);
                setIsResetPassword(false);
                clearMessages();
              }}
            >
              {isLogin ? "Create account" : "Sign in"}
            </button>
          </div>
        )}

        <div className="auth-footer">
          <span>✦</span>
          Secure research workspace
        </div>
      </div>
    </div>
  );
}

export default Auth;
