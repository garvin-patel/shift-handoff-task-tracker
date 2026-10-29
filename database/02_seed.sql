-- Demo data for a hotel. Runs after 01_schema.sql on a fresh database.
--
-- Every demo user's password is: password123
-- These are real bcrypt hashes, so the demo works right after a reset. They're public in
-- this repo, so this seed is for local demos only. Never load it into a deployed database.
--
-- Staff (one supervisor per shift):
--   Morning  Maria Lopez (supervisor, Front Desk), Aisha Khan (Housekeeping), Tom Nguyen (Maintenance)
--   Evening  Daniel Brooks (supervisor, Front Desk), James Carter (Front Desk),
--            Priya Shah (Housekeeping), Marcus Reed (Maintenance)
--   Night    Sofia Rossi (supervisor, Front Desk), Leo Park (Maintenance)
--
-- Times are relative to when the seed runs, so the demo always looks fresh.
-- The current Evening shift started 1 hour ago, and the rest of the story is placed around it:
--   Shift 1  Evening  yesterday 15:00-23:00  ended, handed off to shift 2
--   Shift 2  Morning  today     07:00-15:00  ended
--   Shift 3  Evening  today     15:00-       current (started 1 hour ago)

BEGIN;

-- pg_temp.at(-1, '18:20') = yesterday at 18:20 and pg_temp.at(0, '09:30') = today at 09:30,
-- where "today 15:00" is 1 hour before the seed runs.
CREATE FUNCTION pg_temp.at(day_offset int, clock text) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('minute', now()) - interval '1 hour' - interval '15 hours'
         + day_offset * interval '1 day' + clock::interval
$$;

INSERT INTO users (id, name, email, password_hash, role, department, usual_shift, created_at) VALUES
  (1, 'Maria Lopez',   'maria.lopez@example.com',   '$2b$12$TvL.MlvbnLiSXavKzsygPO/CKnDpxsBDVX36CLGL2atlU7ZfbIPsK', 'supervisor', 'Front Desk',   'Morning', pg_temp.at(-28, '09:00')),
  (2, 'James Carter',  'james.carter@example.com',  '$2b$12$/1JpgSnBFkgSkvsnSMGNd.l2weDUtnMbzQ2T1yZpxnD54eEqRK0xG', 'employee',   'Front Desk',   'Evening', pg_temp.at(-28, '09:05')),
  (3, 'Priya Shah',    'priya.shah@example.com',    '$2b$12$8cw/qMpr81ehTKnzSse/HOxKlpaeNvH78TunV8hca2iDqwdqIpAm6', 'employee',   'Housekeeping', 'Evening', pg_temp.at(-28, '09:10')),
  (4, 'Marcus Reed',   'marcus.reed@example.com',   '$2b$12$hXQlAX9PQmirkl24Ai3WlucjZSXjac1Z2Kzhgww2VtwaAhWtv3jMO', 'employee',   'Maintenance',  'Evening', pg_temp.at(-28, '09:15')),
  (5, 'Daniel Brooks', 'daniel.brooks@example.com', '$2b$12$u6d1m.Y8KM.DaqawK5g0/uhNElG7POtBDGIqNpKWSwOvu1C/.qNJy', 'supervisor', 'Front Desk',   'Evening', pg_temp.at(-28, '09:20')),
  (6, 'Aisha Khan',    'aisha.khan@example.com',    '$2b$12$DmaYaqmKOpI/Ul92bOuXb.SGr0pGYje0CNN1YtEvTIKWekIJDF10u', 'employee',   'Housekeeping', 'Morning', pg_temp.at(-28, '09:25')),
  (7, 'Tom Nguyen',    'tom.nguyen@example.com',    '$2b$12$GtS7F2SqsFW0uxz2QJ2ogOZMMfIvPTHY9biDp/sl.viervW9vHdce', 'employee',   'Maintenance',  'Morning', pg_temp.at(-28, '09:30')),
  (8, 'Sofia Rossi',   'sofia.rossi@example.com',   '$2b$12$7xCjCD/QScc0KIy7GMLxDeKP1N5DEMINvii.sEN2U.dYSkRucsAxu', 'supervisor', 'Front Desk',   'Night',   pg_temp.at(-28, '09:35')),
  (9, 'Leo Park',      'leo.park@example.com',      '$2b$12$7U.Z5OoTfe19bxgoDRYHcOOgcRbmT.VZP9qnFNCPSav0JCGWKO25S', 'employee',   'Maintenance',  'Night',   pg_temp.at(-28, '09:40'));

-- Each shift is started by that shift's supervisor.
INSERT INTO shifts (id, name, started_at, ended_at, started_by) VALUES
  (1, 'Evening', pg_temp.at(-1, '15:00'), pg_temp.at(-1, '23:00'), 5),
  (2, 'Morning', pg_temp.at( 0, '07:00'), pg_temp.at( 0, '15:00'), 1),
  (3, 'Evening', pg_temp.at( 0, '15:00'), NULL,                    5);

