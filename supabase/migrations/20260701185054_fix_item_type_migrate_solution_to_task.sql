-- Update existing 'solution' rows to 'task' before changing constraint
UPDATE parked_items SET item_type = 'task' WHERE item_type = 'solution';

ALTER TABLE parked_items DROP CONSTRAINT IF EXISTS parked_items_item_type_check;
ALTER TABLE parked_items ADD CONSTRAINT parked_items_item_type_check
  CHECK (item_type IN ('challenge', 'task', 'gratitude'));
