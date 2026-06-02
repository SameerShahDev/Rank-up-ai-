export interface PayboltCreateOrderResult {
  orderId: string;
  payment_url: string;
}

export interface PayboltCreateOrderResponse {
  status: boolean;
  message: string;
  result?: PayboltCreateOrderResult;
}

export interface PayboltOrderStatusResult {
  txnStatus?: string;
  resultInfo?: string;
  orderId?: string;
  status?: string;
  amount?: string;
  date?: string;
  utr?: string;
}

export interface PayboltCheckStatusResponse {
  status: string;
  message?: string;
  result?: PayboltOrderStatusResult;
}

export interface PendingDeposit {
  orderId: string;
  amount: number;
  createdAt: number;
}
