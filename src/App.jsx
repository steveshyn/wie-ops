import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout        from './components/Layout'
import Login         from './pages/Login'
import SystemHealth  from './pages/SystemHealth'
import DataQuality   from './pages/DataQuality'
import WIQSScores    from './pages/WIQSScores'
import VintageHeatMap from './pages/VintageHeatMap'
import LookupTables  from './pages/LookupTables'
import AnnualVintage from './pages/AnnualVintage'
import AuditLog        from './pages/AuditLog'
import CustomerLayer   from './pages/CustomerLayer'
import CatalogBrowser  from './pages/CatalogBrowser'
import HealthDashboard from './pages/HealthDashboard'
import OverrideQueue   from './pages/OverrideQueue'
import TastingModel    from './pages/TastingModel'
import LwinCoverage         from './pages/LwinCoverage'
import PipelineOperations   from './pages/PipelineOperations'
import DataQualityMonitor   from './pages/DataQualityMonitor'

function ProtectedRoute({ title, children }) {
  const { isAuthed, logout } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Layout title={title} onLogout={logout}>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute title="System Health">
            <SystemHealth />
          </ProtectedRoute>
        } />
        <Route path="/quality" element={
          <ProtectedRoute title="Data Quality Workbench">
            <DataQuality />
          </ProtectedRoute>
        } />
        <Route path="/scores" element={
          <ProtectedRoute title="WIQS Scores">
            <WIQSScores />
          </ProtectedRoute>
        } />
        <Route path="/heatmap" element={
          <ProtectedRoute title="Vintage Heat Map">
            <VintageHeatMap />
          </ProtectedRoute>
        } />
        <Route path="/lookup" element={
          <ProtectedRoute title="Lookup Tables">
            <LookupTables />
          </ProtectedRoute>
        } />
        <Route path="/vintage" element={
          <ProtectedRoute title="Annual Vintage">
            <AnnualVintage />
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute title="Audit Log">
            <AuditLog />
          </ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute title="Customer Layer">
            <CustomerLayer />
          </ProtectedRoute>
        } />
        <Route path="/catalog" element={
          <ProtectedRoute title="Catalog">
            <CatalogBrowser />
          </ProtectedRoute>
        } />
        <Route path="/health" element={
          <ProtectedRoute title="Data Health">
            <HealthDashboard />
          </ProtectedRoute>
        } />
        <Route path="/overrides" element={
          <ProtectedRoute title="Override Queue">
            <OverrideQueue />
          </ProtectedRoute>
        } />
        <Route path="/tasting" element={
          <ProtectedRoute title="Tasting Model">
            <TastingModel />
          </ProtectedRoute>
        } />
        <Route path="/lwin" element={
          <ProtectedRoute title="LWIN Coverage">
            <LwinCoverage />
          </ProtectedRoute>
        } />
        <Route path="/pipelines" element={
          <ProtectedRoute title="Pipeline Operations">
            <PipelineOperations />
          </ProtectedRoute>
        } />
        <Route path="/dq-monitor" element={
          <ProtectedRoute title="Data Quality Monitor">
            <DataQualityMonitor />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
