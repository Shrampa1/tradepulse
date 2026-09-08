export type EstimateStatus =
  | "draft"
  | "sent"
  | "deposit_paid"
  | "invoiced"
  | "paid"
  | "overdue";

export type Profile = {
  id: string;
  user_id: string;
  business_name: string;
  phone: string | null;
  payment_account_id: string | null;
  tax_rate: number;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type LineItem = {
  id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
  created_at: string;
};

export type Estimate = {
  id: string;
  user_id: string;
  client_id: string | null;
  status: EstimateStatus;
  job_address: string | null;
  notes: string | null;
  subtotal_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  deposit_amount: number;
  public_token: string;
  signature_data_url: string | null;
  signed_at: string | null;
  sent_at: string | null;
  deposit_paid_at: string | null;
  paid_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EstimateWithRelations = Estimate & {
  client: Client | null;
  line_items: LineItem[];
};

// Draft shape used while building/editing an estimate on-device before line
// items have a database id yet (e.g. rows suggested by AI parsing).
export type DraftLineItem = {
  id: string; // client-generated (crypto.randomUUID()) until saved
  description: string;
  quantity: number;
  unit_price: number;
};
