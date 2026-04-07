import { z } from 'zod';

export const UserRoleSchema = z.enum(['OWNER', 'AGENT', 'BUYER']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  phone: z.string().min(10),
  role: UserRoleSchema,
  password: z.string().min(6), // Hashed in DB, but this for validation
});
export type User = z.infer<typeof UserSchema>;

export const BoatSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  ownerId: z.string().uuid(),
  agentId: z.string().uuid(),
});
export type Boat = z.infer<typeof BoatSchema>;

export const BuyerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  phone: z.string().min(10),
  address: z.string().optional(),
});
export type Buyer = z.infer<typeof BuyerSchema>;

export const SaleSchema = z.object({
  id: z.string().uuid(),
  boatId: z.string().uuid(),
  agentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  fishName: z.string().min(1),
  weight: z.number().positive(),
  rate: z.number().positive(),
  totalAmount: z.number().positive(),
  paymentType: z.enum(['CASH', 'UPI']),
  date: z.date(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  paidAmount: z.number().positive(),
  paymentType: z.enum(['CASH', 'UPI']),
  date: z.date(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  boatId: z.string().uuid(),
  expenseType: z.string().min(1),
  amount: z.number().positive(),
  date: z.date(),
});
export type Expense = z.infer<typeof ExpenseSchema>;
