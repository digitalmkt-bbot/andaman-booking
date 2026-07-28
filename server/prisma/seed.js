import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---- Departments ----
  const depts = [
    { departmentCode: 'ADMIN', departmentName: 'สำนักงานบริหาร / Administration' },
    { departmentCode: 'MKT', departmentName: 'การตลาด / Marketing' },
    { departmentCode: 'OPS', departmentName: 'ปฏิบัติการ / Operations' },
    { departmentCode: 'FIN', departmentName: 'การเงิน / Finance' },
  ];
  for (const d of depts) {
    await prisma.department.upsert({
      where: { departmentCode: d.departmentCode },
      update: {},
      create: d,
    });
  }
  const adminDept = await prisma.department.findUnique({ where: { departmentCode: 'ADMIN' } });
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
      departmentId: adminDept?.id,
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
