import React, { useState } from 'react';
import { theTracker } from './the-tracker';

export default function InviteSignup() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await theTracker
        .from('invites')
        .select('*')
        .eq('code', code)
        .single();

      if (error || !data) {
        setMessage('INVALID CODE');
      } else if (data.is_used) {
        setMessage('CODE ALREADY USED');
      } else {
        await theTracker
          .from('invites')
          .update({ is_used: true, used_by_email: email })
          .eq('id', data.id);
        setMessage('SUCCESS! INVITE ACCEPTED');
      }
    } catch (err) {
      setMessage('ERROR PROCESSING INVITE');
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>ENTER INVITE CODE</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={styles.input}
          autoComplete="off"
          required
        />
        <input
          placeholder="EMAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          type="email"
          required
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'PROCESSING...' : 'SUBMIT'}
        </button>
      </form>
      {message && <div style={styles.message}>{message}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0D0D0D',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#FFF',
    fontFamily: '-apple-system, sans-serif',
    textTransform: 'uppercase',
    fontWeight: 300,
    padding: '20px',
  },
  title: { fontSize: '20px', marginBottom: '20px', letterSpacing: '2px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' },
  input: {
    padding: '12px 10px',
    backgroundColor: '#0D0D0D',
    border: '1px solid #444',
    color: '#FFF',
    fontSize: '14px',
    textTransform: 'uppercase',
    outline: 'none',
  },
  button: {
    padding: '12px',
    backgroundColor: '#FFF',
    color: '#000',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '2px',
  },
  message: { marginTop: '20px', fontSize: '12px', letterSpacing: '2px', color: '#FF4D4D' },
};
