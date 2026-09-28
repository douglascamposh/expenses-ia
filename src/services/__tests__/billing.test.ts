import {
  __resetBillingForTests,
  getBillingBaseUrl,
  getProDetails,
  getProPrice,
  getProStatus,
  isBillingAvailable,
  isBillingConfigured,
  PRO_ENTITLEMENT_ID,
  PRO_PRODUCT_ID,
  purchasePro,
  refreshBackendPro,
  restorePro,
} from '../billing';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(() => Promise.resolve({})),
    logOut: jest.fn(() => Promise.resolve({})),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    invalidateCustomerInfoCache: jest.fn(() => Promise.resolve()),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

type MockPurchases = Record<string, jest.Mock>;
function mocks(): MockPurchases {
  return (jest.requireMock('react-native-purchases') as { default: MockPurchases }).default;
}

function proInfo() {
  return { entitlements: { active: { [PRO_ENTITLEMENT_ID]: { identifier: PRO_ENTITLEMENT_ID } } } };
}

function offering() {
  return {
    current: {
      availablePackages: [
        { product: { identifier: 'otro' } },
        { product: { identifier: PRO_PRODUCT_ID } },
      ],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetBillingForTests();
  mocks().getCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });
  mocks().getOfferings.mockResolvedValue({ current: null });
  mocks().restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
});

describe('billing RevenueCat', () => {
  it('nativo disponible y configurado con keys de prueba', () => {
    expect(isBillingAvailable()).toBe(true);
    expect(isBillingConfigured()).toBe(true);
  });

  it('getProStatus true con entitlement activo', async () => {
    mocks().getCustomerInfo.mockResolvedValue(proInfo());
    await expect(getProStatus()).resolves.toBe(true);
  });

  it('getProStatus false sin entitlement', async () => {
    await expect(getProStatus()).resolves.toBe(false);
  });

  it('purchasePro elige el paquete ia_pro_monthly y confirma', async () => {
    mocks().getOfferings.mockResolvedValue(offering());
    mocks().purchasePackage.mockResolvedValue({ customerInfo: proInfo() });
    await expect(purchasePro()).resolves.toBe('purchased');
    expect(mocks().purchasePackage).toHaveBeenCalledWith(
      expect.objectContaining({ product: expect.objectContaining({ identifier: PRO_PRODUCT_ID }) }),
    );
  });

  it('purchasePro sin oferta lanza billing-no-offering', async () => {
    await expect(purchasePro()).rejects.toThrow('billing-no-offering');
  });

  it('purchasePro cancelado por el usuario retorna cancelled', async () => {
    mocks().getOfferings.mockResolvedValue(offering());
    mocks().purchasePackage.mockRejectedValueOnce({ code: 'PURCHASE_CANCELLED_ERROR' });
    await expect(purchasePro()).resolves.toBe('cancelled');
  });

  it('getProDetails mapea vencimiento y período mensual', async () => {
    mocks().getCustomerInfo.mockResolvedValue({
      entitlements: { active: { [PRO_ENTITLEMENT_ID]: { identifier: PRO_ENTITLEMENT_ID, expirationDate: '2026-10-23T12:00:00.000Z' } } },
    });
    mocks().getOfferings.mockResolvedValue({
      current: { availablePackages: [{ packageType: 'MONTHLY', product: { identifier: PRO_PRODUCT_ID, priceString: '$2.99' } }] },
    });
    await expect(getProDetails()).resolves.toEqual({
      isPro: true, expirationDate: '2026-10-23T12:00:00.000Z', period: 'monthly',
    });
  });

  it('getProDetails infiere anual por identificador y lifetime sin fecha', async () => {
    mocks().getCustomerInfo.mockResolvedValue({
      entitlements: { active: { [PRO_ENTITLEMENT_ID]: { identifier: PRO_ENTITLEMENT_ID, expirationDate: '2027-09-23T12:00:00.000Z' } } },
    });
    mocks().getOfferings.mockResolvedValue({
      current: { availablePackages: [{ packageType: 'UNKNOWN', product: { identifier: 'kybo_yearly_v1' } }] },
    });
    await expect(getProDetails()).resolves.toMatchObject({ isPro: true, period: 'yearly' });
    mocks().getCustomerInfo.mockResolvedValue({
      entitlements: { active: { [PRO_ENTITLEMENT_ID]: { identifier: PRO_ENTITLEMENT_ID } } },
    });
    await expect(getProDetails()).resolves.toMatchObject({ isPro: true, expirationDate: null });
  });

  it('getProDetails none sin entitlement', async () => {
    await expect(getProDetails()).resolves.toEqual({ isPro: false, expirationDate: null, period: null });
  });

  it('getProPrice devuelve el precio del paquete Pro', async () => {
    mocks().getOfferings.mockResolvedValue({
      current: { availablePackages: [{ product: { identifier: PRO_PRODUCT_ID, priceString: '$2.99' } }] },
    });
    await expect(getProPrice()).resolves.toBe('$2.99');
  });

  it('getProPrice null sin oferta', async () => {
    await expect(getProPrice()).resolves.toBeNull();
  });

  it('restorePro refleja el entitlement restaurado', async () => {
    mocks().restorePurchases.mockResolvedValue(proInfo());
    await expect(restorePro()).resolves.toBe(true);
    mocks().restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
    await expect(restorePro()).resolves.toBe(false);
  });

  it('purchasePro relee el entitlement si el recibo aún no lo trae', async () => {
    mocks().getOfferings.mockResolvedValue(offering());
    mocks().purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    mocks().getCustomerInfo.mockResolvedValue(proInfo());
    await expect(purchasePro()).resolves.toBe('purchased');
    expect(mocks().invalidateCustomerInfoCache).toHaveBeenCalledTimes(1);
  });

  it('purchasePro cancelled si el reintento sigue sin entitlement', async () => {
    mocks().getOfferings.mockResolvedValue(offering());
    mocks().purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    mocks().getCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });
    await expect(purchasePro()).resolves.toBe('cancelled');
  });

  it('refreshBackendPro POST a /api/billing/refresh con Bearer', async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    await expect(refreshBackendPro(() => Promise.resolve('tok123'))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/billing/refresh'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('refreshBackendPro nunca lanza (best effort)', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('red')));
    await expect(refreshBackendPro(() => Promise.reject(new Error('sin token')))).resolves.toBe(false);
  });

  it('getBillingBaseUrl usa el backend único y respeta overrides', () => {
    const prevBilling = process.env.EXPO_PUBLIC_BILLING_URL;
    const prevApi = process.env.EXPO_PUBLIC_API_URL;
    try {
      delete process.env.EXPO_PUBLIC_BILLING_URL;
      delete process.env.EXPO_PUBLIC_API_URL;
      expect(getBillingBaseUrl()).toBe('https://expense-audio-analyzer.ai.studio');
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
      expect(getBillingBaseUrl()).toBe('https://api.example.com');
      process.env.EXPO_PUBLIC_BILLING_URL = 'https://billing.example.com';
      expect(getBillingBaseUrl()).toBe('https://billing.example.com');
    } finally {
      if (prevBilling === undefined) delete process.env.EXPO_PUBLIC_BILLING_URL;
      else process.env.EXPO_PUBLIC_BILLING_URL = prevBilling;
      if (prevApi === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = prevApi;
    }
  });
});
