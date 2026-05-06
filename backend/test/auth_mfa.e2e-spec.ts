import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { resetBefore, resetAfter } from './shared';
import { AuthService } from '../src/modules/auth-candidate/auth.candidate.service';

describe('Auth MFA (e2e)', () => {
  let app: INestApplication;
  let testId: string;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const setup = await resetBefore();
    app = setup.app;
    testId = setup.id;

    // Register and verify a user for MFA tests
    const email = `mfa-e2e-${testId}@example.com`;
    const regRes = await request(app.getHttpServer())
      .post('/auth/candidate/register')
      .send({ email, password: 'StrongPassword123!', role: 'CANDIDATE' })
      .expect(302);

    userId = await setup.prisma.user
      .findUnique({ where: { email } })
      .then((u) => u!.id);
    await setup.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true } as any,
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/candidate/login')
      .send({ identifier: email, password: 'StrongPassword123!' })
      .expect(201);

    accessToken = loginRes.body.accessToken;
  });

  afterEach(async () => {
    await resetAfter(app);
  });

  it('should complete full MFA lifecycle', async () => {
    // 1. Setup MFA
    const setupRes = await request(app.getHttpServer())
      .get('/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(setupRes.body.qrCode).toBeDefined();
    const secret = setupRes.body.secret;

    // 2. Activate MFA
    const authenticator = app.get(AuthService).getAuthenticator();
    const code = authenticator.generate(secret);

    const activateRes = await request(app.getHttpServer())
      .post('/auth/mfa/activate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(201);

    expect(activateRes.body.backupCodes).toHaveLength(10);
    const backupCode = activateRes.body.backupCodes[0];

    // 3. Login with MFA
    const loginRes = await request(app.getHttpServer())
      .post('/auth/candidate/login')
      .send({
        identifier: `mfa-e2e-${testId}@example.com`,
        password: 'StrongPassword123!',
      })
      .expect(201);

    expect(loginRes.body.mfaRequired).toBe(true);
    const mfaToken = loginRes.body.mfaToken;

    // 4. Verify MFA
    const verifyCode = authenticator.generate(secret);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/mfa/verify')
      .send({ code: verifyCode, mfaToken, userId })
      .expect(201);

    expect(verifyRes.body.accessToken).toBeDefined();

    // 5. Recovery with backup code
    const recoveryRes = await request(app.getHttpServer())
      .post('/auth/mfa/verify-recovery')
      .send({ backupCode, mfaToken, userId })
      .expect(201);

    expect(recoveryRes.body.accessToken).toBeDefined();

    // 6. Backup code should be one-time use
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/mfa/verify-recovery')
      .send({ backupCode, mfaToken, userId })
      .expect(401);
  });
});
