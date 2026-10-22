UPDATE ritual
SET steps = 'what_moved,leftovers,habit_check,one_line_note'
WHERE kind = 'evening'
  AND steps = 'what_moved,leftovers,pick_musts,timeblock,one_line_note';
