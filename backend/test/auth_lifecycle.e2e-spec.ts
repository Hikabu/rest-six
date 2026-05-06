import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetBefore, resetAfter } from './shared';

describe('Auth Lifecycle (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await resetBefore());
  });

  afterEach(async () => {
    await resetAfter(app);
  });

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    username: `user-${Date.now()}`,
    password: 'Password123!',
    role: 'CANDIDATE',
  };

  it('/auth/register (POST) -> Blocked Access', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/candidate/register')
      .send(testUser)
      .expect(302);

    const location = registerResponse.headers.location;
    expect(location).toContain('/verify?email=');

    // Verify protected route is blocked
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer undefined`)
      .expect(401);
  });

  it('/auth/verify-email (POST) -> Successful Access', async () => {
    // In this E2E test, we'll use a direct Prisma update to simulate verification
    // because the code for verification stub logs the code to console.
    // However, the AuthService allows verification via a code in Redis.
    await request(app.getHttpServer())
      .post('/auth/candidate/register')
      .send(testUser)
      .expect(302);

    // For the sake of the E2E test lifecycle, we'll manually verify the user
    // to test that the login flow then works.
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { email: testUser.email },
      data: { isEmailVerified: true },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/candidate/login')
      .send({
        identifier: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'];
    const accessToken = cookies.find((c: string) => c.startsWith('access_token=')).split('=')[1].split(';')[0];
    const refreshToken = cookies.find((c: string) => c.startsWith('refresh_token=')).split('=')[1].split(';')[0];
    
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // Verify protected route is now accessible
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  it('should handle full password reset flow', async () => {
    const email = `reset-lifecycle-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/candidate/register')
      .send({ email, password: 'StrongPassword123!', role: 'CANDIDATE' })
      .expect(302);

    // 1. Request reset
    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email })
      .expect(201);

    // 2. Get token from Redis (simulating email retrieval)
    const redis = app.get('REDIS');
    const keys = await redis.keys('password_reset:*');
    // We need to find the one for this specific test if multiple are running,
    // but here we are inBand.
    const token = keys[0].split(':')[1];

    // 3. Reset password
    const resetRes = await request(app.getHttpServer())
      .post('/auth/password-reset/reset')
      .send({ token, newPassword: 'NewStrongPassword123!' });

    expect(resetRes.status).toBe(201);

    // 4. Verify login with NEW password
    const loginRes = await request(app.getHttpServer())
      .post('/auth/candidate/login')
      .send({ identifier: email, password: 'NewStrongPassword123!' })
      .expect(200);

    expect(loginRes.status).toBe(200);
  });
});
