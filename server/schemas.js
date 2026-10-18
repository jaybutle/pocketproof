import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().trim().min(1).max(140),
  email: z.string().trim().email().max(254).or(z.literal('')).optional(),
  notes: z.string().max(2000).optional()
});

export const invoiceSchema = z.object({
  number: z.string().trim().max(80).nullable().optional(),
  client_name: z.string().trim().min(1).max(140),
  client_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().date().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).default('USD'),
  total_minor: z.number().int().nonnegative().max(999999999999),
  status: z.enum(['draft','unpaid','paid','overdue','disputed']).default('unpaid'),
  notes: z.string().max(4000).optional()
});

export const documentReviewSchema = z.object({
  kind: z.enum(['invoice','receipt','quote','payment','other']),
  fields: z.object({
    number:z.string().max(80).nullable(), client_name:z.string().max(140).nullable(),
    issue_date:z.string().date().nullable(), due_date:z.string().date().nullable(),
    currency:z.string().max(3).nullable(), total_minor:z.number().int().nonnegative().nullable(),
    status:z.enum(['draft','unpaid','paid','disputed']).nullable(), notes:z.string().max(4000)
  })
});
