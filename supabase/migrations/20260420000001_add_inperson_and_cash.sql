-- Add 'in_person' to consultation_type enum
ALTER TYPE public.consultation_type ADD VALUE IF NOT EXISTS 'in_person';

-- Add 'cash' to payment_provider enum
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'cash';

-- Add payment_method column to consultations so doctor can see how patient will pay
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
