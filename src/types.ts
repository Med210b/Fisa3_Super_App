export type Role = 'USER' | 'RIDER' | 'MERCHANT' | 'ADMIN';

export type StoreType = 'FOOD' | 'GROCERY' | 'PHARMACY' | 'ELECTRONICS' | 'FASHION' | 'HOME';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  wallet: number;
  profileImage?: string;
  phone?: string;
}

export interface Store {
  id: string;
  name: string;
  type: StoreType;
  rating: number;
  image: string;
  address: string;
  location: { lat: number; lng: number };
  merchantId: string;
  status: 'OPEN' | 'CLOSED';
  deliveryTime: string;
  deliveryFee: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  status: 'AVAILABLE' | 'OUT_OF_STOCK';
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export type OrderStatus = 'PENDING' | 'PREPARING' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  customerId: string;
  storeId: string;
  riderId?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  deliveryLocation: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface TrackingData {
  orderId: string;
  riderId: string;
  location: { lat: number; lng: number };
  bearing: number;
  lastUpdate: string;
}
