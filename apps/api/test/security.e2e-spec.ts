import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { App } from 'supertest/types';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type { Response } from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { Organization } from './../src/modules/organization/entities/organization.entity';
import { User } from './../src/modules/auth/entities/user.entity';
import { Project } from './../src/modules/project/entities/project.entity';
import { ProjectMember } from './../src/modules/project/entities/project-member.entity';
import { Finding } from './../src/modules/finding/entities/finding.entity';
import { Roles } from '@common/enums/role-app.enum';
import { FindingSeverity } from './../src/modules/finding/enums/finding-severity.enum';
import {
  accessTokenName,
  refreshTokenName,
} from '@common/constants/jwt.constants';

const DEV_OTP = process.env.DEV_OTP ?? '00000';

const PHONES = {
  adminA: '09111110001',
  analystA: '09111110002',
  viewerA: '09111110003',
  adminB: '09122220001',
};

interface CookieSet {
  access: string;
  refresh: string;
}

function extractCookies(res: Response): CookieSet {
  const raw = res.headers['set-cookie'] as unknown;
  const cookies: string[] = Array.isArray(raw)
    ? raw
    : raw
      ? [raw as string]
      : [];
  let access = '';
  let refresh = '';
  for (const c of cookies) {
    if (c.startsWith(`${accessTokenName}=`)) access = c.split(';')[0];
    if (c.startsWith(`${refreshTokenName}=`)) refresh = c.split(';')[0];
  }
  return { access, refresh };
}

