-- Demo data for a hotel. Runs after 01_schema.sql on a fresh database.
-- Password hashes are fake placeholders: these users cannot log in.
--
-- Timeline (Eastern time, -04:00):
--   Shift 1  Evening  Oct 27 15:00-23:00  ended, handed off to shift 2
--   Shift 2  Morning  Oct 28 07:00-15:00  ended
--   Shift 3  Evening  Oct 28 15:00-       current

BEGIN;

INSERT INTO users (id, name, email, password_hash, role, department, created_at) VALUES
  (1, 'Maria Lopez',  'maria.lopez@example.com',  'fake_hash_demo_only', 'supervisor', 'Front Desk',   '2026-10-01 09:00-04'),
  (2, 'James Carter', 'james.carter@example.com', 'fake_hash_demo_only', 'employee',   'Front Desk',   '2026-10-01 09:05-04'),
  (3, 'Priya Shah',   'priya.shah@example.com',   'fake_hash_demo_only', 'employee',   'Housekeeping', '2026-10-01 09:10-04'),
  (4, 'Marcus Reed',  'marcus.reed@example.com',  'fake_hash_demo_only', 'employee',   'Maintenance',  '2026-10-01 09:15-04');

INSERT INTO shifts (id, name, started_at, ended_at, started_by) VALUES
  (1, 'Evening', '2026-10-27 15:00-04', '2026-10-27 23:00-04', 2),
  (2, 'Morning', '2026-10-28 07:00-04', '2026-10-28 15:00-04', 1),
  (3, 'Evening', '2026-10-28 15:00-04', NULL,                  2);

INSERT INTO tasks (id, title, description, priority, status, assigned_user_id, assigned_department,
                   created_by, created_in_shift, created_at, updated_at, completed_at) VALUES
  (1, 'Room 312 AC broken',
      'Guest reports AC blowing warm air. Guest moved to Room 318 for the night.',
      'high', 'in_progress', 4, 'Maintenance', 2, 1,
      '2026-10-27 18:20-04', '2026-10-28 09:30-04', NULL),
  (2, 'Restock towels on 4th floor',
      'Linen closet on 4 is empty. Bring up 40 bath towels and 40 hand towels.',
      'medium', 'completed', 3, 'Housekeeping', 1, 1,
      '2026-10-27 16:00-04', '2026-10-27 17:15-04', '2026-10-27 17:15-04'),
  (3, 'Approve late checkout for Room 205',
      'Guest requested checkout at 2 PM instead of 11 AM. Needs approval and an update in the booking system.',
      'low', 'completed', NULL, 'Front Desk', 2, 1,
      '2026-10-27 20:10-04', '2026-10-28 08:15-04', '2026-10-28 08:15-04'),
  (4, 'Lobby elevator making grinding noise',
      'Grinding sound between floors 1 and 2. Still running. Call the elevator service company if it gets worse.',
      'high', 'open', 4, 'Maintenance', 2, 1,
      '2026-10-27 22:15-04', '2026-10-28 07:30-04', NULL),
  (5, 'Pool area light flickering',
      'Light above the hot tub flickers on and off.',
      'low', 'completed', 4, 'Maintenance', 3, 2,
      '2026-10-28 10:00-04', '2026-10-28 11:45-04', '2026-10-28 11:45-04'),
  (6, 'Prepare welcome amenity for VIP in Room 1010',
      'Fruit plate and handwritten card. Guest arrives around 7 PM.',
      'medium', 'open', 3, 'Housekeeping', 1, 3,
      '2026-10-28 15:20-04', '2026-10-28 15:20-04', NULL);

-- assigned: old/new_value are user ids. status_changed / priority_changed: old/new values.
-- comment: new_value is the note text.
INSERT INTO task_events (task_id, user_id, action, old_value, new_value, created_at) VALUES
  -- Task 1: Room 312 AC
  (1, 2, 'created',        NULL,          'open',        '2026-10-27 18:20-04'),
  (1, 2, 'assigned',       NULL,          '4',           '2026-10-27 18:25-04'),
  (1, 4, 'status_changed', 'open',        'in_progress', '2026-10-27 19:05-04'),
  (1, 4, 'comment',        NULL,          'Compressor will not start. Replacement capacitor ordered, arriving tomorrow morning.', '2026-10-27 21:40-04'),
  (1, 4, 'comment',        NULL,          'Part delivery delayed until this afternoon.', '2026-10-28 09:30-04'),
  -- Task 2: towels
  (2, 1, 'created',        NULL,          'open',        '2026-10-27 16:00-04'),
  (2, 1, 'assigned',       NULL,          '3',           '2026-10-27 16:00-04'),
  (2, 3, 'status_changed', 'open',        'in_progress', '2026-10-27 16:30-04'),
  (2, 3, 'status_changed', 'in_progress', 'completed',   '2026-10-27 17:15-04'),
  -- Task 3: late checkout
  (3, 2, 'created',        NULL,          'open',        '2026-10-27 20:10-04'),
  (3, 1, 'status_changed', 'open',        'completed',   '2026-10-28 08:15-04'),
  (3, 1, 'comment',        NULL,          'Approved until 2 PM and updated in the booking system.', '2026-10-28 08:15-04'),
  -- Task 4: elevator
  (4, 2, 'created',        NULL,          'open',        '2026-10-27 22:15-04'),
  (4, 2, 'assigned',       NULL,          '4',           '2026-10-27 22:20-04'),
  (4, 1, 'priority_changed', 'medium',    'high',        '2026-10-28 07:30-04'),
  -- Task 5: pool light
  (5, 3, 'created',        NULL,          'open',        '2026-10-28 10:00-04'),
  (5, 3, 'assigned',       NULL,          '4',           '2026-10-28 10:00-04'),
  (5, 4, 'status_changed', 'open',        'in_progress', '2026-10-28 11:00-04'),
  (5, 4, 'status_changed', 'in_progress', 'completed',   '2026-10-28 11:45-04'),
  -- Task 6: VIP amenity
  (6, 1, 'created',        NULL,          'open',        '2026-10-28 15:20-04'),
  (6, 1, 'assigned',       NULL,          '3',           '2026-10-28 15:20-04');

-- Evening (shift 1) hands off to Morning (shift 2): the tasks not yet completed at 23:00.
INSERT INTO handoffs (id, from_shift_id, to_shift_id, created_at, acknowledged_by, acknowledged_at) VALUES
  (1, 1, 2, '2026-10-27 22:55-04', 1, '2026-10-28 07:10-04');

INSERT INTO handoff_tasks (handoff_id, task_id) VALUES
  (1, 1),
  (1, 3),
  (1, 4);

-- We inserted explicit ids, so move each SERIAL counter past them.
-- Otherwise the app's first INSERT would try id 1 and fail.
SELECT setval('users_id_seq',       (SELECT MAX(id) FROM users));
SELECT setval('shifts_id_seq',      (SELECT MAX(id) FROM shifts));
SELECT setval('tasks_id_seq',       (SELECT MAX(id) FROM tasks));
SELECT setval('task_events_id_seq', (SELECT MAX(id) FROM task_events));
SELECT setval('handoffs_id_seq',    (SELECT MAX(id) FROM handoffs));

COMMIT;
