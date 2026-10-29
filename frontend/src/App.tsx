import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth";
import Layout from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import Handoff from "./pages/Handoff";
import Login from "./pages/Login";
import TaskDetail from "./pages/TaskDetail";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<Tasks />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/handoff" element={<Handoff />} />
              <Route path="/team" element={<Team />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
