export class StripeClient {
  private secretKey: string;
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request(method: string, path: string, body?: Record<string, string>): Promise<any> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? new URLSearchParams(body).toString() : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
    }
    return data;
  }

  async createCustomer(email: string, name: string, metadata?: Record<string, string>) {
    const body: Record<string, string> = { email, name };
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        body[`metadata[${key}]`] = value;
      }
    }
    return this.request('POST', '/customers', body);
  }

  async createCheckoutSession(params: {
    customer: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    const body: Record<string, string> = {
      'customer': params.customer,
      'mode': 'subscription',
      'line_items[0][price]': params.priceId,
      'line_items[0][quantity]': '1',
      'success_url': params.successUrl,
      'cancel_url': params.cancelUrl,
    };
    if (params.metadata) {
      for (const [key, value] of Object.entries(params.metadata)) {
        body[`metadata[${key}]`] = value;
      }
    }
    return this.request('POST', '/checkout/sessions', body);
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    return this.request('POST', '/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getSubscription(subscriptionId: string) {
    return this.request('GET', `/subscriptions/${subscriptionId}`);
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const sigPart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !sigPart) {
    return false;
  }

  const timestamp = timestampPart.slice(2);
  const expectedSig = sigPart.slice(3);

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );

  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === expectedSig;
}
