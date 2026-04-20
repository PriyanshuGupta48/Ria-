import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const GoogleAuthGateway = ({ onCredential, actionLabel = 'continue', helperText = '' }) => {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    let cancelled = false;
    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    const initialize = async () => {
      if (!googleClientId) {
        setErrorMessage('Google sign-in is not configured yet.');
        return;
      }

      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: false,
          callback: async (response) => {
            if (!response?.credential || isSubmittingRef.current) {
              return;
            }

            setIsSubmitting(true);
            const success = await onCredentialRef.current(response.credential);
            setIsSubmitting(false);

            if (!success && !cancelled) {
              window.google.accounts.id.prompt();
            }
          },
        });

        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            shape: 'pill',
            theme: 'outline',
            text: 'continue_with',
            size: 'large',
            width: 320,
          });
        }

        window.google.accounts.id.prompt();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage('Unable to load Google sign-in. Please try again.');
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, []);

  const openPrompt = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className="mt-7 space-y-4">
      <p className="text-sm text-slate-600">
        {helperText || `Continue with Google to ${actionLabel}.`}
      </p>
      <div className="flex items-center justify-center">
        <div ref={buttonRef} />
      </div>
      <button type="button" onClick={openPrompt} className="btn-secondary w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Please wait...' : 'Open Google sign-in'}
      </button>
      {errorMessage && (
        <p className="text-sm text-rose-600 text-center">{errorMessage}</p>
      )}
    </div>
  );
};

export default GoogleAuthGateway;
