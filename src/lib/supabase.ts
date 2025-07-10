import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://agoczgbxqqjhfyybpywj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnb2N6Z2J4cXFqaGZ5eWJweXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNjc0MDcsImV4cCI6MjA2Njc0MzQwN30.toFo4FdEeD407GzmW1tOHmhTVR-bTYVQxvoLbCh3Qf8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);