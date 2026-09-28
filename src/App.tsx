import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PageSpinner } from "./components/ui/Spinner";
import { LoginPage } from "./pages/LoginPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RequestsListPage } from "./pages/requests/RequestsListPage";
import { RepairsListPage } from "./pages/repairs/RepairsListPage";
import { AnnouncementsListPage } from "./pages/announcements/AnnouncementsListPage";
import { DepartmentsPage } from "./pages/departments/DepartmentsPage";
import { UsersPage } from "./pages/users/UsersPage";
import { ItemsListPage } from "./pages/inventory/ItemsListPage";
import { MrListPage } from "./pages/inventory/MrListPage";
import { ParsPage } from "./pages/inventory/ParsPage";
import { CustodiansPage } from "./pages/inventory/CustodiansPage";
import { TechnicianReportPage } from "./pages/reports/TechnicianReportPage";

function App() {
  const { status } = useAuth();

  if (status === "loading") return <PageSpinner />;
  if (status === "signed-out") return <LoginPage />;
  if (status === "unauthorized") return <UnauthorizedPage />;

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="requests" element={<RequestsListPage />} />
        <Route path="repairs" element={<RepairsListPage />} />
        <Route path="announcements" element={<AnnouncementsListPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="inventory" element={<ItemsListPage />} />
        <Route path="inventory/pars" element={<ParsPage />} />
        <Route path="inventory/mr" element={<MrListPage />} />
        <Route path="inventory/custodians" element={<CustodiansPage />} />
        <Route path="reports/technician" element={<TechnicianReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
