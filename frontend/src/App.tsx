import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth";
import Layout from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import CreateTask from "./pages/CreateTask";
import Dashboard from "./pages/Dashboard";
import Handoff from "./pages/Handoff";
import Login from "./pages/Login";
import TaskDetail from "./pages/TaskDetail";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks/new" element={<CreateTask />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/handoff" element={<Handoff />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
