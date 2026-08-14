export type AccountType = "customer" | "business" | "admin";
export type StoreMemberRole = "owner" | "manager" | "employee";
export type StoreMemberStatus = "invited" | "active" | "disabled";
export type ResponseType = "in_stock" | "out_of_stock" | "can_order";
export type RequestStatus =
  | "draft"
  | "active"
  | "partially_answered"
  | "answered"
  | "fulfilled"
  | "expired"
  | "cancelled";

export type AvailabilityAmount = "plenty" | "few_left" | "last_one";

export type ProductCategory =
  | "Grocery"
  | "Beauty"
  | "Electronics"
  | "Convenience"
  | "Auto"
  | "Clothing"
  | "Collectibles"
  | "Hardware"
  | "Specialty"
  | "Other";

export type StoreCategory =
  | "Grocery"
  | "Convenience"
  | "Beauty"
  | "Electronics"
  | "Auto Parts"
  | "Clothing"
  | "Collectibles"
  | "Hardware"
  | "Specialty Retail"
  | "Other";

export type CustomerSubscriptionPlan = "free" | "plus";
export type StoreApplicationStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_type: AccountType;
  /** Customer billing plan — UI-ready; Stripe later */
  subscription_plan: CustomerSubscriptionPlan;
  default_city: string | null;
  default_state: string | null;
  default_postal_code: string | null;
  notify_in_stock: boolean;
  notify_can_order: boolean;
  notify_request_expired: boolean;
  notify_new_request: boolean;
  notify_demand_alerts: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_verified: boolean;
  is_suspended: boolean;
  age_restricted: boolean;
  subscription_plan: string;
  subscription_status: string;
  /** ISO timestamp when 60-day pilot ends; null if not on trial */
  trial_ends_at: string | null;
  avg_response_minutes: number | null;
  service_radius_miles: number;
  created_at: string;
  updated_at: string;
}

export interface StoreApplication {
  id: string;
  business_name: string;
  business_type: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  website: string | null;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  why_legit: string;
  confirmed_legitimate: boolean;
  request_categories: string[];
  status: StoreApplicationStatus;
  applicant_user_id: string | null;
  created_store_id?: string | null;
  admin_notes: string | null;
  applicant_reply: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreMember {
  id: string;
  store_id: string;
  user_id: string | null;
  role: StoreMemberRole;
  status: StoreMemberStatus;
  created_at: string;
}

export interface CustomerRequest {
  id: string;
  customer_id: string;
  product_name: string;
  normalized_product_name: string;
  description: string | null;
  image_url: string | null;
  image_storage_path?: string | null;
  category: string | null;
  city: string;
  state: string;
  postal_code: string;
  radius_miles: number;
  latitude?: number | null;
  longitude?: number | null;
  status: RequestStatus;
  expires_at: string;
  stores_targeted: number;
  fulfilled_at?: string | null;
  fulfilled_store_id?: string | null;
  found_with_findit?: boolean | null;
  still_looking_count?: number;
  last_rebroadcast_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestTarget {
  id: string;
  request_id: string;
  store_id: string;
  delivery_status: string;
  viewed_at: string | null;
  route_sent_at?: string;
  opened_at?: string | null;
  responded_at?: string | null;
  response_time_seconds?: number | null;
  notify_after?: string | null;
  was_closed_at_route?: boolean;
  created_at: string;
}

export interface StoreResponse {
  id: string;
  request_id: string;
  store_id: string;
  responded_by: string;
  response_type: ResponseType;
  price: number | null;
  quantity: number | null;
  note: string | null;
  hold_minutes: number | null;
  estimated_available_at: string | null;
  estimated_availability_label: string | null;
  availability_amount?: AvailabilityAmount | null;
  track_demand: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_request_id: string | null;
  related_store_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface StoreWithRelations extends Store {
  categories?: string[];
  service_areas?: string[];
  member_role?: StoreMemberRole;
}

export interface RequestWithResponses extends CustomerRequest {
  responses?: (StoreResponse & { store?: Store })[];
  targets_count?: number;
}

export interface DemandItem {
  product_name: string;
  normalized_product_name: string;
  request_count: number;
  out_of_stock_count: number;
  in_stock_count: number;
  can_order_count: number;
  unanswered_count: number;
  out_of_stock_rate: number;
  opportunity_score: number;
  insight?: string | null;
  consider_stocking?: boolean;
}

export interface StoreMetrics {
  requests_today: number;
  answered_today: number;
  waiting_today: number;
  in_stock_today: number;
  total_received: number;
  total_answered: number;
  avg_response_minutes: number | null;
  in_stock_pct: number;
  out_of_stock_pct: number;
  can_order_pct: number;
  unanswered_pct: number;
  /** This week (7d) performance strip */
  week_received: number;
  week_answered: number;
  week_response_rate: number;
  week_avg_response_minutes: number | null;
  week_in_stock: number;
  week_customer_finds: number;
}

export interface PilotAdminStats {
  totalCustomers: number;
  approvedStores: number;
  pendingApplications: number;
  activeRequests: number;
  completedRequests: number;
  requestsToday: number;
  responseRate: number;
  successfulFindRate: number;
  avgFirstResponseSeconds: number | null;
  medianFirstResponseSeconds: number | null;
  storesRespondingToday: number;
  funnel: {
    created: number;
    routed: number;
    withResponse: number;
    withInStock: number;
    confirmedFound: number;
  };
  topCategories: { name: string; count: number }[];
  topProducts: { name: string; count: number }[];
  zeroResponseRequests: { id: string; product_name: string; created_at: string }[];
  highestPerformingStores: { id: string; name: string; responseRate: number; finds: number }[];
  slowestStores: { id: string; name: string; avgSeconds: number | null }[];
}

export type PushPlatform = "ios" | "android" | "web";

export interface DevicePushToken {
  id: string;
  user_id: string;
  platform: PushPlatform;
  token: string;
  store_id: string | null;
  app_surface: "customer" | "employee" | "web";
  updated_at: string;
  created_at: string;
}

/** Loose Supabase schema typing — regenerate with `supabase gen types` when connected. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
