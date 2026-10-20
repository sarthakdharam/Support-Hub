
import { useState } from "react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import logo from "../assets/logo.png"
import "./login.css"

function Login() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const navigate = useNavigate()

    async function handleSubmit(event) {
        event.preventDefault()

        if (isSubmitting) return

        if (!username.trim() || !password) {
            toast.error("Please enter username and password")
            return
        }

        setIsSubmitting(true)

        try {
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            })

            const data = await response.json()

            if (!response.ok) {
                toast.error(data.message || "Login failed")
                return
            }

            localStorage.setItem("accessToken", data.accessToken)
            localStorage.setItem("refreshToken", data.refreshToken)
            localStorage.setItem("role", data.role)

            if (data.role === "SUPER_ADMIN") {
                navigate("/S_admin/dashboard")
            } else if (data.role === "TECH_ADMIN") {
                navigate("/t_admin/dashboard")
            } else if (data.role === "TEAM_MEMBER") {
                navigate("/team_member/dashboard")
            } else {
                toast.error("Invalid user role")
            }

        } catch (err) {
            console.error(err)
            toast.error("Something went wrong. Try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="login-container">

            <div className="left-container">
                <h1>Welcome to SupportHub</h1>
                <p>
                    Manage your IT tickets and support requests
                    in one place.
                </p>
                <img className='login-logo' src={logo} alt="SupportHub" />
            </div>

            <div className="right-container">
                <h2>Login</h2>

                <p className="login-subtitle">
                    Welcome back! Please enter your credentials.
                </p>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        autoComplete="username"
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                    />

                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Logging in..." : "Login"}
                    </button>
                </form>
            </div>

        </div>
    )
}

export default Login
