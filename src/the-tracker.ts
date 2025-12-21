import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxmvmupfvvwsrzvfodps.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4bXZtdXBmdnZ3c3J6dmZvZHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTA5MzMsImV4cCI6MjA4MTY2NjkzM30.sfgVSaIPRPdI0WHvSbrS1wiSxxUV0znS-sOM4etclso';

export const theTracker = createClient(supabaseUrl, supabaseAnonKey);