INSERT INTO tasks (id, title, description, priority, status, assigned_user_id, assigned_department,
                   created_by, created_in_shift, created_at, updated_at, completed_at) VALUES
  (1, 'Room 312 AC broken',
      'Guest reports AC blowing warm air. Guest moved to Room 318 for the night.',
      'high', 'in_progress', 4, 'Maintenance', 2, 1,
      pg_temp.at(-1, '18:20'), pg_temp.at(0, '09:30'), NULL),
  (2, 'Restock towels on 4th floor',
      'Linen closet on 4 is empty. Bring up 40 bath towels and 40 hand towels.',
      'medium', 'completed', 3, 'Housekeeping', 5, 1,
      pg_temp.at(-1, '16:00'), pg_temp.at(-1, '17:15'), pg_temp.at(-1, '17:15')),
  (3, 'Approve late checkout for Room 205',
      'Guest requested checkout at 2 PM instead of 11 AM. Needs approval and an update in the booking system.',
      'low', 'completed', NULL, 'Front Desk', 2, 1,
      pg_temp.at(-1, '20:10'), pg_temp.at(0, '08:15'), pg_temp.at(0, '08:15')),
  (4, 'Lobby elevator making grinding noise',
      'Grinding sound between floors 1 and 2. Still running. Call the elevator service company if it gets worse.',
      'high', 'open', 4, 'Maintenance', 2, 1,
      pg_temp.at(-1, '22:15'), pg_temp.at(0, '07:30'), NULL),
  (5, 'Pool area light flickering',
      'Light above the hot tub flickers on and off.',
      'low', 'completed', 7, 'Maintenance', 6, 2,
      pg_temp.at(0, '10:00'), pg_temp.at(0, '11:45'), pg_temp.at(0, '11:45')),
  (6, 'Prepare welcome amenity for VIP in Room 1010',
      'Fruit plate and handwritten card. Guest arrives around 7 PM.',
      'medium', 'open', 3, 'Housekeeping', 5, 3,
      pg_temp.at(0, '15:20'), pg_temp.at(0, '15:20'), NULL);

-- assigned: old/new_value are user ids. status_changed / priority_changed: old/new values.
-- comment: new_value is the note text.
INSERT INTO task_events (task_id, user_id, action, old_value, new_value, created_at) VALUES
  -- Task 1: Room 312 AC (reported in the evening, followed up by the morning technician)
  (1, 2, 'created',        NULL,          'open',        pg_temp.at(-1, '18:20')),
  (1, 5, 'assigned',       NULL,          '4',           pg_temp.at(-1, '18:25')),
  (1, 4, 'status_changed', 'open',        'in_progress', pg_temp.at(-1, '19:05')),
  (1, 4, 'comment',        NULL,          'Compressor will not start. Replacement capacitor ordered, arriving tomorrow morning.', pg_temp.at(-1, '21:40')),
  (1, 7, 'comment',        NULL,          'Part delivery delayed until this afternoon.', pg_temp.at(0, '09:30')),
  -- Task 2: towels
  (2, 5, 'created',        NULL,          'open',        pg_temp.at(-1, '16:00')),
  (2, 5, 'assigned',       NULL,          '3',           pg_temp.at(-1, '16:00')),
  (2, 3, 'status_changed', 'open',        'in_progress', pg_temp.at(-1, '16:30')),
  (2, 3, 'status_changed', 'in_progress', 'completed',   pg_temp.at(-1, '17:15')),
  -- Task 3: late checkout
  (3, 2, 'created',        NULL,          'open',        pg_temp.at(-1, '20:10')),
  (3, 1, 'status_changed', 'open',        'completed',   pg_temp.at(0, '08:15')),
  (3, 1, 'comment',        NULL,          'Approved until 2 PM and updated in the booking system.', pg_temp.at(0, '08:15')),
  -- Task 4: elevator
  (4, 2, 'created',        NULL,          'open',        pg_temp.at(-1, '22:15')),
  (4, 5, 'assigned',       NULL,          '4',           pg_temp.at(-1, '22:20')),
  (4, 1, 'priority_changed', 'medium',    'high',        pg_temp.at(0, '07:30')),
  -- Task 5: pool light (all during the morning shift)
  (5, 6, 'created',        NULL,          'open',        pg_temp.at(0, '10:00')),
  (5, 1, 'assigned',       NULL,          '7',           pg_temp.at(0, '10:05')),
  (5, 7, 'status_changed', 'open',        'in_progress', pg_temp.at(0, '11:00')),
  (5, 7, 'status_changed', 'in_progress', 'completed',   pg_temp.at(0, '11:45')),
  -- Task 6: VIP amenity
  (6, 5, 'created',        NULL,          'open',        pg_temp.at(0, '15:20')),
  (6, 5, 'assigned',       NULL,          '3',           pg_temp.at(0, '15:20'));

-- Evening (shift 1) hands off to Morning (shift 2): the tasks not yet completed at 23:00.
-- Maria, the morning supervisor, acknowledged it when her shift started.
INSERT INTO handoffs (id, from_shift_id, to_shift_id, created_at, acknowledged_by, acknowledged_at) VALUES
  (1, 1, 2, pg_temp.at(-1, '22:55'), 1, pg_temp.at(0, '07:10'));

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
