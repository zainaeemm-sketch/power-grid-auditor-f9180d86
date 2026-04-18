INSERT INTO public.user_roles (user_id, role)
VALUES ('03cb4791-e16e-4b10-a4eb-6eb4c838390d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;