-- Add milestone_tags array to goals (replaces milestone_labels array concept for tag-based filtering)
-- Keep milestone_labels for backward compat display, add milestone_tags as the new tag system
ALTER TABLE goals ADD COLUMN IF NOT EXISTS milestone_tags text[] DEFAULT ARRAY['General'];

-- Add milestone_tag column to parked_items to store which milestone tag a thought belongs to
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS milestone_tag text DEFAULT 'General';

-- Back-fill existing parked_items: map milestone_index to milestone_tag using default labels
UPDATE parked_items SET milestone_tag = CASE milestone_index
  WHEN 0 THEN 'Getting Committed'
  WHEN 1 THEN 'Building Roadmap'
  WHEN 2 THEN 'Start Journey'
  WHEN 3 THEN 'Final Stretch'
  WHEN 4 THEN 'Finish Line'
  ELSE 'General'
END
WHERE milestone_tag = 'General' AND milestone_index IS NOT NULL;

-- Back-fill goals: build milestone_tags from milestone_labels
UPDATE goals SET milestone_tags = ARRAY(
  SELECT unnest(
    ARRAY[
      COALESCE(milestone_labels[1], 'Getting Committed'),
      COALESCE(milestone_labels[2], 'Building Roadmap'),
      COALESCE(milestone_labels[3], 'Start Journey'),
      COALESCE(milestone_labels[4], 'Final Stretch'),
      COALESCE(milestone_labels[5], 'Finish Line')
    ]
  )
)
WHERE is_general = false AND (milestone_tags IS NULL OR milestone_tags = ARRAY['General']::text[]);
