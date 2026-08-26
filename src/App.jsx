import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import { Spinner } from './ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewTicket from './pages/NewTicket'
import TicketList from './pages/TicketList'
import TicketDetail from './pages/TicketDetail'
import Queue from './pages/Queue'
import Assets from './pages/Assets'
import Reports from './pages/Reports'
import Users from './pages/admin/Users'
import Catalog from './pages/admin/Catalog'
import Organization from './pages/admin/Organization'
import Audit from './pages/admin/Audit'
import Knowledge from './pages/Knowledge'
import KbArticle from './pages/KbArticle'
import ServiceCatalog from './pages/ServiceCatalog'
import Requests from './pages/Requests'
import RequestDetail from './pages/RequestDetail'
import Sla from './pages/admin/Sla'
import Automation from './pages/admin/Automation'
import Integrations from './pages/admin/Integrations'
import Cmdb from './pages/Cmdb'
import Problems from './pages/Problems'
import ProblemDetail from './pages/ProblemDetail'
import Changes from './pages/Changes'
import ChangeDetail from './pages/ChangeDetail'
import Analytics from './pages/Analytics'

function Guard({ children, roles }) {
  const { user, booting } = useAuth()
  if (booting) return <div className="loading-page"><Spinner dark /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

const IT = ['AGENT', 'TEAM_LEAD', 'ADMIN']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewTicket />} />
        <Route path="/tickets" element={<TicketList />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/queue" element={<Guard roles={IT}><Queue /></Guard>} />
        <Route path="/assets" element={<Guard roles={IT}><Assets /></Guard>} />
        <Route path="/reports" element={<Guard roles={IT}><Reports /></Guard>} />
        {/* STANDARD phase (BRD section 7) */}
        <Route path="/kb" element={<Knowledge />} />
        <Route path="/kb/:id" element={<KbArticle />} />
        <Route path="/catalog" element={<ServiceCatalog />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/admin/users" element={<Guard roles={['ADMIN']}><Users /></Guard>} />
        <Route path="/admin/catalog" element={<Guard roles={['ADMIN']}><Catalog /></Guard>} />
        <Route path="/admin/org" element={<Guard roles={['ADMIN']}><Organization /></Guard>} />
        <Route path="/admin/audit" element={<Guard roles={['ADMIN']}><Audit /></Guard>} />
        {/* ADVANCED phase (BRD section 8) */}
        <Route path="/cmdb" element={<Guard roles={IT}><Cmdb /></Guard>} />
        <Route path="/problems" element={<Guard roles={IT}><Problems /></Guard>} />
        <Route path="/problems/:id" element={<Guard roles={IT}><ProblemDetail /></Guard>} />
        <Route path="/changes" element={<Guard roles={IT}><Changes /></Guard>} />
        <Route path="/changes/:id" element={<Guard roles={IT}><ChangeDetail /></Guard>} />
        <Route path="/analytics" element={<Guard roles={IT}><Analytics /></Guard>} />
        <Route path="/admin/sla" element={<Guard roles={['ADMIN']}><Sla /></Guard>} />
        <Route path="/admin/automation" element={<Guard roles={['ADMIN']}><Automation /></Guard>} />
        <Route path="/admin/integrations" element={<Guard roles={['ADMIN']}><Integrations /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
