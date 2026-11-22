import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PipelineProvider } from './context/PipelineContext';
import { IS_PREVIEW_MODE } from './config/env';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { StatePanel } from './components/ui';

// Halaman dimuat saat dibutuhkan agar peta, grafik, dan modul admin
// tidak ikut membebani pemuatan awal aplikasi.
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(() => import('./pages/public/HomePage').then((module) => ({ default: module.HomePage })));
const ClusterMapPage = lazy(() => import('./pages/public/ClusterMapPage').then((module) => ({ default: module.ClusterMapPage })));
const AnalysisPage = lazy(() => import('./pages/public/AnalysisPage').then((module) => ({ default: module.AnalysisPage })));
const RealtimePage = lazy(() => import('./pages/public/RealtimePage').then((module) => ({ default: module.RealtimePage })));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DatasetPage = lazy(() => import('./pages/admin/DatasetPage').then((module) => ({ default: module.DatasetPage })));
const ValidationPage = lazy(() => import('./pages/admin/ValidationPage').then((module) => ({ default: module.ValidationPage })));
const ParameterSearchPage = lazy(() => import('./pages/admin/ParameterSearchPage').then((module) => ({ default: module.ParameterSearchPage })));
const FinalDbscanPage = lazy(() => import('./pages/admin/FinalDbscanPage').then((module) => ({ default: module.FinalDbscanPage })));
const RunHistoryPage = lazy(() => import('./pages/admin/RunHistoryPage').then((module) => ({ default: module.RunHistoryPage })));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage').then((module) => ({ default: module.AuditLogPage })));
const JobManagementPage = lazy(() => import('./pages/admin/JobManagementPage').then((module) => ({ default: module.JobManagementPage })));

function AdminGate() {
  const { authenticated, loading } = useAuth();
  if (IS_PREVIEW_MODE) return <AdminLayout />;
  if (loading) return <div className="route-loading"><StatePanel type="loading" title="Memeriksa sesi" message="Memeriksa status masuk administrator." /></div>;
  if (!authenticated) return <Navigate to="/admin/login" replace />;
  return <AdminLayout />;
}

function RouteTree() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/peta-klaster" element={<ClusterMapPage />} />
      <Route path="/webgis" element={<Navigate to="/peta-klaster" replace />} />
      <Route path="/analisis" element={<AnalysisPage />} />
      <Route path="/gempa-terkini" element={<RealtimePage />} />
      <Route path="/gempa-realtime" element={<Navigate to="/gempa-terkini" replace />} />
    </Route>
    <Route path="/admin/login" element={<LoginPage />} />
    <Route path="/admin" element={<AdminGate />}>
      <Route index element={<DashboardPage />} />
      <Route path="dataset" element={<DatasetPage />} />
      <Route path="datasets" element={<Navigate to="/admin/dataset" replace />} />
      <Route path="validasi" element={<ValidationPage />} />
      <Route path="parameter" element={<ParameterSearchPage />} />
      <Route path="jobs" element={<JobManagementPage />} />
      <Route path="dbscan-final" element={<FinalDbscanPage />} />
      <Route path="riwayat-run" element={<RunHistoryPage />} />
      <Route path="audit-log" element={<AuditLogPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter>
    <AuthProvider>
      <PipelineProvider>
        <Suspense fallback={<div className="route-loading"><StatePanel type="loading" title="Memuat halaman" message="Menyiapkan komponen SEISMAP." /></div>}>
          <RouteTree />
        </Suspense>
      </PipelineProvider>
    </AuthProvider>
  </BrowserRouter>;
}
