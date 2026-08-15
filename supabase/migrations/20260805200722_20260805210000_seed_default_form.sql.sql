/*
# Seed default form fields for coach_forms
*/

INSERT INTO coach_forms (coach_id, form_name, version, fields, is_default)
SELECT '00000000-0000-0000-0000-000000000000', 'Exploration Form', 1,
'[
  {"section":"Personal","label":"Name","key":"name","type":"text","required":true},
  {"section":"Personal","label":"Gmail ID","key":"email","type":"text","required":true},
  {"section":"Personal","label":"WhatsApp number","key":"whatsapp","type":"text","required":false},
  {"section":"Personal","label":"Date of Birth","key":"dob","type":"date","required":false},
  {"section":"Personal","label":"Gender","key":"gender","type":"text","required":false},
  {"section":"Personal","label":"Profession","key":"profession","type":"dropdown","options":["Student","IT/Software","Marketing","Finance","Healthcare","Education","Business Owner","Homemaker","Consultant","Other"],"required":false},
  {"section":"Personal","label":"Marital Status","key":"marital_status","type":"dropdown","options":["Single","Married","Divorced","Widowed","Separated"],"required":false},
  {"section":"Personal","label":"Which animal do you associate with?","key":"spirit_animal","type":"image_select","options":["Lion","Elephant","Eagle","Wolf","Dolphin","Owl","Horse","Peacock"],"required":false},
  {"section":"Personal","label":"What do you yearn for?","key":"yearns","type":"multiselect_with_reason","options":["Help others","Respect all","Trust all","Express my feelings","Learn and grow","Be always happy","Be appreciated","Contribute to the world","Be valued for my work","Remembered by all"],"required":false},
  {"section":"Personal","label":"Purpose of life","key":"purpose","type":"purpose_select","options":["To love and be loved","To create something lasting","To help others grow","To find inner peace","To achieve excellence","To make the world better","To inspire others","To discover truth","To build meaningful connections","To leave a legacy"],"required":false},
  {"section":"Knowing you better","label":"Describe your goal","key":"goal_description","type":"text","required":false},
  {"section":"Knowing you better","label":"When to achieve?","key":"goal_timeline","type":"date","required":false},
  {"section":"Knowing you better","label":"Why are you best suited for this goal?","key":"goal_why_suited","type":"text","required":false},
  {"section":"Knowing you better","label":"For whom do you want to achieve this goal?","key":"goal_for_whom","type":"multiselect","options":["Self","Children","Spouse","Parents","Friends","Others"],"required":false},
  {"section":"Knowing you better","label":"What will happen if you do not achieve the goal?","key":"goal_if_not","type":"text","required":false},
  {"section":"Knowing you better","label":"Who is your idol on the path of achieving the goal?","key":"goal_idol","type":"text","required":false},
  {"section":"Knowing you better","label":"In the last 30 days, what steps did you take to achieve the goal?","key":"goal_steps_30days","type":"text","required":false},
  {"section":"Knowing you better","label":"Challenges in achieving the goal","key":"goal_challenges","type":"multiline","required":false},
  {"section":"Knowing you better","label":"When I face challenges I generally feel","key":"challenge_emotions","type":"multiselect_with_other","options":["Anxiety","Insecurity","Fear","Lust","Shame","Doubt","Grief","Hatred","Lonely","Sad","Controlled","Confused","Overthink","Others"],"required":false}
]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM coach_forms WHERE coach_id = '00000000-0000-0000-0000-000000000000');