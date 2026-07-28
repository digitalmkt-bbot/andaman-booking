// Insert varied demo bookings (active / upcoming / completed / cancelled)
// so the dashboard, calendar, my-bookings and reports look populated.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const HOUR = 3600000;
const now = Date.now();

async function res(code) {
  return prisma.resource.findUnique({ where: { resourceCode: code } });
}
async function user(email) {
  return prisma.user.findUnique({ where: { email }, include: { department: true } });
}

let seq = {};
function num(type, d) {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' })
    .formatToParts(d).reduce((a, p) => (p.type === 'year' ? { ...a, y: p.value } : p.type === 'month' ? { ...a, m: p.value } : a), {});
  const key = `${type}-${ym.y}${ym.m}`;
  seq[key] = (seq[key] || 0) + 1;
  const prefix = type === 'MEETING_ROOM' ? 'ROOM' : 'VEH';
  return `${prefix}-${ym.y}${ym.m}-${String(seq[key]).padStart(4, '0')}`;
}

async function book({ type, code, email, startOffset, durationH, status, purpose, cancelReason }) {
  const r = await res(code);
  const u = await user(email);
  const start = new Date(now + startOffset);
  const end = new Date(now + startOffset + durationH * HOUR);
  return prisma.booking.create({
    data: {
      bookingNumber: num(type, start),
      bookingType: type,
      requesterId: u.id,
      departmentId: u.departmentId,
      resourceId: r.id,
      startDatetime: start,
      endDatetime: end,
      purpose: purpose || null,
      status,
      cancelledAt: status === 'CANCELLED' ? new Date(now - 2 * HOUR) : null,
      cancelledById: status === 'CANCELLED' ? u.id : null,
      cancellationReason: cancelReason || null,
    },
  });
}

async function main() {
  await prisma.booking.deleteMany({});
  const A = 'admin@loveandaman.com';
  const U = 'user@loveandaman.com';

  // Active now (in use)
  await book({ type: 'VEHICLE', code: 'VEH-KIA', email: U, startOffset: -1 * HOUR, durationH: 3, status: 'ACTIVE', purpose: 'รับส่งลูกค้าสนามบิน / Airport transfer' });
  await book({ type: 'MEETING_ROOM', code: 'ROOM-MAIN', email: A, startOffset: -0.5 * HOUR, durationH: 2, status: 'ACTIVE', purpose: 'ประชุมทีมการตลาด' });

  // Upcoming today / soon
  await book({ type: 'VEHICLE', code: 'VEH-BYD', email: U, startOffset: 3 * HOUR, durationH: 4, status: 'CONFIRMED', purpose: 'ประชุมนอกสถานที่ / Off-site meeting' });
  await book({ type: 'VEHICLE', code: 'VEH-FOR', email: A, startOffset: 26 * HOUR, durationH: 8, status: 'CONFIRMED', purpose: 'สำรวจพื้นที่ทัวร์ / Site survey' });
  await book({ type: 'VEHICLE', code: 'VEH-VIO', email: U, startOffset: 50 * HOUR, durationH: 3, status: 'CONFIRMED', purpose: 'ส่งเอกสารธนาคาร' });
  await book({ type: 'MEETING_ROOM', code: 'ROOM-MAIN', email: U, startOffset: 5 * HOUR, durationH: 1, status: 'CONFIRMED', purpose: 'สัมภาษณ์พนักงาน' });
  await book({ type: 'MEETING_ROOM', code: 'ROOM-MAIN', email: A, startOffset: 28 * HOUR, durationH: 2, status: 'CONFIRMED', purpose: 'ประชุมประจำสัปดาห์' });

  // Completed (past) — for reports/history
  const codes = ['VEH-KIA', 'VEH-BYD', 'VEH-KIA', 'VEH-MIR', 'VEH-FOR'];
  const purposes = ['รับส่งลูกค้า', 'ประชุมนอกสถานที่', 'รับส่งลูกค้า', 'ส่งเอกสาร', 'สำรวจพื้นที่ทัวร์'];
  for (let i = 0; i < codes.length; i++) {
    await book({ type: 'VEHICLE', code: codes[i], email: i % 2 ? A : U, startOffset: -(24 * (i + 2)) * HOUR, durationH: 2 + (i % 3), status: 'COMPLETED', purpose: purposes[i] });
  }
  for (let i = 0; i < 4; i++) {
    await book({ type: 'MEETING_ROOM', code: 'ROOM-MAIN', email: i % 2 ? A : U, startOffset: -(24 * (i + 2)) * HOUR + 3 * HOUR, durationH: 1 + (i % 2), status: 'COMPLETED', purpose: 'ประชุมทีม' });
  }

  // Cancelled
  await book({ type: 'VEHICLE', code: 'VEH-MIR', email: U, startOffset: 48 * HOUR, durationH: 2, status: 'CANCELLED', purpose: 'ยกเลิกเนื่องจากเปลี่ยนแผน', cancelReason: 'เปลี่ยนแผนการเดินทาง' });

  // A resource block on Fortuner (maintenance) next week
  const fort = await res('VEH-FOR');
  const admin = await user(A);
  await prisma.resourceBlock.create({
    data: {
      resourceId: fort.id,
      startDatetime: new Date(now + 24 * 5 * HOUR),
      endDatetime: new Date(now + 24 * 6 * HOUR),
      blockType: 'MAINTENANCE',
      reason: 'ตรวจเช็คระยะ 20,000 กม.',
      createdById: admin.id,
      status: 'ACTIVE',
    },
  });

  // Notifications for the user
  const u = await user(U);
  await prisma.notification.createMany({
    data: [
      { userId: u.id, notificationType: 'BOOKING_CREATED', channel: 'IN_APP', message: 'จองสำเร็จ / Booking confirmed (VEH-202607-0001)' },
      { userId: u.id, notificationType: 'REMINDER', channel: 'IN_APP', message: 'แจ้งเตือนก่อนถึงเวลาใช้งาน — BYD เริ่มใน 30 นาที' },
    ],
  });

  console.log('Demo data inserted.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
