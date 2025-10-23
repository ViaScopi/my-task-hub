import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function TrelloCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    // Get token from URL fragment (after #)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('token');

    // Get state from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get('state');

    console.log('[Trello Callback Page] Token from fragment:', !!token);
    console.log('[Trello Callback Page] State:', state);

    if (!token) {
      setStatus('error');
      setTimeout(() => {
        router.push('/settings?error=no_token');
      }, 2000);
      return;
    }

    // Send token to server-side endpoint
    fetch('/api/oauth/trello/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, state }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          console.log('[Trello Callback Page] Success:', data);
          setStatus('success');
          setTimeout(() => {
            router.push('/settings?success=trello_connected');
          }, 1000);
        } else {
          const error = await res.json();
          console.error('[Trello Callback Page] Error:', error);
          setStatus('error');
          setTimeout(() => {
            router.push(`/settings?error=${encodeURIComponent(error.message || 'Failed to connect')}`);
          }, 2000);
        }
      })
      .catch((error) => {
        console.error('[Trello Callback Page] Fetch error:', error);
        setStatus('error');
        setTimeout(() => {
          router.push(`/settings?error=${encodeURIComponent(error.message)}`);
        }, 2000);
      });
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {status === 'processing' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <h1>Connecting to Trello...</h1>
          <p>Please wait while we complete the authorization.</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
          <h1>Successfully Connected!</h1>
          <p>Redirecting to settings...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h1>Connection Failed</h1>
          <p>Redirecting back to settings...</p>
        </>
      )}
    </div>
  );
}
