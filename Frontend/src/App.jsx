import { ToastContainer } from "react-toastify"
import { Navigate, Route, Routes } from "react-router-dom"
import Login from "./pages/login"
import "react-toastify/dist/ReactToastify.css"
import Super_admin_dashboard from "./pages/super_admin/super_admin_dashboard"
import Tech_admin_dashboard from "./pages/tech_admin/tech_admin_dashboard"
import Team_member_dashboard from "./pages/team_member/team_member_dashboard"

function App() {
    return (
        <>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route
                    path="/S_admin/dashboard"
                    element={<Super_admin_dashboard />}
                />

                <Route
                    path="/t_admin/dashboard"
                    element={<Tech_admin_dashboard />}
                />

                <Route
                    path="/team_member/dashboard"
                    element={<Team_member_dashboard />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <ToastContainer
                position="top-right"
                autoClose={3000}
            />
        </>
    )
}

export default App
