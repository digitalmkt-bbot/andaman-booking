import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WeekSchedule from './pages/WeekSchedule.jsx';
import BookVehicle from './pages/BookVehicle.jsx';
import BookRoom from './pages/BookRoom.jsx';
import MyBookings from './pages/MyBookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';

import AllBookings from './pages/admin/AllBookings.jsx';
import Resources from './pages/admin/Resources.jsx';
import Blocks from './pages/admin/Blocks.jsx';
import Users from './pages/admin/Users.jsx';
import Departments from './pages/admin/Departments.jsx';
import Reports from './pages/admin/Reports.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';
import Settings from './pages/admin/Settings.jsx';

function Protected({ children, adminOnly }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/calendar" element={<Protected><WeekSchedule /></Protected>} />
      <Route path="/book/vehicle" element={<Protected><BookVehicle /></Protected>} />
      <Route path="/book/room" element={<Protected><BookRoom /></Protected>} />
      <Route path="/my-bookings" element={<Protected><MyBookings /></Protected>} />
      <Route path="/bookings/:id" element={<Protected><BookingDetail /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />

      <Route path="/admin/bookings" element={<Protected adminOnly><AllBookings /></Protected>} />
      <Route path="/admin/resources" element={<Protected adminOnly><Resources /></Protected>} />
      <Route path="/admin/blocks" element={<Protected adminOnly><Blocks /></Protected>} />
      <Route path="/admin/users" element={<Protected adminOnly><Users /></Protected>} />
      <Route path="/admin/departments" element={<Protected adminOnly><Departments /></Protected>} />
      <Route path="/admin/reports" element={<Protected adminOnly><Reports /></Protected>} />
      <Route path="/admin/audit" element={<Protected adminOnly><AuditLog /></Protected>} />
      <Route path="/admin/settings" element={<Protected adminOnly><Settings /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
