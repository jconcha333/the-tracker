import React, { useState } from 'react';
import { theTracker } from './the-tracker';
import { v4 as uuidv4 } from 'uuid';

export default function AdminCodeGenerator() {
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const generateCode = async () => {
    setLoading(true);
    setMessage('');

    try {
      const code = uuidv4().slice(0, 8).toUpperCase();
      await theTracker.from('invites').insert([{ id: uuidv4(), code, is_used: false }]);
      setNewCode(code);
      setMessage('NEW CODE GENERATED');
    } catch (err) {
      setMessage('ERROR CREATING CODE');
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>INVITE USER</h1>
      <button onClick={generateCode} style={styles.button} disabled={loading}>
        {loading ? 'GENERATING...' : 'GENERATE CODE'}
      </button>
      {newCode && <div style={styles.codeDisplay}>{newCode}</div>}
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
  button: {
    padding: '12px 24px',
    backgroundColor: '#FFF',
    color: '#000',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '2px',
    marginBottom: '12px',
  },
  codeDisplay: { marginTop: '20px', fontSize: '16px', letterSpacing: '2px', color: '#0F0' },
  message: { marginTop: '12px', fontSize: '12px', letterSpacing: '2px', color: '#FF4D4D' },
};
