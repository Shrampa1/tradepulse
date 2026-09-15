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
  business_tagline: string | null;
  business_address: string | null;
  business_fax: string | null;
  phone: string | null;
  payment_account_id: string | null;
  tax_rate: number;
  mileage_rate: number;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  user_id: string;
  estimate_id: string | null;
  client_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringContractFrequency = "weekly" | "monthly";

export type RecurringContract = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  frequency: RecurringContractFrequency;
  line_items_template: DraftLineItem[];
  tax_rate: number;
  deposit_amount: number;
  next_run_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpenseKind = "material" | "mileage" | "labor" | "other";

export type Expense = {
  id: string;
  user_id: string;
  estimate_id: string | null;
  client_id: string | null;
  kind: ExpenseKind;
  category: string | null;
  description: string;
  amount: number;
  miles: number | null;
  receipt_photo_path: string | null;
  occurred_at: string;
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

export type EstimateDiscountType = "fixed" | "percent";

export type Estimate = {
  id: string;
  user_id: string;
  client_id: string | null;
  status: EstimateStatus;
  job_address: string | null;
  notes: string | null;
  subtotal_amount: number;
  discount_type: EstimateDiscountType;
  discount_value: number;
  discount_amount: number;
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
