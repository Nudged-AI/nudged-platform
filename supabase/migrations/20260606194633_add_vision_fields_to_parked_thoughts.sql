ALTER TABLE parked_thoughts
  ADD COLUMN IF NOT EXISTS vision_id uuid REFERENCES visions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roadmap_step_id uuid REFERENCES vision_roadmap(id) ON DELETE SET NULL;
