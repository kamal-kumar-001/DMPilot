import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface FeeFreeSessionResponse {
  id: string;
  orderId: string;
  baseAmountPaise: number;
  expectedAmountPaise: number;
  discountPaise: number;
  status: string;
  checkoutUrl: string;
  expiresAt?: string;
  utr?: string;
}

/**
 * Minimal server-side client for the FeeFree payment API.
 * The API key is used only here, server-to-server; it never reaches the browser.
 */
@Injectable()
export class FeeFreeService {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return (this.configService.get('FEEFREE_API_URL') || 'http://localhost:6100').replace(
      /\/$/,
      '',
    );
  }

  private get apiKey(): string {
    const key = this.configService.get('FEEFREE_API_KEY');
    if (!key) {
      throw new BadRequestException(
        'FeeFree payment provider is not configured on the server (FEEFREE_API_KEY missing).',
      );
    }
    return key;
  }

  async createSession(input: {
    orderId: string;
    amountPaise: number;
    customerName?: string;
    customerEmail?: string;
    customerMobile?: string;
    returnUrl?: string;
  }): Promise<FeeFreeSessionResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          orderId: input.orderId,
          amountPaise: Math.round(input.amountPaise),
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerMobile: input.customerMobile,
          returnUrl: input.returnUrl,
        }),
      });
    } catch (error: any) {
      throw new BadRequestException(
        `FeeFree payment service is unreachable. Please try again later.`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text;
      try {
        message = JSON.parse(text)?.error || text;
      } catch {
        // keep raw text
      }
      throw new BadRequestException(
        `FeeFree checkout session could not be created (HTTP ${response.status}): ${message}`,
      );
    }

    return (await response.json()) as FeeFreeSessionResponse;
  }

  /** Authoritative server-side re-confirmation of a session's state. */
  async getSession(sessionId: string): Promise<FeeFreeSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new BadRequestException(
        `FeeFree session lookup failed (HTTP ${response.status}) for session ${sessionId}.`,
      );
    }
    return (await response.json()) as FeeFreeSessionResponse;
  }
  async enrollServiceOrder(sessionId: string) {
    try {
      return await this.serviceRequest('/api/v1/admin/service-pilot/orders', { sessionId });
    } catch {
      throw new BadRequestException(
        'Email-observed subscription access is not ready for this checkout. Check the selected FeeFree merchant email-access setting, active mailbox and receiving account. No subscription access or payment confirmation was granted.',
      );
    }
  }
  async getServiceGrant(grantId: string): Promise<any> {
    return this.serviceRequest(`/api/v1/admin/service-pilot/grants/${encodeURIComponent(grantId)}`);
  }
  async revokeServiceGrant(grantId: string): Promise<any> {
    return this.serviceRequest(
      `/api/v1/admin/service-pilot/grants/${encodeURIComponent(grantId)}/review`,
      { action: 'REVOKED' },
    );
  }
  private async serviceRequest(path: string, body?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new BadRequestException(
        `FeeFree service access request failed (HTTP ${response.status})`,
      );
    return response.json();
  }
}
