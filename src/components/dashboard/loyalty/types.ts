export interface LoyaltyTier {
  id: number;
  name: string;
  min_spend: number;
  max_spend: number | null;
  points_multiplier: number;
}

export interface LoyaltyHistoryItem {
  id: number;
  user_id: string;
  points: number;
  description: string;
  created_at: string;
  operation_type: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface UserCoupon {
    id: number;
    created_at: string;
    is_used: boolean;
    expires_at: string;
    order_id: number | null;
    profiles: {
        first_name: string | null;
        last_name: string | null;
    } | null;
    coupons: {
        name: string;
        discount_value: number;
    } | null;
    orders?: {
        created_at: string;
    } | null;
}

export interface RewardCoupon {
    id: number;
    name: string;
    points_cost: number;
    discount_value: number;
    stock_quantity: number;
}