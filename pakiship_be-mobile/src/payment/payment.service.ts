import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';

@Injectable()
export class PaymentService {
  private readonly client: TribeClient;

  constructor() {
    this.client = new TribeClient({
      gatewayUrl: process.env.APICENTER_URL || 'https://api-center-test.itsandbox.site',
      tribeId: process.env.APICENTER_TRIBE_ID || 'pakiapps',
      secret: process.env.APICENTER_TRIBE_SECRET || '',
    });
  }

  async createEwalletCheckout(draftId: string, price: number) {
    try {
      await this.client.authenticate();

      const checkout = await this.client.paymentCreateCheckoutSession({
        referenceId: `draft-${draftId}`,
        idempotencyKey: `checkout-${draftId}-${Date.now()}`, // Required to prevent duplicate charges
        successUrl: `pakiship://payment-success?draftId=${draftId}`,
        cancelUrl: `pakiship://payment-cancel?draftId=${draftId}`,
        paymentMethods: ['gcash', 'maya', 'qrph'],
        lineItems: [
          {
            name: 'PakiShip Parcel Delivery',
            quantity: 1,
            amount: { value: Math.round(price * 100), currency: 'PHP' },
          },
        ],
      });
      console.log("[PaymentService] Successfully got response from SDK:", checkout);

      return checkout;
    } catch (error) {
      console.error("APICenter Payment Error:", error);
      throw new InternalServerErrorException("Failed to generate payment link.");
    }
  }
}
