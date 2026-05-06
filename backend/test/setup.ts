process.env.NODE_ENV = 'test';
process.env.JEST_E2E = 'true';

process.env.DATABASE_URL ??=
'postgresql://postgres:strong@localhost:5432/16signals?schema=public&connection_limit=5&connect_timeout=10';

jest.mock(
  'otplib',
  () => {
    return {
      TOTP: jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockReturnValue('123456'),
        verify: jest.fn().mockReturnValue(true),
        generateSecret: jest.fn().mockReturnValue('mock_secret'),
        keyuri: jest.fn().mockReturnValue('otp_uri'),
      })),
      NobleCryptoPlugin: jest.fn(),
      ScureBase32Plugin: jest.fn(),
    };
  },
  { virtual: true },
);
