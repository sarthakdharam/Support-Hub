import { useState } from "react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import logo from "../assets/logo.png"
import "./login.css"

const API_URL = "http://localhost:3000/api"

function Login() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState({})
    const navigate = useNavigate()

    async function handleSubmit(event) {
        event.preventDefault()
        if (isSubmitting) return

        const cleanUsername = username.trim()
        const errors = {}
        if (!cleanUsername) errors.username = "Username is required."
        if (!password) errors.password = "Password is required."
        if (Object.keys(errors).length) {
            setFieldErrors(errors)
            toast.error(Object.values(errors)[0])
            return
        }
        setFieldErrors({})

        setIsSubmitting(true)
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: cleanUsername, password })
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                toast.error(data.message || "Unable to sign in. Check your details and try again.")
                return
            }

            const destinations = {
                SUPER_ADMIN: "/S_admin/dashboard",
                TECH_ADMIN: "/t_admin/dashboard",
                TEAM_MEMBER: "/team_member/dashboard"
            }
            const destination = destinations[data.role]
            if (!destination || !data.accessToken || !data.refreshToken) {
                toast.error("The server returned an incomplete sign-in response")
                return
            }

            localStorage.setItem("accessToken", data.accessToken)
            localStorage.setItem("refreshToken", data.refreshToken)
            localStorage.setItem("role", data.role)
            navigate(destination)
        } catch (error) {
            console.error(error)
            toast.error("Could not connect to SupportHub. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="login-page">
            <section className="login-hero" aria-label="About SupportHub">
                <div className="login-hero-glow login-glow-one" />
                <div className="login-hero-glow login-glow-two" />
                <div className="login-brand">
                    <img src={logo} alt="SupportHub" />
                    <span className="login-brand-copy"><strong>SupportHub</strong><small>SUPPORT OPERATIONS</small></span>
                </div>
                <div className="login-hero-copy">
                    <div className="login-eyebrow"><i /> ONE WORKSPACE, EVERY REQUEST</div>
                    <h1>Support work,<br />kept moving.</h1>
                    <p>Bring tickets, teams, and updates together so every request has a clear next step.</p>
                    <div className="login-workflow" aria-label="Support workflow">
                        <span className="workflow-node">01</span><span className="workflow-line" />
                        <span className="workflow-node">02</span><span className="workflow-line" />
                        <span className="workflow-node">03</span>
                    </div>
                    <div className="login-workflow-labels"><span>Report</span><span>Assign</span><span>Resolve</span></div>
                </div>
                <div className="login-hero-footer"><span>SUPPORTHUB</span><span>Tickets · People · Solutions</span></div>
            </section>

            <section className="login-form-side">
                <div className="login-card">
                    <div className="login-card-mark" aria-hidden="true">S</div>
                    <p className="login-card-kicker">WELCOME BACK</p>
                    <h2>Sign in to SupportHub</h2>
                    <p className="login-subtitle">Use the account details provided by your administrator.</p>

                    <form noValidate onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label htmlFor="username">Username</label>
                            <div className={`login-input-wrap${fieldErrors.username ? " has-error" : ""}`}>
                                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.4 3-5.2 7-5.2s6.4 1.8 7 5.2"/></svg>
                                <input
                                    id="username"
                                    name="username"
                                    value={username}
                                    onChange={event => { setUsername(event.target.value); setFieldErrors(errors => ({ ...errors, username: undefined })) }}
                                    aria-invalid={Boolean(fieldErrors.username)}
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    required
                                />
                            </div>
                            {fieldErrors.username && <span className="login-field-error">{fieldErrors.username}</span>}
                        </div>

                        <div className="login-field">
                            <label htmlFor="password">Password</label>
                            <div className={`login-input-wrap${fieldErrors.password ? " has-error" : ""}`}>
                                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={event => { setPassword(event.target.value); setFieldErrors(errors => ({ ...errors, password: undefined })) }}
                                    aria-invalid={Boolean(fieldErrors.password)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                />
                                <button className="login-show-password" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            {fieldErrors.password && <span className="login-field-error">{fieldErrors.password}</span>}
                        </div>

                        <button className="login-submit" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <><span className="login-spinner" />Signing you in…</> : <>Sign in <span aria-hidden="true">→</span></>}
                        </button>
                    </form>

                    <div className="login-secure-note"><span aria-hidden="true">⌑</span> Secure access for your support team</div>
                </div>
                <div className="login-mobile-brand">SUPPORTHUB <span>·</span> TICKETS · PEOPLE · SOLUTIONS</div>
            </section>
        </main>
    )
}

export default Login