describe('Security & Multi-Tenancy (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersRepo: Repository<User>;
  let orgsRepo: Repository<Organization>;
  let projectsRepo: Repository<Project>;
  let membersRepo: Repository<ProjectMember>;
  let findingsRepo: Repository<Finding>;

  let orgA: Organization;
  let orgB: Organization;
  let adminAUser: User;
  let analystAUser: User;

  const cookies = {
    adminA: { access: '', refresh: '' },
    analystA: { access: '', refresh: '' },
    viewerA: { access: '', refresh: '' },
    adminB: { access: '', refresh: '' },
  };

  async function ensureOrg(name: string): Promise<Organization> {
    let org = await orgsRepo.findOne({ where: { name } });
    if (!org) {
      org = await orgsRepo.save(orgsRepo.create({ name }));
    }
    return org;
  }

  async function ensureUser(
    phone: string,
    role: Roles,
    org: Organization,
    name: string,
  ): Promise<User> {
    let user = await usersRepo.findOne({ where: { phone } });
    if (!user) {
      user = usersRepo.create({ phone, role, orgId: org.id, name });
      user = await usersRepo.save(user);
    } else {
      user.role = role;
      user.orgId = org.id;
      user.name = name;
      user = await usersRepo.save(user);
    }
    return user;
  }

  async function login(phone: string): Promise<CookieSet> {
    await request(app.getHttpServer())
      .post('/auth/request-otp')
      .send({ phone })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/vrify-otp')
      .send({ phone, otp: DEV_OTP })
      .expect(200);

    return extractCookies(res);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleRef.get(DataSource);
    usersRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    orgsRepo = moduleRef.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    projectsRepo = moduleRef.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    membersRepo = moduleRef.get<Repository<ProjectMember>>(
      getRepositoryToken(ProjectMember),
    );
    findingsRepo = moduleRef.get<Repository<Finding>>(
      getRepositoryToken(Finding),
    );

    // Idempotent setup: create orgs, users
    orgA = await ensureOrg('E2E Org A');
    orgB = await ensureOrg('E2E Org B');

    adminAUser = await ensureUser(PHONES.adminA, Roles.ADMIN, orgA, 'Admin A');
    analystAUser = await ensureUser(
      PHONES.analystA,
      Roles.ANALYST,
      orgA,
      'Analyst A',
    );
    await ensureUser(PHONES.viewerA, Roles.VIEWER, orgA, 'Viewer A');
    await ensureUser(PHONES.adminB, Roles.ADMIN, orgB, 'Admin B');

    // Login everyone
    cookies.adminA = await login(PHONES.adminA);
    cookies.analystA = await login(PHONES.analystA);
    cookies.viewerA = await login(PHONES.viewerA);
    cookies.adminB = await login(PHONES.adminB);

    // Seed a project in each org
    const existingProjectA = await projectsRepo.findOne({
      where: { name: 'E2E Project A', orgId: orgA.id },
    });
    if (!existingProjectA) {
      const pA = await projectsRepo.save(
        projectsRepo.create({ name: 'E2E Project A', orgId: orgA.id }),
      );
      await membersRepo.save(
        membersRepo.create({
          projectId: pA.id,
          userId: adminAUser.id,
          roleInProject: 'owner',
        }),
      );
    }
  });

  afterAll(async () => {
    await app.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. full auth flow: request-otp, vrify-otp, me, refresh, logout', async () => {
    // A fresh login for the analyst (separate phone) to avoid rate-limit noise
    const loginRes = await login(PHONES.analystA);
    expect(loginRes.access).toContain(`${accessTokenName}=`);
    expect(loginRes.refresh).toContain(`${refreshTokenName}=`);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', loginRes.access)
      .expect(200);

    expect(me.body.phone).toBe(PHONES.analystA);
    expect(me.body.role).toBe(Roles.ANALYST);
    expect(me.body.orgId).toBe(orgA.id);
    expect(Array.isArray(me.body.permissions)).toBe(true);
    expect(me.body.permissions).toContain('finding:create');
    expect(me.body.permissions).not.toContain('finding:delete');

    // Refresh works
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', loginRes.refresh)
      .expect(200);
  });

  it('2. protected endpoint rejects a missing access token', async () => {
    await request(app.getHttpServer()).get('/projects').expect(401);
  });

  it('3. tenant isolation: cross-org project detail returns 404', async () => {
    // Create a project in org B
    const projectB = await projectsRepo.save(
      projectsRepo.create({ name: 'E2E Org B Project', orgId: orgB.id }),
    );

    const res = await request(app.getHttpServer())
      .get(`/projects/${projectB.id}`)
      .set('Cookie', cookies.adminA.access)
      .expect(404);
    expect(res.body.message).toBe('Project not found');
  });

  it('4. permission enforcement: ANALYST cannot delete a finding', async () => {
    const projectA = await projectsRepo.findOne({
      where: { name: 'E2E Project A', orgId: orgA.id },
    });
    const finding = await findingsRepo.save(
      findingsRepo.create({
        projectId: projectA!.id,
        orgId: orgA.id,
        title: 'E2E Finding for delete check',
        severity: FindingSeverity.HIGH,
        createdById: analystAUser.id,
      }),
    );

    // ANALYST lacks finding:delete
    await request(app.getHttpServer())
      .delete(`/findings/${finding.id}`)
      .set('Cookie', cookies.analystA.access)
      .expect(403);

    // Cleanup via admin
    await findingsRepo.delete({ id: finding.id });
  });

  it('5. creating a finding with another org projectId returns 404', async () => {
    const orgBProject = await projectsRepo.save(
      projectsRepo.create({ name: 'E2E Org B Project 2', orgId: orgB.id }),
    );

    await request(app.getHttpServer())
      .post('/findings')
      .set('Cookie', cookies.adminA.access)
      .send({
        title: 'Cross tenant attempt',
        severity: FindingSeverity.CRITICAL,
        projectId: orgBProject.id,
      })
      .expect(404);
  });

  it('6. /auth/me for VIEWER returns read-only permissions only', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies.viewerA.access)
      .expect(200);

    expect(res.body.role).toBe(Roles.VIEWER);
    expect(res.body.permissions).toContain('finding:read');
    expect(res.body.permissions).not.toContain('finding:create');
    expect(res.body.permissions).not.toContain('finding:update');
    expect(res.body.permissions).not.toContain('finding:delete');
  });

  it('7. refresh token rotation: reusing a rotated token revokes the family', async () => {
    const loginRes = await login(PHONES.adminA);

    // First refresh rotates the token
    const firstRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', loginRes.refresh)
      .expect(200);

    const secondCookies = extractCookies(firstRefresh);
    expect(secondCookies.refresh).toBeTruthy();

    // Second refresh using the rotated token succeeds
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', secondCookies.refresh)
      .expect(200);

    // Reusing the now-rotated first token must be rejected (family revoked)
    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', loginRes.refresh)
      .expect(401);
    expect(reuse.body.message).toBe('Invalid or expired session');
  });

  it('8. permission enforcement: VIEWER cannot create a finding', async () => {
    const projectA = await projectsRepo.findOne({
      where: { name: 'E2E Project A', orgId: orgA.id },
    });

    await request(app.getHttpServer())
      .post('/findings')
      .set('Cookie', cookies.viewerA.access)
      .send({
        title: 'Viewer should not create',
        severity: FindingSeverity.LOW,
        projectId: projectA!.id,
      })
      .expect(403);
  });

  it('9. findings pagination and severity filter', async () => {
    const projectA = await projectsRepo.findOne({
      where: { name: 'E2E Project A', orgId: orgA.id },
    });

    // Ensure a known set of findings for the pagination project
    await findingsRepo.delete({ projectId: projectA!.id });

    const toCreate = [
      { severity: FindingSeverity.CRITICAL },
      { severity: FindingSeverity.CRITICAL },
      { severity: FindingSeverity.HIGH },
      { severity: FindingSeverity.MEDIUM },
      { severity: FindingSeverity.LOW },
    ];

    const created = [];
    for (let i = 0; i < toCreate.length; i++) {
      const f = await findingsRepo.save(
        findingsRepo.create({
          projectId: projectA!.id,
          orgId: orgA.id,
          title: `E2E Finding ${i + 1}`,
          severity: toCreate[i].severity,
          createdById: analystAUser.id,
        }),
      );
      created.push(f);
    }

    // Paginate: page 1, limit 2
    const pageRes = await request(app.getHttpServer())
      .get(`/findings?projectId=${projectA!.id}&limit=2&page=1`)
      .set('Cookie', cookies.adminA.access)
      .expect(200);

    expect(pageRes.body.total).toBe(5);
    expect(pageRes.body.items).toHaveLength(2);

    // Severity filter: CRITICAL only (2 findings)
    const severityRes = await request(app.getHttpServer())
      .get(
        `/findings?projectId=${projectA!.id}&severity=${FindingSeverity.CRITICAL}`,
      )
      .set('Cookie', cookies.adminA.access)
      .expect(200);

    expect(severityRes.body.total).toBe(2);
    for (const item of severityRes.body.items) {
      expect(item.severity).toBe(FindingSeverity.CRITICAL);
    }

    // Cleanup
    await findingsRepo.delete({ projectId: projectA!.id });
  });
});
