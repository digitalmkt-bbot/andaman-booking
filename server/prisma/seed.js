import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---- Departments ----
  const depts = [
    { departmentCode: 'SEC', departmentName: 'SECRETARY' },
    { departmentCode: 'HR', departmentName: 'HUMAN RESOURCES' },
    { departmentCode: 'ACC', departmentName: 'ACCOUNTING & FINANCE' },
    { departmentCode: 'PUR', departmentName: 'PURCHASE' },
    { departmentCode: 'MKT', departmentName: 'MARKETING' },
    { departmentCode: 'BD', departmentName: 'BUSINESS DEVELOPMENT' },
    { departmentCode: 'PR', departmentName: 'PUBLIC RELATIONS' },
    { departmentCode: 'GFX', departmentName: 'GRAPHIC' },
    { departmentCode: 'SA', departmentName: 'SALES AGENT' },
    { departmentCode: 'RSV', departmentName: 'RESERVATION' },
    { departmentCode: 'SONL', departmentName: 'SALE ONLINE' },
    { departmentCode: 'SRV', departmentName: 'SERVICE' },
    { departmentCode: 'MEC', departmentName: 'MECHANIC' },
    { departmentCode: 'PKTP', departmentName: 'PHUKET PIER' },
    { departmentCode: 'TLP', departmentName: 'TAP LAMU PIER' },
    { departmentCode: 'RNGP', departmentName: 'RANONG PIER' },
    { departmentCode: 'TLPS', departmentName: 'TAP LAMU PIER SHOP' },
    { departmentCode: 'SC', departmentName: 'SALE COUNTER' },
  ];
  for (const d of depts) {
    await prisma.department.upsert({
      where: { departmentCode: d.departmentCode },
      update: { departmentName: d.departmentName, status: 'ACTIVE' },
      create: d,
    });
  }
  // Remove legacy placeholder departments that are not part of the official list.
  for (const code of ['ADMIN', 'OPS', 'FIN']) {
    try { await prisma.department.deleteMany({ where: { departmentCode: code } }); } catch { /* referenced — keep */ }
  }
  const mktDept = await prisma.department.findUnique({ where: { departmentCode: 'MKT' } });

  // ---- Users ----
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('user123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@loveandaman.com' },
    update: {},
    create: {
      employeeCode: 'EMP001',
      fullName: 'ผู้ดูแลระบบ / System Admin',
      email: 'admin@loveandaman.com',
      phone: '0800000001',
      passwordHash: adminHash,
      role: 'ADMIN',
      departmentId: null,
    },
  });

  // Shared public account — the app auto-signs-in as this user so no login is required.
  const guestHash = await bcrypt.hash('guest', 10);
  await prisma.user.upsert({
    where: { email: 'guest@loveandaman.com' },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      employeeCode: 'GUEST',
      fullName: 'ผู้ใช้งาน / Guest',
      email: 'guest@loveandaman.com',
      passwordHash: guestHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      departmentId: null,
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@loveandaman.com' },
    update: {},
    create: {
      employeeCode: 'EMP002',
      fullName: 'พนักงานทดสอบ / Test User',
      email: 'user@loveandaman.com',
      phone: '0800000002',
      passwordHash: userHash,
      role: 'USER',
      departmentId: mktDept?.id,
    },
  });

  // ---- Vehicles (5) ----
  const vehicles = [
    { code: 'VEH-KIA', name: 'Kia', plate: 'กข 1001', color: 'ขาว / White' },
    { code: 'VEH-BYD', name: 'BYD', plate: 'กข 1002', color: 'ดำ / Black' },
    { code: 'VEH-FOR', name: 'Fortuner', plate: 'กข 1003', color: 'เทา / Grey' },
    { code: 'VEH-VIO', name: 'Vios', plate: 'กข 1004', color: 'เงิน / Silver' },
    { code: 'VEH-MIR', name: 'Mirage', plate: 'กข 1005', color: 'แดง / Red' },
  ];
  for (const v of vehicles) {
    const resource = await prisma.resource.upsert({
      where: { resourceCode: v.code },
      update: { resourceName: v.name },
      create: {
        resourceType: 'VEHICLE',
        resourceCode: v.code,
        resourceName: v.name,
        status: 'AVAILABLE',
        active: true,
      },
    });
    await prisma.vehicle.upsert({
      where: { resourceId: resource.id },
      update: {},
      create: {
        resourceId: resource.id,
        vehicleName: v.name,
        licensePlate: v.plate,
        color: v.color,
      },
    });
  }

  // ---- Meeting Room (1) ----
  const roomResource = await prisma.resource.upsert({
    where: { resourceCode: 'ROOM-MAIN' },
    update: {},
    create: {
      resourceType: 'MEETING_ROOM',
      resourceCode: 'ROOM-MAIN',
      resourceName: 'ห้องประชุมหลัก / Main Meeting Room',
      status: 'AVAILABLE',
      active: true,
    },
  });
  await prisma.meetingRoom.upsert({
    where: { resourceId: roomResource.id },
    update: {},
    create: {
      resourceId: roomResource.id,
      roomName: 'ห้องประชุมหลัก / Main Meeting Room',
      location: 'ชั้น 2 / 2nd Floor',
      openingTime: '08:00',
      closingTime: '18:00',
    },
  });

  console.log('Seed complete.');
  console.log('  Admin login: admin@loveandaman.com / admin123');
  console.log('  User login:  user@loveandaman.com / user123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
