-- Add INSERT trigger for final_matches to ensure updated_at is set on creation
-- This ensures real-time subscriptions work properly when new final match records are created

CREATE TRIGGER update_final_matches_updated_at_insert 
    BEFORE INSERT ON final_matches
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();