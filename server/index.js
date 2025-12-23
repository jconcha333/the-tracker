import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  'https://vxmvmupfvvwsrzvfodps.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/generate-invite', async (req, res) => {
  const { email } = req.body;
  if (email !== 'concha3jose@icloud.com') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data, error } = await supabase
    .from('invites')
    .insert([{ code }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ code: data[0].code });
});

app.listen(4000, () => console.log('Server running on http://localhost:4000'));
