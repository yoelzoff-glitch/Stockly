export const MELI_PROMOTION_ENDPOINTS = {
  GET_AVAILABLE_PROMOTIONS: (sellerId: string) => `/seller-promotions/users/${sellerId}/app`,
  GET_ELIGIBLE_ITEMS: (promotionId: string) => `/seller-promotions/promotions/${promotionId}/items`,
  CREATE_ITEM_PROMOTION: (promotionId: string) => `/seller-promotions/promotions/${promotionId}/items`,
  UPDATE_ITEM_PROMOTION: (promotionId: string, itemId: string) => `/seller-promotions/promotions/${promotionId}/items/${itemId}`,
  DELETE_ITEM_PROMOTION: (promotionId: string, itemId: string) => `/seller-promotions/promotions/${promotionId}/items/${itemId}`,
  
  CREATE_COUPON: (sellerId: string) => `/seller-promotions/users/${sellerId}/coupons?app_version=v2`,
  GET_COUPONS: (sellerId: string) => `/seller-promotions/users/${sellerId}/coupons?app_version=v2`,
  CANCEL_COUPON: (sellerId: string, couponId: string) => `/seller-promotions/users/${sellerId}/coupons/${couponId}?app_version=v2`
};
